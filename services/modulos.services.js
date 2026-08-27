const Modulo = require('../models/Modulo');
const Categoria = require('../models/Categoria');
const Requerimiento = require('../models/Requerimiento');
const ObservacionModulo = require('../models/ObservacionModulo');
const ObservacionRequerimiento = require('../models/ObservacionRequerimiento');
const Estado = require('../models/Estado');
const notificacionesService = require('./notificaciones.services');
const historialService = require('./historial.services');
const hayCambiosReales = require('../utils/hayCambiosReales');
const idsIguales = require('../utils/idsIguales');
const { limpiarCamposProtegidos } = require('../utils/camposProtegidos');

// El tablero personal es silencioso por ahora: no genera notificaciones ni
// historial (se cubre en su propio roadmap). Solo el ámbito empresa los emite.
function esEmpresa(ctx) {
  return ctx.ambito === 'empresa';
}

async function resolverPrioridad(ctx, estado, prioridad) {
  if (!estado) return prioridad ?? null;
  const estadoDoc = await Estado.findOne({ ...ctx, _id: estado });
  if (estadoDoc?.es_estado_final) return null;
  return prioridad ?? null;
}

// ¿El estado destino es un estado de cierre? Poner un ítem en estado final es
// potestad solo del dueño del tablero (regla de permisos), así que hay que
// detectarlo para bloquear a los colaboradores.
async function esEstadoFinal(ctx, estadoId) {
  if (!estadoId) return false;
  const estadoDoc = await Estado.findOne({ ...ctx, _id: estadoId });
  return !!estadoDoc?.es_estado_final;
}

async function attachNested(ctx, modulo) {
  const requerimientos = await Requerimiento.find({ ...ctx, modulo_id: modulo._id, eliminado_at: null }).sort({ orden: 1 });
  const requerimientosConObs = await Promise.all(
    requerimientos.map(async (r) => {
      const observaciones = await ObservacionRequerimiento.find({ requerimiento_id: r._id }).sort({ fecha: 1 });
      return { ...r.toObject(), observaciones };
    })
  );
  const observaciones = await ObservacionModulo.find({ modulo_id: modulo._id }).sort({ fecha: 1 });
  return { ...modulo.toObject(), requerimientos: requerimientosConObs, observaciones };
}

async function getByCategory(ctx, categoriaId) {
  const modulos = await Modulo.find({ ...ctx, categoria_id: categoriaId, eliminado_at: null }).sort({ orden: 1 });
  return Promise.all(modulos.map((m) => attachNested(ctx, m)));
}

async function getById(ctx, id) {
  const modulo = await Modulo.findOne({ ...ctx, _id: id, eliminado_at: null });
  if (!modulo) return null;
  return attachNested(ctx, modulo);
}

async function create(ctx, categoriaId, payload) {
  if (!payload.nombre || !payload.nombre.trim()) {
    throw new Error('El nombre del módulo es obligatorio');
  }
  // La autoría se hereda hacia abajo: solo quien creó la categoría (o el dueño
  // del tablero) puede crear módulos dentro de ella.
  const categoria = await Categoria.findOne({ ...ctx, _id: categoriaId, eliminado_at: null });
  if (!categoria) {
    throw new Error('Categoría no encontrada');
  }
  if (!ctx.puedeModificar(categoria)) {
    throw new Error('Solo quien creó esta categoría puede agregarle módulos');
  }
  if (await esEstadoFinal(ctx, payload.estado) && !ctx.puedeMarcarFinal()) {
    throw new Error('Solo el dueño del tablero puede crear en estado de cierre');
  }
  const total = await Modulo.countDocuments({ ...ctx, categoria_id: categoriaId });
  const prioridad = await resolverPrioridad(ctx, payload.estado, payload.prioridad);
  const modulo = await Modulo.create({ ...payload, ...ctx, ...ctx.sello, prioridad, categoria_id: categoriaId, orden: total });

  if (esEmpresa(ctx)) {
    await notificacionesService.crear(
      ctx.tenant_id,
      'modulo_creado',
      `Se creó el módulo "${modulo.nombre}"`,
      'Modulo',
      modulo._id
    );
  }

  return attachNested(ctx, modulo);
}

async function updateDetail(ctx, id, payload) {
  const anterior = await Modulo.findOne({ ...ctx, _id: id });
  if (!anterior) return null;

  if (!ctx.puedeModificar(anterior)) {
    throw new Error('Solo quien creó este módulo puede editarlo');
  }

  const data = limpiarCamposProtegidos(payload);
  if ('nombre' in data && !data.nombre.trim()) {
    throw new Error('El nombre del módulo es obligatorio');
  }
  if ('estado' in data) {
    if (!idsIguales(data.estado, anterior.estado) && await esEstadoFinal(ctx, data.estado) && !ctx.puedeMarcarFinal()) {
      throw new Error('Solo el dueño del tablero puede marcar como entregado');
    }
    data.prioridad = await resolverPrioridad(ctx, data.estado, data.prioridad);
  }

  if (!hayCambiosReales(anterior, data)) {
    return attachNested(ctx, anterior);
  }

  const modulo = await Modulo.findOneAndUpdate({ ...ctx, _id: id }, data, { new: true });
  if (!modulo) return null;

  if (esEmpresa(ctx)) {
    if ('estado' in data && !idsIguales(data.estado, anterior.estado)) {
      await historialService.registrar(ctx.tenant_id, 'Modulo', modulo._id, anterior.estado, modulo.estado);
      await notificacionesService.crear(
        ctx.tenant_id,
        'modulo_estado_cambiado',
        `El módulo "${modulo.nombre}" cambió de estado`,
        'Modulo',
        modulo._id
      );
    } else {
      await notificacionesService.crear(
        ctx.tenant_id,
        'modulo_editado',
        `Se editó el módulo "${modulo.nombre}"`,
        'Modulo',
        modulo._id
      );
    }
  }

  return attachNested(ctx, modulo);
}

async function remove(ctx, id) {
  const modulo = await Modulo.findOne({ ...ctx, _id: id });
  if (!modulo) return null;

  if (!ctx.puedeModificar(modulo)) {
    throw new Error('Solo quien creó este módulo puede eliminarlo');
  }

  const eliminado_at = new Date();
  await Requerimiento.updateMany({ ...ctx, modulo_id: id }, { eliminado_at });
  const eliminado = await Modulo.findOneAndUpdate({ ...ctx, _id: id }, { eliminado_at }, { new: true });

  if (esEmpresa(ctx)) {
    await notificacionesService.crear(
      ctx.tenant_id,
      'modulo_eliminado',
      `Se eliminó el módulo "${modulo.nombre}"`,
      'Modulo',
      modulo._id
    );
  }

  return eliminado;
}

async function reorder(ctx, categoriaId, orderedIds) {
  if (!ctx.puedeMarcarFinal()) {
    throw new Error('Solo el dueño del tablero puede reordenar');
  }
  await Promise.all(
    orderedIds.map((id, index) => Modulo.findOneAndUpdate({ ...ctx, _id: id }, { orden: index }))
  );
  return getByCategory(ctx, categoriaId);
}

module.exports = { getByCategory, getById, create, updateDetail, remove, reorder };
