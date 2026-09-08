const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const ObservacionModulo = require('../models/ObservacionModulo');
const ObservacionRequerimiento = require('../models/ObservacionRequerimiento');
const notificacionesService = require('./notificaciones.services');
const { auditar, ACCIONES } = require('./auditoria.services');
const idsIguales = require('../utils/idsIguales');
const { exigir } = require('../utils/permisos');

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

  await auditar(ctx, {
    accion: ACCIONES.CREAR,
    entidad: 'ObservacionModulo',
    entidad_id: observacion._id,
    entidad_nombre: observacion.texto?.slice(0, 80),
    contexto: { categoria_id: modulo.categoria_id, modulo_id: moduloId },
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
  const previa = await ObservacionModulo.findOne({ _id: obsId, modulo_id: moduloId, eliminado_at: null });

  // Borrar la observación ajena queda para administradores: es una herramienta
  // de moderación, no parte del trabajo diario.
  exigir(
    ctx.puedeEliminar(previa ?? {}),
    'Solo quien escribió esta observación o un administrador puede eliminarla'
  );

  const observacion = await ObservacionModulo.findOneAndUpdate(
    { _id: obsId, modulo_id: moduloId, eliminado_at: null },
    { eliminado_at: new Date() },
    { new: true }
  );

  if (observacion) {
    await auditar(ctx, {
      accion: ACCIONES.ELIMINAR,
      entidad: 'ObservacionModulo',
      entidad_id: observacion._id,
      entidad_nombre: observacion.texto?.slice(0, 80),
      contexto: { categoria_id: modulo.categoria_id, modulo_id: moduloId },
      // El texto queda en el log: es el contenido que ya no se verá en pantalla.
      snapshot: { texto: observacion.texto, creado_por: observacion.creado_por },
    });
  }

  return observacion;
}

async function editModuleObservation(ctx, moduloId, obsId, texto) {
  if (!texto || !texto.trim()) {
    throw new Error('El texto de la observación es obligatorio');
  }
  const modulo = await Modulo.findOne({ ...ctx, _id: moduloId });
  if (!modulo) {
    throw new Error('Módulo no encontrado');
  }
  const previa = await ObservacionModulo.findOne({ _id: obsId, modulo_id: moduloId, eliminado_at: null });

  // Editar el comentario de otra persona es reescribir lo que dijo: no lo puede
  // hacer nadie, ni un administrador. Quien necesite corregir algo ajeno que
  // añada su propia observación.
  exigir(
    previa && idsIguales(previa.creado_por_id, ctx.actor_id),
    'Solo puedes editar tus propias observaciones'
  );

  const observacion = await ObservacionModulo.findOneAndUpdate(
    { _id: obsId, modulo_id: moduloId, eliminado_at: null },
    { texto: texto.trim() },
    { new: true }
  );

  if (observacion) {
    await auditar(ctx, {
      accion: ACCIONES.EDITAR,
      entidad: 'ObservacionModulo',
      entidad_id: observacion._id,
      entidad_nombre: observacion.texto?.slice(0, 80),
      contexto: { categoria_id: modulo.categoria_id, modulo_id: moduloId },
      // Editar el comentario de otro es lo más delicado del tablero: se guarda
      // el texto original para poder contrastar.
      cambios: [{ campo: 'Texto', antes: previa?.texto ?? null, despues: observacion.texto }],
    });
  }

  return observacion;
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

  await auditar(ctx, {
    accion: ACCIONES.CREAR,
    entidad: 'ObservacionRequerimiento',
    entidad_id: observacion._id,
    entidad_nombre: observacion.texto?.slice(0, 80),
    contexto: { modulo_id: requerimiento.modulo_id },
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
  const previa = await ObservacionRequerimiento.findOne({ _id: obsId, requerimiento_id: requerimientoId, eliminado_at: null });

  // Borrar la observación ajena queda para administradores: es una herramienta
  // de moderación, no parte del trabajo diario.
  exigir(
    ctx.puedeEliminar(previa ?? {}),
    'Solo quien escribió esta observación o un administrador puede eliminarla'
  );

  const observacion = await ObservacionRequerimiento.findOneAndUpdate(
    { _id: obsId, requerimiento_id: requerimientoId, eliminado_at: null },
    { eliminado_at: new Date() },
    { new: true }
  );

  if (observacion) {
    await auditar(ctx, {
      accion: ACCIONES.ELIMINAR,
      entidad: 'ObservacionRequerimiento',
      entidad_id: observacion._id,
      entidad_nombre: observacion.texto?.slice(0, 80),
      contexto: { modulo_id: requerimiento.modulo_id },
      snapshot: { texto: observacion.texto, creado_por: observacion.creado_por },
    });
  }

  return observacion;
}

async function editReqObservation(ctx, requerimientoId, obsId, texto) {
  if (!texto || !texto.trim()) {
    throw new Error('El texto de la observación es obligatorio');
  }
  const requerimiento = await Requerimiento.findOne({ ...ctx, _id: requerimientoId });
  if (!requerimiento) {
    throw new Error('Requerimiento no encontrado');
  }
  const previa = await ObservacionRequerimiento.findOne({ _id: obsId, requerimiento_id: requerimientoId, eliminado_at: null });

  // Editar el comentario de otra persona es reescribir lo que dijo: no lo puede
  // hacer nadie, ni un administrador. Quien necesite corregir algo ajeno que
  // añada su propia observación.
  exigir(
    previa && idsIguales(previa.creado_por_id, ctx.actor_id),
    'Solo puedes editar tus propias observaciones'
  );

  const observacion = await ObservacionRequerimiento.findOneAndUpdate(
    { _id: obsId, requerimiento_id: requerimientoId, eliminado_at: null },
    { texto: texto.trim() },
    { new: true }
  );

  if (observacion) {
    await auditar(ctx, {
      accion: ACCIONES.EDITAR,
      entidad: 'ObservacionRequerimiento',
      entidad_id: observacion._id,
      entidad_nombre: observacion.texto?.slice(0, 80),
      contexto: { modulo_id: requerimiento.modulo_id },
      cambios: [{ campo: 'Texto', antes: previa?.texto ?? null, despues: observacion.texto }],
    });
  }

  return observacion;
}

module.exports = {
  addModuleObservation, removeModuleObservation, editModuleObservation,
  addReqObservation, removeReqObservation, editReqObservation,
};
