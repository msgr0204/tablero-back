const Modulo = require('../models/Modulo');
const Categoria = require('../models/Categoria');
const Requerimiento = require('../models/Requerimiento');
const ObservacionModulo = require('../models/ObservacionModulo');
const ObservacionRequerimiento = require('../models/ObservacionRequerimiento');
const Estado = require('../models/Estado');
const notificacionesService = require('./notificaciones.services');
const historialService = require('./historial.services');
const hayCambiosReales = require('../utils/hayCambiosReales');
const calcularCambios = require('../utils/calcularCambios');
const { auditar, resolverCatalogo, ACCIONES } = require('./auditoria.services');
const idsIguales = require('../utils/idsIguales');
const { limpiarCamposProtegidos } = require('../utils/camposProtegidos');
const { exigir } = require('../utils/permisos');
const vistoService = require('./visto.services');

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
  // Acuse de recibo (visto) a nivel de requerimiento; solo en empresa.
  const resumenVisto = ctx.ambito === 'empresa'
    ? await vistoService.resumenPorEntidades(ctx.tenant_id, ctx.actor_id, 'Requerimiento', requerimientos)
    : null;
  const requerimientosConObs = await Promise.all(
    requerimientos.map(async (r) => {
      const observaciones = await ObservacionRequerimiento.find({ requerimiento_id: r._id, eliminado_at: null }).sort({ fecha: 1 });
      const visto = resumenVisto ? (resumenVisto.get(r._id.toString()) ?? null) : null;
      return { ...r.toObject(), observaciones, visto };
    })
  );
  const observaciones = await ObservacionModulo.find({ modulo_id: modulo._id, eliminado_at: null }).sort({ fecha: 1 });
  return { ...modulo.toObject(), requerimientos: requerimientosConObs, observaciones };
}

// Una categoría privada del dueño oculta TODO su subárbol para el colaborador,
// aunque los módulos internos sean públicos. Devuelve true si el colaborador no
// puede ver esa categoría padre.
async function categoriaPadreOculta(ctx, categoriaId) {
  const visible = await Categoria.findOne({ ...ctx, ...ctx.filtroVisibilidad(), _id: categoriaId, eliminado_at: null }).select('_id');
  return !visible;
}

async function getByCategory(ctx, categoriaId) {
  if (await categoriaPadreOculta(ctx, categoriaId)) return [];
  const modulos = await Modulo.find({ ...ctx, ...ctx.filtroVisibilidad(), categoria_id: categoriaId, eliminado_at: null }).sort({ orden: 1 });
  return Promise.all(modulos.map((m) => attachNested(ctx, m)));
}

async function getById(ctx, id) {
  const modulo = await Modulo.findOne({ ...ctx, ...ctx.filtroVisibilidad(), _id: id, eliminado_at: null });
  if (!modulo) return null;
  // Herencia: si la categoría padre está oculta para este colaborador, el
  // módulo tampoco se ve, aunque él sea público.
  if (await categoriaPadreOculta(ctx, modulo.categoria_id)) return null;
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
  // Aportar un módulo a una categoría ajena es colaborar, no modificarla: en un
  // tablero compartido exigir autoría del padre paralizaría al equipo.
  exigir(ctx.puedeCrearHijo(), 'No puedes agregar módulos a este tablero');
  if (await esEstadoFinal(ctx, payload.estado)) {
    exigir(ctx.puedeCerrar(), 'No puedes crear este módulo ya entregado');
  }
  const total = await Modulo.countDocuments({ ...ctx, categoria_id: categoriaId });
  const prioridad = await resolverPrioridad(ctx, payload.estado, payload.prioridad);
  // Solo el dueño decide público/privado; lo que crea un colaborador es siempre público.
  const visibilidad = ctx.puedeMarcarVisibilidad() && payload.visibilidad === 'privado' ? 'privado' : 'publico';
  const modulo = await Modulo.create({ ...payload, ...ctx, ...ctx.sello, prioridad, visibilidad, categoria_id: categoriaId, orden: total });


  await auditar(ctx, {
    accion: ACCIONES.CREAR,
    entidad: 'Modulo',
    entidad_id: modulo._id,
    entidad_nombre: modulo.nombre,
    contexto: { categoria_id: modulo.categoria_id, modulo_id: modulo._id },
  });

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

  exigir(ctx.puedeModificar(anterior), 'Solo quien creó este módulo o un administrador puede editarlo');

  const data = limpiarCamposProtegidos(payload);
  // La visibilidad solo la cambia el dueño; si un colaborador la envía, se ignora.
  if ('visibilidad' in data && !ctx.puedeMarcarVisibilidad()) {
    delete data.visibilidad;
  }
  if ('nombre' in data && !data.nombre.trim()) {
    throw new Error('El nombre del módulo es obligatorio');
  }
  if ('estado' in data) {
    // Igual que en requerimientos: el formulario de edición es la otra vía tanto
    // para entregar como para deshacer una entrega.
    if (!idsIguales(data.estado, anterior.estado)) {
      if (await esEstadoFinal(ctx, data.estado)) {
        exigir(ctx.puedeCerrar(), 'No puedes marcar este módulo como entregado');
      }
      if (await esEstadoFinal(ctx, anterior.estado)) {
        exigir(ctx.puedeReabrir(), 'Solo un administrador puede reabrir este módulo entregado');
      }
    }
    data.prioridad = await resolverPrioridad(ctx, data.estado, data.prioridad);
  }

  if (!hayCambiosReales(anterior, data)) {
    return attachNested(ctx, anterior);
  }

  const modulo = await Modulo.findOneAndUpdate({ ...ctx, _id: id }, data, { new: true });

  await auditar(ctx, {
    accion: ACCIONES.EDITAR,
    entidad: 'Modulo',
    entidad_id: modulo._id,
    entidad_nombre: modulo.nombre,
    contexto: { categoria_id: modulo.categoria_id, modulo_id: modulo._id },
    cambios: calcularCambios(anterior, data, await resolverCatalogo(ctx)),
  });
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

  exigir(ctx.puedeEliminar(modulo), 'Solo quien creó este módulo o un administrador puede eliminarlo');

  const totalReqs = await Requerimiento.countDocuments({ ...ctx, modulo_id: id, eliminado_at: null });

  const eliminado_at = new Date();
  await Requerimiento.updateMany({ ...ctx, modulo_id: id }, { eliminado_at });
  const eliminado = await Modulo.findOneAndUpdate({ ...ctx, _id: id }, { eliminado_at }, { new: true });

  await auditar(ctx, {
    accion: ACCIONES.ELIMINAR,
    entidad: 'Modulo',
    entidad_id: modulo._id,
    entidad_nombre: modulo.nombre,
    contexto: { categoria_id: modulo.categoria_id, modulo_id: modulo._id },
    snapshot: {
      descripcion: modulo.descripcion,
      creado_por: modulo.creado_por,
      arrastro: { requerimientos: totalReqs },
    },
  });

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
  exigir(ctx.puedeReordenar(), 'No puedes reordenar este tablero');
  const ordenPrevio = await Modulo.find({ ...ctx, categoria_id: categoriaId, eliminado_at: null })
    .sort({ orden: 1 }).select('nombre');

  await Promise.all(
    orderedIds.map((id, index) => Modulo.findOneAndUpdate({ ...ctx, _id: id }, { orden: index }))
  );

  const resultado = await getByCategory(ctx, categoriaId);
  await auditar(ctx, {
    accion: ACCIONES.REORDENAR,
    entidad: 'Modulo',
    entidad_id: categoriaId,
    entidad_nombre: `${orderedIds.length} módulo(s)`,
    contexto: { categoria_id: categoriaId },
    snapshot: { antes: ordenPrevio.map((m) => m.nombre), despues: resultado.map((m) => m.nombre) },
  });
  return resultado;
}

module.exports = { getByCategory, getById, create, updateDetail, remove, reorder };
