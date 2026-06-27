const Requerimiento = require('../models/Requerimiento');
const ObservacionRequerimiento = require('../models/ObservacionRequerimiento');
const Estado = require('../models/Estado');
const notificacionesService = require('./notificaciones.services');
const historialService = require('./historial.services');
const storageService = require('./storage.services');
const hayCambiosReales = require('../utils/hayCambiosReales');
const idsIguales = require('../utils/idsIguales');

const MAXIMO_ADJUNTOS = 3;

async function attachObservaciones(req) {
  const observaciones = await ObservacionRequerimiento.find({ requerimiento_id: req._id }).sort({ fecha: 1 });
  return { ...req.toObject(), observaciones };
}

async function create(tenantId, moduloId, payload) {
  if (!payload.texto || !payload.texto.trim()) {
    throw new Error('El texto del requerimiento es obligatorio');
  }
  const total = await Requerimiento.countDocuments({ modulo_id: moduloId });
  const requerimiento = await Requerimiento.create({ ...payload, tenant_id: tenantId, modulo_id: moduloId, orden: total });

  await notificacionesService.crear(
    tenantId,
    'requerimiento_creado',
    `Se creó el requerimiento "${requerimiento.texto}"`,
    'Requerimiento',
    requerimiento._id
  );

  return attachObservaciones(requerimiento);
}

async function update(tenantId, id, payload) {
  const anterior = await Requerimiento.findOne({ _id: id, tenant_id: tenantId });
  if (!anterior) return null;

  if ('texto' in payload && !payload.texto.trim()) {
    throw new Error('El texto del requerimiento es obligatorio');
  }

  if (!hayCambiosReales(anterior, payload)) {
    return attachObservaciones(anterior);
  }

  const requerimiento = await Requerimiento.findOneAndUpdate({ _id: id, tenant_id: tenantId }, payload, { new: true });
  if (!requerimiento) return null;

  if ('estado' in payload && !idsIguales(payload.estado, anterior.estado)) {
    await historialService.registrar(tenantId, 'Requerimiento', requerimiento._id, anterior.estado, requerimiento.estado);
    await notificacionesService.crear(
      tenantId,
      'requerimiento_estado_cambiado',
      `El requerimiento "${requerimiento.texto}" cambió de estado`,
      'Requerimiento',
      requerimiento._id
    );
  } else {
    await notificacionesService.crear(
      tenantId,
      'requerimiento_editado',
      `Se editó el requerimiento "${requerimiento.texto}"`,
      'Requerimiento',
      requerimiento._id
    );
  }

  return attachObservaciones(requerimiento);
}

async function remove(tenantId, id) {
  const requerimiento = await Requerimiento.findOne({ _id: id, tenant_id: tenantId });
  if (!requerimiento) return null;

  const eliminado = await Requerimiento.findByIdAndUpdate(id, { eliminado_at: new Date() }, { new: true });

  await notificacionesService.crear(
    tenantId,
    'requerimiento_eliminado',
    `Se eliminó el requerimiento "${requerimiento.texto}"`,
    'Requerimiento',
    requerimiento._id
  );

  return eliminado;
}

async function reorder(tenantId, moduloId, orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) => Requerimiento.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { orden: index }))
  );
  const lista = await Requerimiento.find({ modulo_id: moduloId, eliminado_at: null }).sort({ orden: 1 });
  return Promise.all(lista.map(attachObservaciones));
}

async function toggleCompletado(tenantId, id, completado, estadoRestaurado) {
  const requerimiento = await Requerimiento.findOne({ _id: id, tenant_id: tenantId });
  if (!requerimiento) return null;

  const estadoAntes = requerimiento.estado;

  if (completado) {
    const estadoFinal = await Estado.findOne({ tenant_id: tenantId, es_estado_final: true });
    requerimiento.estado_anterior = requerimiento.estado;
    requerimiento.prioridad_anterior = requerimiento.prioridad;
    requerimiento.estado = estadoFinal?._id ?? requerimiento.estado;
    requerimiento.prioridad = null;
    requerimiento.completado = true;
    requerimiento.completado_at = new Date();
  } else {
    requerimiento.estado = requerimiento.estado_anterior ?? estadoRestaurado ?? null;
    requerimiento.prioridad = requerimiento.prioridad_anterior ?? null;
    requerimiento.estado_anterior = null;
    requerimiento.prioridad_anterior = null;
    requerimiento.completado = false;
    requerimiento.completado_at = null;
  }

  await requerimiento.save();

  if (!idsIguales(estadoAntes, requerimiento.estado)) {
    await historialService.registrar(tenantId, 'Requerimiento', requerimiento._id, estadoAntes, requerimiento.estado);
  }

  await notificacionesService.crear(
    tenantId,
    completado ? 'requerimiento_completado' : 'requerimiento_reabierto',
    completado
      ? `Se completó el requerimiento "${requerimiento.texto}"`
      : `Se reabrió el requerimiento "${requerimiento.texto}"`,
    'Requerimiento',
    requerimiento._id
  );

  return attachObservaciones(requerimiento);
}

async function addAdjunto(tenantId, id, buffer) {
  const requerimiento = await Requerimiento.findOne({ _id: id, tenant_id: tenantId });
  if (!requerimiento) return null;

  if (requerimiento.adjuntos.length >= MAXIMO_ADJUNTOS) {
    throw new Error(`Un requerimiento solo puede tener hasta ${MAXIMO_ADJUNTOS} imágenes`);
  }

  const { url, ruta } = await storageService.subirImagen(`${tenantId}/requerimientos/${id}`, buffer);
  requerimiento.adjuntos.push({ url, ruta });
  await requerimiento.save();

  return attachObservaciones(requerimiento);
}

async function removeAdjunto(tenantId, id, adjuntoId) {
  const requerimiento = await Requerimiento.findOne({ _id: id, tenant_id: tenantId });
  if (!requerimiento) return null;

  const adjunto = requerimiento.adjuntos.find((a) => a._id.toString() === adjuntoId);
  if (!adjunto) return attachObservaciones(requerimiento);

  requerimiento.adjuntos.pull(adjuntoId);
  await requerimiento.save();
  await storageService.eliminarImagen(adjunto.ruta);

  return attachObservaciones(requerimiento);
}

module.exports = { create, update, remove, reorder, toggleCompletado, addAdjunto, removeAdjunto };
