const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const ObservacionModulo = require('../models/ObservacionModulo');
const ObservacionRequerimiento = require('../models/ObservacionRequerimiento');
const notificacionesService = require('./notificaciones.services');

async function addModuleObservation(tenantId, moduloId, texto) {
  if (!texto || !texto.trim()) {
    throw new Error('El texto de la observación es obligatorio');
  }
  const modulo = await Modulo.findOne({ _id: moduloId, tenant_id: tenantId });
  if (!modulo) {
    throw new Error('Módulo no encontrado');
  }

  const observacion = await ObservacionModulo.create({ modulo_id: moduloId, texto });

  await notificacionesService.crear(
    tenantId,
    'observacion_modulo_creada',
    'Se agregó una observación a un módulo',
    'ObservacionModulo',
    observacion._id
  );

  return observacion;
}

async function removeModuleObservation(tenantId, moduloId, obsId) {
  const modulo = await Modulo.findOne({ _id: moduloId, tenant_id: tenantId });
  if (!modulo) {
    throw new Error('Módulo no encontrado');
  }
  return ObservacionModulo.findByIdAndDelete(obsId);
}

async function addReqObservation(tenantId, requerimientoId, texto) {
  if (!texto || !texto.trim()) {
    throw new Error('El texto de la observación es obligatorio');
  }
  const requerimiento = await Requerimiento.findOne({ _id: requerimientoId, tenant_id: tenantId });
  if (!requerimiento) {
    throw new Error('Requerimiento no encontrado');
  }

  const observacion = await ObservacionRequerimiento.create({ requerimiento_id: requerimientoId, texto });

  await notificacionesService.crear(
    tenantId,
    'observacion_requerimiento_creada',
    'Se agregó una observación a un requerimiento',
    'ObservacionRequerimiento',
    observacion._id
  );

  return observacion;
}

async function removeReqObservation(tenantId, requerimientoId, obsId) {
  const requerimiento = await Requerimiento.findOne({ _id: requerimientoId, tenant_id: tenantId });
  if (!requerimiento) {
    throw new Error('Requerimiento no encontrado');
  }
  return ObservacionRequerimiento.findByIdAndDelete(obsId);
}

module.exports = { addModuleObservation, removeModuleObservation, addReqObservation, removeReqObservation };
