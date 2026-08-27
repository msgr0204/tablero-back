const Requerimiento = require('../models/Requerimiento');
const Modulo = require('../models/Modulo');
const ObservacionRequerimiento = require('../models/ObservacionRequerimiento');
const Estado = require('../models/Estado');
const notificacionesService = require('./notificaciones.services');
const historialService = require('./historial.services');
const storageService = require('./storage.services');
const hayCambiosReales = require('../utils/hayCambiosReales');
const idsIguales = require('../utils/idsIguales');
const { limpiarCamposProtegidos } = require('../utils/camposProtegidos');

const MAXIMO_ADJUNTOS = 3;

// El tablero personal es silencioso por ahora: no genera notificaciones ni
// historial (se cubre en su propio roadmap). Solo el ámbito empresa los emite.
function esEmpresa(ctx) {
  return ctx.ambito === 'empresa';
}

// Un requerimiento en estado de cierre ya no está en el flujo de trabajo, así
// que pierde tanto la prioridad (urgencia) como el tipo (naturaleza). Devuelve
// los valores ya resueltos para persistir; ambos quedan en null si el estado
// es final.
async function resolverCamposPorEstado(ctx, estado, prioridad, tipo) {
  if (!estado) return { prioridad: prioridad ?? null, tipo: tipo ?? null };
  const estadoDoc = await Estado.findOne({ ...ctx, _id: estado });
  if (estadoDoc?.es_estado_final) return { prioridad: null, tipo: null };
  return { prioridad: prioridad ?? null, tipo: tipo ?? null };
}

// ¿El estado destino es un estado de cierre? Poner un ítem en estado final es
// potestad solo del dueño del tablero (regla de permisos), así que hay que
// detectarlo para bloquear a los colaboradores.
async function esEstadoFinal(ctx, estadoId) {
  if (!estadoId) return false;
  const estadoDoc = await Estado.findOne({ ...ctx, _id: estadoId });
  return !!estadoDoc?.es_estado_final;
}

async function attachObservaciones(req) {
  const observaciones = await ObservacionRequerimiento.find({ requerimiento_id: req._id }).sort({ fecha: 1 });
  return { ...req.toObject(), observaciones };
}

async function create(ctx, moduloId, payload) {
  if (!payload.texto || !payload.texto.trim()) {
    throw new Error('El texto del requerimiento es obligatorio');
  }
  // La autoría se hereda hacia abajo: solo quien creó el módulo (o el dueño del
  // tablero) puede crear requerimientos dentro de él.
  const modulo = await Modulo.findOne({ ...ctx, _id: moduloId, eliminado_at: null });
  if (!modulo) {
    throw new Error('Módulo no encontrado');
  }
  if (!ctx.puedeModificar(modulo)) {
    throw new Error('Solo quien creó este módulo puede agregarle requerimientos');
  }
  if (await esEstadoFinal(ctx, payload.estado) && !ctx.puedeMarcarFinal()) {
    throw new Error('Solo el dueño del tablero puede crear en estado de cierre');
  }
  const total = await Requerimiento.countDocuments({ ...ctx, modulo_id: moduloId });
  const { prioridad, tipo } = await resolverCamposPorEstado(ctx, payload.estado, payload.prioridad, payload.tipo);
  const requerimiento = await Requerimiento.create({ ...payload, ...ctx, ...ctx.sello, modulo_id: moduloId, prioridad, tipo, orden: total });

  if (esEmpresa(ctx)) {
    await notificacionesService.crear(
      ctx.tenant_id,
      'requerimiento_creado',
      `Se creó el requerimiento "${requerimiento.texto}"`,
      'Requerimiento',
      requerimiento._id
    );
  }

  return attachObservaciones(requerimiento);
}

async function update(ctx, id, payload) {
  const anterior = await Requerimiento.findOne({ ...ctx, _id: id });
  if (!anterior) return null;

  if (!ctx.puedeModificar(anterior)) {
    throw new Error('Solo quien creó este requerimiento puede editarlo');
  }

  const data = limpiarCamposProtegidos(payload);
  if ('texto' in data && !data.texto.trim()) {
    throw new Error('El texto del requerimiento es obligatorio');
  }
  if ('estado' in data) {
    if (!idsIguales(data.estado, anterior.estado) && await esEstadoFinal(ctx, data.estado) && !ctx.puedeMarcarFinal()) {
      throw new Error('Solo el dueño del tablero puede marcar como entregado');
    }
    const resuelto = await resolverCamposPorEstado(
      ctx,
      data.estado,
      'prioridad' in data ? data.prioridad : anterior.prioridad,
      'tipo' in data ? data.tipo : anterior.tipo
    );
    data.prioridad = resuelto.prioridad;
    data.tipo = resuelto.tipo;
  }

  if (!hayCambiosReales(anterior, data)) {
    return attachObservaciones(anterior);
  }

  const requerimiento = await Requerimiento.findOneAndUpdate({ ...ctx, _id: id }, data, { new: true });
  if (!requerimiento) return null;

  if (esEmpresa(ctx)) {
    if ('estado' in payload && !idsIguales(payload.estado, anterior.estado)) {
      await historialService.registrar(ctx.tenant_id, 'Requerimiento', requerimiento._id, anterior.estado, requerimiento.estado);
      await notificacionesService.crear(
        ctx.tenant_id,
        'requerimiento_estado_cambiado',
        `El requerimiento "${requerimiento.texto}" cambió de estado`,
        'Requerimiento',
        requerimiento._id
      );
    } else {
      await notificacionesService.crear(
        ctx.tenant_id,
        'requerimiento_editado',
        `Se editó el requerimiento "${requerimiento.texto}"`,
        'Requerimiento',
        requerimiento._id
      );
    }
  }

  return attachObservaciones(requerimiento);
}

async function remove(ctx, id) {
  const requerimiento = await Requerimiento.findOne({ ...ctx, _id: id });
  if (!requerimiento) return null;

  if (!ctx.puedeModificar(requerimiento)) {
    throw new Error('Solo quien creó este requerimiento puede eliminarlo');
  }

  const eliminado = await Requerimiento.findOneAndUpdate({ ...ctx, _id: id }, { eliminado_at: new Date() }, { new: true });

  if (esEmpresa(ctx)) {
    await notificacionesService.crear(
      ctx.tenant_id,
      'requerimiento_eliminado',
      `Se eliminó el requerimiento "${requerimiento.texto}"`,
      'Requerimiento',
      requerimiento._id
    );
  }

  return eliminado;
}

async function reorder(ctx, moduloId, orderedIds) {
  if (!ctx.puedeMarcarFinal()) {
    throw new Error('Solo el dueño del tablero puede reordenar');
  }
  await Promise.all(
    orderedIds.map((id, index) => Requerimiento.findOneAndUpdate({ ...ctx, _id: id }, { orden: index }))
  );
  const lista = await Requerimiento.find({ ...ctx, modulo_id: moduloId, eliminado_at: null }).sort({ orden: 1 });
  return Promise.all(lista.map(attachObservaciones));
}

async function toggleCompletado(ctx, id, completado, estadoRestaurado) {
  const requerimiento = await Requerimiento.findOne({ ...ctx, _id: id });
  if (!requerimiento) return null;

  // Completar/reabrir (marcar entregado) es potestad solo del dueño del tablero,
  // aunque el requerimiento lo haya creado un colaborador.
  if (!ctx.puedeMarcarFinal()) {
    throw new Error('Solo el dueño del tablero puede completar o reabrir requerimientos');
  }

  const estadoAntes = requerimiento.estado;

  if (completado) {
    const estadoFinal = await Estado.findOne({ ...ctx, es_estado_final: true });
    requerimiento.estado_anterior = requerimiento.estado;
    requerimiento.prioridad_anterior = requerimiento.prioridad;
    requerimiento.tipo_anterior = requerimiento.tipo;
    requerimiento.estado = estadoFinal?._id ?? requerimiento.estado;
    requerimiento.prioridad = null;
    requerimiento.tipo = null;
    requerimiento.completado = true;
    requerimiento.completado_at = new Date();
  } else {
    requerimiento.estado = requerimiento.estado_anterior ?? estadoRestaurado ?? null;
    requerimiento.prioridad = requerimiento.prioridad_anterior ?? null;
    requerimiento.tipo = requerimiento.tipo_anterior ?? null;
    requerimiento.estado_anterior = null;
    requerimiento.prioridad_anterior = null;
    requerimiento.tipo_anterior = null;
    requerimiento.completado = false;
    requerimiento.completado_at = null;
  }

  await requerimiento.save();

  if (esEmpresa(ctx)) {
    if (!idsIguales(estadoAntes, requerimiento.estado)) {
      await historialService.registrar(ctx.tenant_id, 'Requerimiento', requerimiento._id, estadoAntes, requerimiento.estado);
    }

    await notificacionesService.crear(
      ctx.tenant_id,
      completado ? 'requerimiento_completado' : 'requerimiento_reabierto',
      completado
        ? `Se completó el requerimiento "${requerimiento.texto}"`
        : `Se reabrió el requerimiento "${requerimiento.texto}"`,
      'Requerimiento',
      requerimiento._id
    );
  }

  return attachObservaciones(requerimiento);
}

async function addAdjunto(ctx, id, buffer) {
  const requerimiento = await Requerimiento.findOne({ ...ctx, _id: id });
  if (!requerimiento) return null;

  if (requerimiento.adjuntos.length >= MAXIMO_ADJUNTOS) {
    throw new Error(`Un requerimiento solo puede tener hasta ${MAXIMO_ADJUNTOS} imágenes`);
  }

  const { url, ruta } = await storageService.subirImagen(`${ctx.tenant_id}/requerimientos/${id}`, buffer);
  requerimiento.adjuntos.push({ url, ruta });
  await requerimiento.save();

  return attachObservaciones(requerimiento);
}

async function removeAdjunto(ctx, id, adjuntoId) {
  const requerimiento = await Requerimiento.findOne({ ...ctx, _id: id });
  if (!requerimiento) return null;

  const adjunto = requerimiento.adjuntos.find((a) => a._id.toString() === adjuntoId);
  if (!adjunto) return attachObservaciones(requerimiento);

  requerimiento.adjuntos.pull(adjuntoId);
  await requerimiento.save();
  await storageService.eliminarImagen(adjunto.ruta);

  return attachObservaciones(requerimiento);
}

module.exports = { create, update, remove, reorder, toggleCompletado, addAdjunto, removeAdjunto };
