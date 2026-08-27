const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const ObservacionModulo = require('../models/ObservacionModulo');
const ObservacionRequerimiento = require('../models/ObservacionRequerimiento');
const notificacionesService = require('./notificaciones.services');

// El tablero personal es silencioso por ahora: no genera notificaciones.
function esEmpresa(ctx) {
  return ctx.ambito === 'empresa';
}

// Las observaciones no llevan campo de ámbito propio: heredan el del padre. La
// pertenencia se garantiza validando el módulo/requerimiento con el filtro de
// ámbito completo, de modo que nunca se toca una observación de otro ámbito.

async function addModuleObservation(ctx, moduloId, texto) {
  if (!texto || !texto.trim()) {
    throw new Error('El texto de la observación es obligatorio');
  }
  const modulo = await Modulo.findOne({ ...ctx, _id: moduloId });
  if (!modulo) {
    throw new Error('Módulo no encontrado');
  }

  const observacion = await ObservacionModulo.create({
    modulo_id: moduloId,
    texto,
    creado_por: ctx.creado_por ?? null,
    creado_por_id: ctx.sello.creado_por_id,
  });

  if (esEmpresa(ctx)) {
    await notificacionesService.crear(
      ctx.tenant_id,
      'observacion_modulo_creada',
      'Se agregó una observación a un módulo',
      'ObservacionModulo',
      observacion._id
    );
  }

  return observacion;
}

async function removeModuleObservation(ctx, moduloId, obsId) {
  const modulo = await Modulo.findOne({ ...ctx, _id: moduloId });
  if (!modulo) {
    throw new Error('Módulo no encontrado');
  }
  return ObservacionModulo.findOneAndDelete({ _id: obsId, modulo_id: moduloId });
}

async function editModuleObservation(ctx, moduloId, obsId, texto) {
  if (!texto || !texto.trim()) {
    throw new Error('El texto de la observación es obligatorio');
  }
  const modulo = await Modulo.findOne({ ...ctx, _id: moduloId });
  if (!modulo) {
    throw new Error('Módulo no encontrado');
  }
  return ObservacionModulo.findOneAndUpdate(
    { _id: obsId, modulo_id: moduloId },
    { texto: texto.trim() },
    { new: true }
  );
}

async function addReqObservation(ctx, requerimientoId, texto) {
  if (!texto || !texto.trim()) {
    throw new Error('El texto de la observación es obligatorio');
  }
  const requerimiento = await Requerimiento.findOne({ ...ctx, _id: requerimientoId });
  if (!requerimiento) {
    throw new Error('Requerimiento no encontrado');
  }

  const observacion = await ObservacionRequerimiento.create({
    requerimiento_id: requerimientoId,
    texto,
    creado_por: ctx.creado_por ?? null,
    creado_por_id: ctx.sello.creado_por_id,
  });

  if (esEmpresa(ctx)) {
    await notificacionesService.crear(
      ctx.tenant_id,
      'observacion_requerimiento_creada',
      'Se agregó una observación a un requerimiento',
      'ObservacionRequerimiento',
      observacion._id
    );
  }

  return observacion;
}

async function removeReqObservation(ctx, requerimientoId, obsId) {
  const requerimiento = await Requerimiento.findOne({ ...ctx, _id: requerimientoId });
  if (!requerimiento) {
    throw new Error('Requerimiento no encontrado');
  }
  return ObservacionRequerimiento.findOneAndDelete({ _id: obsId, requerimiento_id: requerimientoId });
}

async function editReqObservation(ctx, requerimientoId, obsId, texto) {
  if (!texto || !texto.trim()) {
    throw new Error('El texto de la observación es obligatorio');
  }
  const requerimiento = await Requerimiento.findOne({ ...ctx, _id: requerimientoId });
  if (!requerimiento) {
    throw new Error('Requerimiento no encontrado');
  }
  return ObservacionRequerimiento.findOneAndUpdate(
    { _id: obsId, requerimiento_id: requerimientoId },
    { texto: texto.trim() },
    { new: true }
  );
}

module.exports = {
  addModuleObservation, removeModuleObservation, editModuleObservation,
  addReqObservation, removeReqObservation, editReqObservation,
};
