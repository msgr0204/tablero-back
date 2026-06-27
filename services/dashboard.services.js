const Categoria = require('../models/Categoria');
const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const Estado = require('../models/Estado');
const Prioridad = require('../models/Prioridad');
const HistorialEstado = require('../models/HistorialEstado');

async function resolverModuloIds(tenantId, categoriaId) {
  if (!categoriaId) return null;
  const modulos = await Modulo.find({ tenant_id: tenantId, categoria_id: categoriaId, eliminado_at: null }).select('_id');
  return modulos.map((m) => m._id);
}

function buildFiltroRequerimientos(tenantId, moduloIds) {
  const filtro = { tenant_id: tenantId, eliminado_at: null };
  if (moduloIds) filtro.modulo_id = { $in: moduloIds };
  return filtro;
}

async function getResumen(tenantId, categoriaId) {
  const moduloIds = await resolverModuloIds(tenantId, categoriaId);
  const filtro = buildFiltroRequerimientos(tenantId, moduloIds);

  const [abiertos, cerrados, vencidos, proximos] = await Promise.all([
    Requerimiento.countDocuments({ ...filtro, completado: false }),
    Requerimiento.countDocuments({ ...filtro, completado: true }),
    Requerimiento.countDocuments({ ...filtro, completado: false, fecha_entrega: { $lt: new Date() } }),
    Requerimiento.countDocuments({
      ...filtro,
      completado: false,
      fecha_entrega: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    }),
  ]);

  const total = abiertos + cerrados;
  const avance = total > 0 ? Math.round((cerrados / total) * 100) : 0;

  const tiempoPromedio = await Requerimiento.aggregate([
    { $match: { ...filtro, completado: true, completado_at: { $ne: null } } },
    { $project: { diasRespuesta: { $divide: [{ $subtract: ['$completado_at', '$created_at'] }, 1000 * 60 * 60 * 24] } } },
    { $group: { _id: null, promedio: { $avg: '$diasRespuesta' } } },
  ]);

  return {
    abiertos,
    cerrados,
    vencidos,
    proximosAVencer: proximos,
    avancePorcentaje: avance,
    tiempoPromedioRespuestaDias: tiempoPromedio[0] ? Math.round(tiempoPromedio[0].promedio * 10) / 10 : null,
  };
}

async function getDistribucionPorEstado(tenantId, categoriaId) {
  const moduloIds = await resolverModuloIds(tenantId, categoriaId);
  const filtro = buildFiltroRequerimientos(tenantId, moduloIds);

  const conteos = await Requerimiento.aggregate([
    { $match: filtro },
    { $group: { _id: '$estado', total: { $sum: 1 } } },
  ]);

  const estados = await Estado.find({ tenant_id: tenantId }).sort({ orden: 1 });
  return estados.map((estado) => ({
    estadoId: estado._id,
    label: estado.label,
    color: estado.color,
    total: conteos.find((c) => c._id?.toString() === estado._id.toString())?.total ?? 0,
  }));
}

async function getDistribucionPorPrioridad(tenantId, categoriaId) {
  const moduloIds = await resolverModuloIds(tenantId, categoriaId);
  const filtro = buildFiltroRequerimientos(tenantId, moduloIds);

  const conteos = await Requerimiento.aggregate([
    { $match: filtro },
    { $group: { _id: '$prioridad', total: { $sum: 1 } } },
  ]);

  const prioridades = await Prioridad.find({ tenant_id: tenantId }).sort({ orden: 1 });
  return prioridades.map((prioridad) => ({
    prioridadId: prioridad._id,
    label: prioridad.label,
    color: prioridad.color,
    total: conteos.find((c) => c._id?.toString() === prioridad._id.toString())?.total ?? 0,
  }));
}

async function getCargaPorCategoria(tenantId) {
  const categorias = await Categoria.find({ tenant_id: tenantId, eliminado_at: null }).sort({ orden: 1 });

  return Promise.all(
    categorias.map(async (categoria) => {
      const moduloIds = await resolverModuloIds(tenantId, categoria._id);
      const filtro = buildFiltroRequerimientos(tenantId, moduloIds);
      const [total, completados] = await Promise.all([
        Requerimiento.countDocuments(filtro),
        Requerimiento.countDocuments({ ...filtro, completado: true }),
      ]);
      return { categoriaId: categoria._id, nombre: categoria.nombre, total, completados };
    })
  );
}

async function getEvolucionSemanal(tenantId, categoriaId, semanas = 12) {
  const moduloIds = await resolverModuloIds(tenantId, categoriaId);
  const desde = new Date(Date.now() - semanas * 7 * 24 * 60 * 60 * 1000);

  const filtroCreados = buildFiltroRequerimientos(tenantId, moduloIds);
  const creadosPorSemana = await Requerimiento.aggregate([
    { $match: { ...filtroCreados, created_at: { $gte: desde } } },
    { $group: { _id: { $dateTrunc: { date: '$created_at', unit: 'week' } }, total: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const completadosPorSemana = await Requerimiento.aggregate([
    { $match: { ...filtroCreados, completado: true, completado_at: { $gte: desde } } },
    { $group: { _id: { $dateTrunc: { date: '$completado_at', unit: 'week' } }, total: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const semanasMap = new Map();
  for (const { _id, total } of creadosPorSemana) {
    semanasMap.set(_id.toISOString(), { semana: _id, creados: total, completados: 0 });
  }
  for (const { _id, total } of completadosPorSemana) {
    const key = _id.toISOString();
    if (!semanasMap.has(key)) semanasMap.set(key, { semana: _id, creados: 0, completados: 0 });
    semanasMap.get(key).completados = total;
  }

  return [...semanasMap.values()].sort((a, b) => a.semana - b.semana);
}

async function getTiempoPromedioPorEstado(tenantId, categoriaId) {
  const moduloIds = await resolverModuloIds(tenantId, categoriaId);
  const entidadIds = moduloIds
    ? await Requerimiento.find({ modulo_id: { $in: moduloIds } }).select('_id').then((lista) => lista.map((r) => r._id))
    : null;

  const filtro = { tenant_id: tenantId, entidad: 'Requerimiento' };
  if (entidadIds) filtro.entidad_id = { $in: entidadIds };

  const transiciones = await HistorialEstado.find(filtro).sort({ entidad_id: 1, created_at: 1 });

  const duracionesPorEstado = new Map();
  const ultimaTransicionPorEntidad = new Map();

  for (const transicion of transiciones) {
    const entidadKey = transicion.entidad_id.toString();
    const previa = ultimaTransicionPorEntidad.get(entidadKey);
    if (previa && previa.estado_nuevo) {
      const estadoKey = previa.estado_nuevo.toString();
      const dias = (transicion.created_at - previa.created_at) / (1000 * 60 * 60 * 24);
      if (!duracionesPorEstado.has(estadoKey)) duracionesPorEstado.set(estadoKey, []);
      duracionesPorEstado.get(estadoKey).push(dias);
    }
    ultimaTransicionPorEntidad.set(entidadKey, transicion);
  }

  const estados = await Estado.find({ tenant_id: tenantId }).sort({ orden: 1 });
  return estados.map((estado) => {
    const duraciones = duracionesPorEstado.get(estado._id.toString()) ?? [];
    const promedio = duraciones.length > 0 ? duraciones.reduce((a, b) => a + b, 0) / duraciones.length : null;
    return {
      estadoId: estado._id,
      label: estado.label,
      color: estado.color,
      diasPromedio: promedio !== null ? Math.round(promedio * 10) / 10 : null,
    };
  });
}

async function getDashboard(tenantId, categoriaId) {
  const [resumen, porEstado, porPrioridad, porCategoria, evolucionSemanal, tiempoPorEstado] = await Promise.all([
    getResumen(tenantId, categoriaId),
    getDistribucionPorEstado(tenantId, categoriaId),
    getDistribucionPorPrioridad(tenantId, categoriaId),
    categoriaId ? Promise.resolve([]) : getCargaPorCategoria(tenantId),
    getEvolucionSemanal(tenantId, categoriaId),
    getTiempoPromedioPorEstado(tenantId, categoriaId),
  ]);

  return { resumen, porEstado, porPrioridad, porCategoria, evolucionSemanal, tiempoPorEstado };
}

module.exports = { getDashboard };
