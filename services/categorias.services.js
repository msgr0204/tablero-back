const Categoria = require('../models/Categoria');
const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
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

async function withCounts(ctx, categorias) {
  const lista = Array.isArray(categorias) ? categorias : [categorias];
  const result = await Promise.all(
    lista.map(async (cat) => {
      const modulos = await Modulo.find({ ...ctx, ...ctx.filtroVisibilidad(), categoria_id: cat._id, eliminado_at: null }).select('_id');
      const moduloIds = modulos.map((m) => m._id);
      const totalRequerimientos = await Requerimiento.countDocuments({ ...ctx, modulo_id: { $in: moduloIds }, eliminado_at: null });
      return {
        ...cat.toObject(),
        totalModulos: modulos.length,
        totalRequerimientos,
      };
    })
  );
  return Array.isArray(categorias) ? result : result[0];
}

async function getAll(ctx) {
  const categorias = await Categoria.find({ ...ctx, ...ctx.filtroVisibilidad(), eliminado_at: null }).sort({ orden: 1 });
  return withCounts(ctx, categorias);
}

async function getById(ctx, id) {
  const categoria = await Categoria.findOne({ ...ctx, ...ctx.filtroVisibilidad(), _id: id, eliminado_at: null });
  if (!categoria) return null;
  return withCounts(ctx, categoria);
}

async function create(ctx, payload) {
  if (!payload.nombre || !payload.nombre.trim()) {
    throw new Error('El nombre de la categoría es obligatorio');
  }
  if (await esEstadoFinal(ctx, payload.estado) && !ctx.puedeMarcarFinal()) {
    throw new Error('Solo el dueño del tablero puede crear en estado de cierre');
  }
  const total = await Categoria.countDocuments({ ...ctx });
  const prioridad = await resolverPrioridad(ctx, payload.estado, payload.prioridad);
  // Solo el dueño decide público/privado; lo que crea un colaborador es siempre público.
  const visibilidad = ctx.puedeMarcarVisibilidad() && payload.visibilidad === 'privado' ? 'privado' : 'publico';
  const categoria = await Categoria.create({ ...payload, ...ctx, ...ctx.sello, prioridad, visibilidad, orden: total });

  if (esEmpresa(ctx)) {
    await notificacionesService.crear(
      ctx.tenant_id,
      'categoria_creada',
      `Se creó la categoría "${categoria.nombre}"`,
      'Categoria',
      categoria._id
    );
  }

  return withCounts(ctx, categoria);
}

async function update(ctx, id, payload) {
  const anterior = await Categoria.findOne({ ...ctx, _id: id });
  if (!anterior) return null;

  if (!ctx.puedeModificar(anterior)) {
    throw new Error('Solo quien creó esta categoría puede editarla');
  }

  const data = limpiarCamposProtegidos(payload);
  // La visibilidad solo la cambia el dueño; si un colaborador la envía, se ignora.
  if ('visibilidad' in data && !ctx.puedeMarcarVisibilidad()) {
    delete data.visibilidad;
  }
  if ('nombre' in data && !data.nombre.trim()) {
    throw new Error('El nombre de la categoría es obligatorio');
  }
  if ('estado' in data) {
    if (!idsIguales(data.estado, anterior.estado) && await esEstadoFinal(ctx, data.estado) && !ctx.puedeMarcarFinal()) {
      throw new Error('Solo el dueño del tablero puede marcar como entregado');
    }
    data.prioridad = await resolverPrioridad(ctx, data.estado, data.prioridad);
  }

  if (!hayCambiosReales(anterior, data)) {
    return withCounts(ctx, anterior);
  }

  const categoria = await Categoria.findOneAndUpdate({ ...ctx, _id: id }, data, { new: true });
  if (!categoria) return null;

  if (esEmpresa(ctx)) {
    if ('estado' in data && !idsIguales(data.estado, anterior.estado)) {
      await historialService.registrar(ctx.tenant_id, 'Categoria', categoria._id, anterior.estado, categoria.estado);
      await notificacionesService.crear(
        ctx.tenant_id,
        'categoria_estado_cambiado',
        `La categoría "${categoria.nombre}" cambió de estado`,
        'Categoria',
        categoria._id
      );
    } else {
      await notificacionesService.crear(
        ctx.tenant_id,
        'categoria_editada',
        `Se editó la categoría "${categoria.nombre}"`,
        'Categoria',
        categoria._id
      );
    }
  }

  return withCounts(ctx, categoria);
}

async function remove(ctx, id) {
  const categoria = await Categoria.findOne({ ...ctx, _id: id });
  if (!categoria) return null;

  if (!ctx.puedeModificar(categoria)) {
    throw new Error('Solo quien creó esta categoría puede eliminarla');
  }

  const modulos = await Modulo.find({ ...ctx, categoria_id: id }).select('_id');
  const moduloIds = modulos.map((m) => m._id);

  const eliminado_at = new Date();
  await Promise.all([
    Requerimiento.updateMany({ ...ctx, modulo_id: { $in: moduloIds } }, { eliminado_at }),
    Modulo.updateMany({ ...ctx, categoria_id: id }, { eliminado_at }),
  ]);

  const eliminada = await Categoria.findOneAndUpdate({ ...ctx, _id: id }, { eliminado_at }, { new: true });

  if (esEmpresa(ctx)) {
    await notificacionesService.crear(
      ctx.tenant_id,
      'categoria_eliminada',
      `Se eliminó la categoría "${categoria.nombre}"`,
      'Categoria',
      categoria._id
    );
  }

  return eliminada;
}

async function reorder(ctx, orderedIds) {
  // Reordenar organiza el tablero completo (no un ítem propio): en un tablero
  // personal compartido, solo el dueño reordena.
  if (!ctx.puedeMarcarFinal()) {
    throw new Error('Solo el dueño del tablero puede reordenar');
  }
  await Promise.all(
    orderedIds.map((id, index) => Categoria.findOneAndUpdate({ ...ctx, _id: id }, { orden: index }))
  );
  return getAll(ctx);
}

module.exports = { getAll, getById, create, update, remove, reorder };
