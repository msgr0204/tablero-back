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
const { exigir } = require('../utils/permisos');
const calcularCambios = require('../utils/calcularCambios');
const vistoService = require('./visto.services');
const { auditar, resolverCatalogo, ACCIONES } = require('./auditoria.services');

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

async function attachObservaciones(ctx, req) {
  const observaciones = await ObservacionRequerimiento.find({ requerimiento_id: req._id, eliminado_at: null }).sort({ fecha: 1 });
  // Acuse de recibo (visto), solo en empresa.
  let visto = null;
  if (ctx?.ambito === 'empresa') {
    const resumen = await vistoService.resumenPorEntidades(ctx.tenant_id, ctx.actor_id, 'Requerimiento', [req]);
    visto = resumen.get(req._id.toString()) ?? null;
  }
  return { ...req.toObject(), observaciones, visto };
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
  exigir(ctx.puedeCrearHijo(), 'No puedes agregar requerimientos a este tablero');
  if (await esEstadoFinal(ctx, payload.estado)) {
    exigir(ctx.puedeCerrar(), 'No puedes crear un requerimiento ya entregado');
  }
  const total = await Requerimiento.countDocuments({ ...ctx, modulo_id: moduloId });
  const { prioridad, tipo } = await resolverCamposPorEstado(ctx, payload.estado, payload.prioridad, payload.tipo);
  const requerimiento = await Requerimiento.create({ ...payload, ...ctx, ...ctx.sello, modulo_id: moduloId, prioridad, tipo, orden: total });

  await auditar(ctx, {
    accion: ACCIONES.CREAR,
    entidad: 'Requerimiento',
    entidad_id: requerimiento._id,
    entidad_nombre: requerimiento.texto,
    contexto: { modulo_id: requerimiento.modulo_id },
  });

  if (esEmpresa(ctx)) {
    await notificacionesService.crear(
      ctx.tenant_id,
      'requerimiento_creado',
      `Se creó el requerimiento "${requerimiento.texto}"`,
      'Requerimiento',
      requerimiento._id
    );
  }

  return attachObservaciones(ctx, requerimiento);
}

async function update(ctx, id, payload) {
  const anterior = await Requerimiento.findOne({ ...ctx, _id: id });
  if (!anterior) return null;

  exigir(ctx.puedeModificar(anterior), 'Solo quien creó este requerimiento o un administrador puede editarlo');

  const data = limpiarCamposProtegidos(payload);
  if ('texto' in data && !data.texto.trim()) {
    throw new Error('El texto del requerimiento es obligatorio');
  }
  if ('estado' in data) {
    // Cambiar el estado por el formulario es la otra vía para cerrar y para
    // REABRIR: sin comprobar la salida del estado final, bastaría con editar el
    // requerimiento para deshacer una entrega sin permiso.
    if (!idsIguales(data.estado, anterior.estado)) {
      const entraACierre = await esEstadoFinal(ctx, data.estado);
      const saleDeCierre = await esEstadoFinal(ctx, anterior.estado);
      if (entraACierre) {
        exigir(ctx.puedeCerrar(), 'No puedes marcar este requerimiento como entregado');
      }
      if (saleDeCierre) {
        exigir(ctx.puedeReabrir(), 'Solo un administrador puede reabrir un requerimiento entregado');
      }
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
    return attachObservaciones(ctx, anterior);
  }

  const requerimiento = await Requerimiento.findOneAndUpdate({ ...ctx, _id: id }, data, { new: true });
  if (!requerimiento) return null;

  await auditar(ctx, {
    accion: ACCIONES.EDITAR,
    entidad: 'Requerimiento',
    entidad_id: requerimiento._id,
    entidad_nombre: requerimiento.texto,
    contexto: { modulo_id: requerimiento.modulo_id },
    cambios: calcularCambios(anterior, data, await resolverCatalogo(ctx)),
  });

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

  return attachObservaciones(ctx, requerimiento);
}

async function remove(ctx, id) {
  const requerimiento = await Requerimiento.findOne({ ...ctx, _id: id });
  if (!requerimiento) return null;

  exigir(ctx.puedeEliminar(requerimiento), 'Solo quien creó este requerimiento o un administrador puede eliminarlo');

  const eliminado = await Requerimiento.findOneAndUpdate({ ...ctx, _id: id }, { eliminado_at: new Date() }, { new: true });

  await auditar(ctx, {
    accion: ACCIONES.ELIMINAR,
    entidad: 'Requerimiento',
    entidad_id: requerimiento._id,
    entidad_nombre: requerimiento.texto,
    contexto: { modulo_id: requerimiento.modulo_id },
    snapshot: {
      texto: requerimiento.texto,
      completado: requerimiento.completado,
      creado_por: requerimiento.creado_por,
    },
  });

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
  exigir(ctx.puedeReordenar(), 'No puedes reordenar este tablero');
  // Una sola entrada para toda la operación: reordenar mueve N ítems a la vez y
  // registrar uno por cada uno ahogaría el log sin aportar nada.
  const ordenPrevio = await Requerimiento.find({ ...ctx, modulo_id: moduloId, eliminado_at: null })
    .sort({ orden: 1 }).select('texto');

  await Promise.all(
    orderedIds.map((id, index) => Requerimiento.findOneAndUpdate({ ...ctx, _id: id }, { orden: index }))
  );
  const lista = await Requerimiento.find({ ...ctx, modulo_id: moduloId, eliminado_at: null }).sort({ orden: 1 });

  await auditar(ctx, {
    accion: ACCIONES.REORDENAR,
    entidad: 'Requerimiento',
    entidad_id: moduloId,
    entidad_nombre: `${lista.length} requerimiento(s)`,
    contexto: { modulo_id: moduloId },
    snapshot: {
      antes: ordenPrevio.map((r) => r.texto),
      despues: lista.map((r) => r.texto),
    },
  });
  return Promise.all(lista.map((r) => attachObservaciones(ctx, r)));
}

async function toggleCompletado(ctx, id, completado, estadoRestaurado) {
  const requerimiento = await Requerimiento.findOne({ ...ctx, _id: id });
  if (!requerimiento) return null;

  // Completar avanza el trabajo y lo puede hacer cualquiera; reabrir DESHACE el
  // cierre de otra persona y por eso está reservado.
  if (completado) {
    exigir(ctx.puedeCerrar(), 'No puedes completar este requerimiento');
  } else {
    exigir(ctx.puedeReabrir(), 'Solo un administrador puede reabrir un requerimiento entregado');
  }

  const estadoAntes = requerimiento.estado;
  // Quién y cuándo lo había cerrado. Se captura ANTES de mutar porque al
  // reabrir estos campos se limpian, y son justamente la evidencia de que el
  // requerimiento llegó a estar entregado.
  const cierrePrevio = {
    completado_at: requerimiento.completado_at,
    completado_por_nombre: requerimiento.completado_por_nombre,
  };

  if (completado) {
    const estadoFinal = await Estado.findOne({ ...ctx, es_estado_final: true, eliminado_at: null });
    requerimiento.estado_anterior = requerimiento.estado;
    requerimiento.prioridad_anterior = requerimiento.prioridad;
    requerimiento.tipo_anterior = requerimiento.tipo;
    requerimiento.estado = estadoFinal?._id ?? requerimiento.estado;
    requerimiento.prioridad = null;
    requerimiento.tipo = null;
    requerimiento.completado = true;
    requerimiento.completado_at = new Date();
    requerimiento.completado_por = ctx.actor_id ?? null;
    requerimiento.completado_por_nombre = ctx.creado_por ?? null;
  } else {
    requerimiento.estado = requerimiento.estado_anterior ?? estadoRestaurado ?? null;
    requerimiento.prioridad = requerimiento.prioridad_anterior ?? null;
    requerimiento.tipo = requerimiento.tipo_anterior ?? null;
    requerimiento.estado_anterior = null;
    requerimiento.prioridad_anterior = null;
    requerimiento.tipo_anterior = null;
    requerimiento.completado = false;
    requerimiento.completado_at = null;
    requerimiento.completado_por = null;
    requerimiento.completado_por_nombre = null;
    // Reabrir algo ya entregado es la acción que más malentendidos genera:
    // queda sellada en el propio documento, además del registro de auditoría.
    requerimiento.reabierto_por = ctx.actor_id ?? null;
    requerimiento.reabierto_por_nombre = ctx.creado_por ?? null;
    requerimiento.reabierto_at = new Date();
    requerimiento.veces_reabierto = (requerimiento.veces_reabierto ?? 0) + 1;
  }

  await requerimiento.save();

  await auditar(ctx, {
    accion: completado ? ACCIONES.COMPLETAR : ACCIONES.REABRIR,
    entidad: 'Requerimiento',
    entidad_id: requerimiento._id,
    entidad_nombre: requerimiento.texto,
    contexto: { modulo_id: requerimiento.modulo_id },
    snapshot: completado
      ? null
      : {
          // Se conserva de quién y de cuándo era el cierre que se acaba de
          // deshacer, porque el documento ya no lo guarda.
          cerrado_por: cierrePrevio.completado_por_nombre,
          cerrado_at: cierrePrevio.completado_at,
          veces_reabierto: requerimiento.veces_reabierto,
        },
  });

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

  return attachObservaciones(ctx, requerimiento);
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

  await auditar(ctx, {
    accion: ACCIONES.ADJUNTAR,
    entidad: 'Requerimiento',
    entidad_id: requerimiento._id,
    entidad_nombre: requerimiento.texto,
    contexto: { modulo_id: requerimiento.modulo_id },
    snapshot: { total_adjuntos: requerimiento.adjuntos.length },
  });

  return attachObservaciones(ctx, requerimiento);
}

async function removeAdjunto(ctx, id, adjuntoId) {
  const requerimiento = await Requerimiento.findOne({ ...ctx, _id: id });
  if (!requerimiento) return null;

  const adjunto = requerimiento.adjuntos.find((a) => a._id.toString() === adjuntoId);
  if (!adjunto) return attachObservaciones(ctx, requerimiento);

  // La imagen se borra también del almacenamiento: es irrecuperable, así que
  // quitar evidencia ajena queda para el autor del requerimiento o un admin.
  exigir(ctx.puedeEliminar(requerimiento), 'No puedes eliminar imágenes de un requerimiento ajeno');

  requerimiento.adjuntos.pull(adjuntoId);
  await requerimiento.save();
  await storageService.eliminarImagen(adjunto.ruta);

  await auditar(ctx, {
    accion: ACCIONES.QUITAR_ADJUNTO,
    entidad: 'Requerimiento',
    entidad_id: requerimiento._id,
    entidad_nombre: requerimiento.texto,
    contexto: { modulo_id: requerimiento.modulo_id },
    // La imagen se borra del almacenamiento: la url queda como constancia de
    // qué se quitó, aunque ya no se pueda abrir.
    snapshot: { url_eliminada: adjunto.url, restantes: requerimiento.adjuntos.length },
  });

  return attachObservaciones(ctx, requerimiento);
}

module.exports = { create, update, remove, reorder, toggleCompletado, addAdjunto, removeAdjunto };
