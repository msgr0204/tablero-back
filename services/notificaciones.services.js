const Notificacion = require('../models/Notificacion');
const Categoria = require('../models/Categoria');
const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const ObservacionModulo = require('../models/ObservacionModulo');
const ObservacionRequerimiento = require('../models/ObservacionRequerimiento');

const LIMITE_LISTADO = 50;

/**
 * Resuelve, en el momento de leer la notificación (no al crearla), si la
 * entidad referenciada todavía existe y cuáles son sus IDs padre (categoría/
 * módulo). Así el link de navegación nunca queda desincronizado si algo se
 * reorganiza después, y se puede ocultar el link si la entidad fue eliminada.
 */
async function resolverDestino(tenantId, entidad, entidadId) {
  if (!entidadId) return null;

  if (entidad === 'Categoria') {
    const categoria = await Categoria.findOne({ _id: entidadId, tenant_id: tenantId, eliminado_at: null });
    if (!categoria) return null;
    return { categoria_id: categoria._id };
  }

  if (entidad === 'Modulo') {
    const modulo = await Modulo.findOne({ _id: entidadId, tenant_id: tenantId, eliminado_at: null });
    if (!modulo) return null;
    return { categoria_id: modulo.categoria_id, modulo_id: modulo._id };
  }

  if (entidad === 'Requerimiento') {
    const requerimiento = await Requerimiento.findOne({ _id: entidadId, tenant_id: tenantId, eliminado_at: null });
    if (!requerimiento) return null;
    const modulo = await Modulo.findOne({ _id: requerimiento.modulo_id, tenant_id: tenantId, eliminado_at: null });
    if (!modulo) return null;
    return { categoria_id: modulo.categoria_id, modulo_id: modulo._id, requerimiento_id: requerimiento._id };
  }

  if (entidad === 'ObservacionModulo') {
    const observacion = await ObservacionModulo.findById(entidadId);
    if (!observacion) return null;
    const modulo = await Modulo.findOne({ _id: observacion.modulo_id, tenant_id: tenantId, eliminado_at: null });
    if (!modulo) return null;
    return { categoria_id: modulo.categoria_id, modulo_id: modulo._id };
  }

  if (entidad === 'ObservacionRequerimiento') {
    const observacion = await ObservacionRequerimiento.findById(entidadId);
    if (!observacion) return null;
    const requerimiento = await Requerimiento.findOne({ _id: observacion.requerimiento_id, tenant_id: tenantId, eliminado_at: null });
    if (!requerimiento) return null;
    const modulo = await Modulo.findOne({ _id: requerimiento.modulo_id, tenant_id: tenantId, eliminado_at: null });
    if (!modulo) return null;
    return { categoria_id: modulo.categoria_id, modulo_id: modulo._id, requerimiento_id: requerimiento._id };
  }

  return null;
}

async function conDestino(notificacion) {
  const destino = await resolverDestino(notificacion.tenant_id, notificacion.entidad, notificacion.entidad_id);
  return { ...notificacion.toObject({ virtuals: true }), destino };
}

async function crear(tenantId, tipo, mensaje, entidad, entidad_id = null) {
  return Notificacion.create({ tenant_id: tenantId, tipo, mensaje, entidad, entidad_id });
}

async function getAll(tenantId) {
  const notificaciones = await Notificacion.find({ tenant_id: tenantId }).sort({ created_at: -1 }).limit(LIMITE_LISTADO);
  return Promise.all(notificaciones.map(conDestino));
}

async function getPaginado(tenantId, pagina = 1, porPagina = 20) {
  const skip = (pagina - 1) * porPagina;
  const [notificaciones, total] = await Promise.all([
    Notificacion.find({ tenant_id: tenantId }).sort({ created_at: -1 }).skip(skip).limit(porPagina),
    Notificacion.countDocuments({ tenant_id: tenantId }),
  ]);
  return {
    notificaciones: await Promise.all(notificaciones.map(conDestino)),
    total,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    pagina,
  };
}

async function contarNoLeidas(tenantId) {
  return Notificacion.countDocuments({ tenant_id: tenantId, leida: false });
}

async function marcarLeida(tenantId, id) {
  return Notificacion.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { leida: true }, { new: true });
}

module.exports = { crear, getAll, getPaginado, contarNoLeidas, marcarLeida };
