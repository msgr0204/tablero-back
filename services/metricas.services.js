const Categoria = require('../models/Categoria');
const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const Estado = require('../models/Estado');
const Prioridad = require('../models/Prioridad');
const ObservacionRequerimiento = require('../models/ObservacionRequerimiento');
const HistorialEstado = require('../models/HistorialEstado');

const DIAS_SIN_ACTIVIDAD = 7;

async function getVencimientos(tenantId) {
  const ahora = new Date();
  const en7Dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const requerimientos = await Requerimiento.find({
    tenant_id: tenantId,
    eliminado_at: null,
    completado: false,
    fecha_entrega: { $ne: null, $lte: en7Dias },
  }).sort({ fecha_entrega: 1 });

  const moduloIds = [...new Set(requerimientos.map((r) => r.modulo_id.toString()))];
  const modulos = await Modulo.find({ _id: { $in: moduloIds } }).select('nombre categoria_id');
  const categoriaIds = [...new Set(modulos.map((m) => m.categoria_id.toString()))];
  const categorias = await Categoria.find({ _id: { $in: categoriaIds } }).select('nombre');

  const moduloPorId = new Map(modulos.map((m) => [m._id.toString(), m]));
  const categoriaPorId = new Map(categorias.map((c) => [c._id.toString(), c]));

  return requerimientos.map((req) => {
    const modulo = moduloPorId.get(req.modulo_id.toString());
    const categoria = modulo ? categoriaPorId.get(modulo.categoria_id.toString()) : null;
    return {
      requerimientoId: req._id,
      texto: req.texto,
      fechaEntrega: req.fecha_entrega,
      vencido: req.fecha_entrega < ahora,
      moduloId: modulo?._id ?? null,
      moduloNombre: modulo?.nombre ?? '—',
      categoriaId: categoria?._id ?? null,
      categoriaNombre: categoria?.nombre ?? '—',
    };
  });
}

async function getSinActividad(tenantId) {
  const limite = new Date(Date.now() - DIAS_SIN_ACTIVIDAD * 24 * 60 * 60 * 1000);

  const requerimientos = await Requerimiento.find({
    tenant_id: tenantId,
    eliminado_at: null,
    completado: false,
    updated_at: { $lte: limite },
  }).sort({ updated_at: 1 });

  const reqIds = requerimientos.map((r) => r._id);
  const ultimasObs = await ObservacionRequerimiento.aggregate([
    { $match: { requerimiento_id: { $in: reqIds } } },
    { $group: { _id: '$requerimiento_id', ultimaFecha: { $max: '$fecha' } } },
  ]);
  const ultimaObsPorReq = new Map(ultimasObs.map((o) => [o._id.toString(), o.ultimaFecha]));

  const moduloIds = [...new Set(requerimientos.map((r) => r.modulo_id.toString()))];
  const modulos = await Modulo.find({ _id: { $in: moduloIds } }).select('nombre');
  const moduloPorId = new Map(modulos.map((m) => [m._id.toString(), m]));

  return requerimientos
    .filter((req) => {
      const ultimaObs = ultimaObsPorReq.get(req._id.toString());
      return !ultimaObs || ultimaObs <= limite;
    })
    .map((req) => ({
      requerimientoId: req._id,
      texto: req.texto,
      moduloId: req.modulo_id,
      moduloNombre: moduloPorId.get(req.modulo_id.toString())?.nombre ?? '—',
      ultimaActividad: ultimaObsPorReq.get(req._id.toString()) ?? req.updated_at,
    }));
}

async function getSaludCatalogos(tenantId) {
  const [estados, prioridades] = await Promise.all([
    Estado.find({ tenant_id: tenantId }).sort({ orden: 1 }),
    Prioridad.find({ tenant_id: tenantId }).sort({ orden: 1 }),
  ]);

  const usosPorEstado = await Requerimiento.aggregate([
    { $match: { tenant_id: tenantId, eliminado_at: null, estado: { $ne: null } } },
    { $group: { _id: '$estado', total: { $sum: 1 } } },
  ]);
  const usosPorPrioridad = await Requerimiento.aggregate([
    { $match: { tenant_id: tenantId, eliminado_at: null, prioridad: { $ne: null } } },
    { $group: { _id: '$prioridad', total: { $sum: 1 } } },
  ]);

  const estadosSinUso = estados
    .filter((e) => !usosPorEstado.some((u) => u._id?.toString() === e._id.toString()))
    .map((e) => ({ id: e._id, label: e.label }));
  const prioridadesSinUso = prioridades
    .filter((p) => !usosPorPrioridad.some((u) => u._id?.toString() === p._id.toString()))
    .map((p) => ({ id: p._id, label: p.label }));

  const categorias = await Categoria.find({ tenant_id: tenantId, eliminado_at: null }).select('nombre');
  const categoriaIds = categorias.map((c) => c._id);
  const modulosPorCategoria = await Modulo.aggregate([
    { $match: { categoria_id: { $in: categoriaIds }, eliminado_at: null } },
    { $group: { _id: '$categoria_id', total: { $sum: 1 } } },
  ]);
  const categoriasSinModulos = categorias
    .filter((c) => !modulosPorCategoria.some((m) => m._id.toString() === c._id.toString()))
    .map((c) => ({ id: c._id, nombre: c.nombre }));

  const modulos = await Modulo.find({ tenant_id: tenantId, eliminado_at: null }).select('nombre');
  const moduloIds = modulos.map((m) => m._id);
  const requerimientosPorModulo = await Requerimiento.aggregate([
    { $match: { modulo_id: { $in: moduloIds }, eliminado_at: null } },
    { $group: { _id: '$modulo_id', total: { $sum: 1 } } },
  ]);
  const modulosSinRequerimientos = modulos
    .filter((m) => !requerimientosPorModulo.some((r) => r._id.toString() === m._id.toString()))
    .map((m) => ({ id: m._id, nombre: m.nombre }));

  return { estadosSinUso, prioridadesSinUso, categoriasSinModulos, modulosSinRequerimientos };
}

async function getCalidadObservaciones(tenantId) {
  const requerimientos = await Requerimiento.find({ tenant_id: tenantId, eliminado_at: null }).select('_id completado');
  const requerimientoIds = requerimientos.map((r) => r._id);
  const completados = requerimientos.filter((r) => r.completado);

  const conObs = await ObservacionRequerimiento.aggregate([
    { $match: { requerimiento_id: { $in: requerimientoIds } } },
    { $group: { _id: '$requerimiento_id', total: { $sum: 1 } } },
  ]);
  const obsPorRequerimiento = new Map(conObs.map((o) => [o._id.toString(), o.total]));
  const completadosSinObservaciones = completados.filter((r) => !obsPorRequerimiento.has(r._id.toString())).length;
  const totalObservaciones = conObs.reduce((acc, o) => acc + o.total, 0);

  return {
    totalCompletados: completados.length,
    completadosSinObservaciones,
    promedioObservacionesPorRequerimiento: requerimientos.length > 0 ? Math.round((totalObservaciones / requerimientos.length) * 10) / 10 : 0,
  };
}

async function getAuditoriaRequerimiento(tenantId, requerimientoId) {
  const transiciones = await HistorialEstado.find({
    tenant_id: tenantId,
    entidad: 'Requerimiento',
    entidad_id: requerimientoId,
  }).sort({ created_at: 1 });

  const estadosVisitados = new Set();
  let reversiones = 0;
  for (const t of transiciones) {
    if (t.estado_nuevo && estadosVisitados.has(t.estado_nuevo.toString())) reversiones++;
    if (t.estado_anterior) estadosVisitados.add(t.estado_anterior.toString());
  }

  return { transiciones, reversiones };
}

async function getMetricas(tenantId) {
  const [vencimientos, sinActividad, saludCatalogos, calidadObservaciones] = await Promise.all([
    getVencimientos(tenantId),
    getSinActividad(tenantId),
    getSaludCatalogos(tenantId),
    getCalidadObservaciones(tenantId),
  ]);

  return { vencimientos, sinActividad, saludCatalogos, calidadObservaciones };
}

module.exports = { getMetricas, getAuditoriaRequerimiento };
