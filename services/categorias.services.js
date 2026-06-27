const Categoria = require('../models/Categoria');
const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const Estado = require('../models/Estado');
const notificacionesService = require('./notificaciones.services');
const historialService = require('./historial.services');
const hayCambiosReales = require('../utils/hayCambiosReales');
const idsIguales = require('../utils/idsIguales');

async function resolverPrioridad(tenantId, estado, prioridad) {
  if (!estado) return prioridad ?? null;
  const estadoDoc = await Estado.findOne({ _id: estado, tenant_id: tenantId });
  if (estadoDoc?.es_estado_final) return null;
  return prioridad ?? null;
}

async function withCounts(categorias) {
  const lista = Array.isArray(categorias) ? categorias : [categorias];
  const result = await Promise.all(
    lista.map(async (cat) => {
      const modulos = await Modulo.find({ categoria_id: cat._id, eliminado_at: null }).select('_id');
      const moduloIds = modulos.map((m) => m._id);
      const totalRequerimientos = await Requerimiento.countDocuments({ modulo_id: { $in: moduloIds }, eliminado_at: null });
      return {
        ...cat.toObject(),
        totalModulos: modulos.length,
        totalRequerimientos,
      };
    })
  );
  return Array.isArray(categorias) ? result : result[0];
}

async function getAll(tenantId) {
  const categorias = await Categoria.find({ tenant_id: tenantId, eliminado_at: null }).sort({ orden: 1 });
  return withCounts(categorias);
}

async function getById(tenantId, id) {
  const categoria = await Categoria.findOne({ _id: id, tenant_id: tenantId, eliminado_at: null });
  if (!categoria) return null;
  return withCounts(categoria);
}

async function create(tenantId, payload) {
  if (!payload.nombre || !payload.nombre.trim()) {
    throw new Error('El nombre de la categoría es obligatorio');
  }
  const total = await Categoria.countDocuments({ tenant_id: tenantId });
  const prioridad = await resolverPrioridad(tenantId, payload.estado, payload.prioridad);
  const categoria = await Categoria.create({ ...payload, tenant_id: tenantId, prioridad, orden: total });

  await notificacionesService.crear(
    tenantId,
    'categoria_creada',
    `Se creó la categoría "${categoria.nombre}"`,
    'Categoria',
    categoria._id
  );

  return withCounts(categoria);
}

async function update(tenantId, id, payload) {
  const anterior = await Categoria.findOne({ _id: id, tenant_id: tenantId });
  if (!anterior) return null;

  const data = { ...payload };
  if ('nombre' in data && !data.nombre.trim()) {
    throw new Error('El nombre de la categoría es obligatorio');
  }
  if ('estado' in data) {
    data.prioridad = await resolverPrioridad(tenantId, data.estado, data.prioridad);
  }

  if (!hayCambiosReales(anterior, data)) {
    return withCounts(anterior);
  }

  const categoria = await Categoria.findOneAndUpdate({ _id: id, tenant_id: tenantId }, data, { new: true });
  if (!categoria) return null;

  if ('estado' in data && !idsIguales(data.estado, anterior.estado)) {
    await historialService.registrar(tenantId, 'Categoria', categoria._id, anterior.estado, categoria.estado);
    await notificacionesService.crear(
      tenantId,
      'categoria_estado_cambiado',
      `La categoría "${categoria.nombre}" cambió de estado`,
      'Categoria',
      categoria._id
    );
  } else {
    await notificacionesService.crear(
      tenantId,
      'categoria_editada',
      `Se editó la categoría "${categoria.nombre}"`,
      'Categoria',
      categoria._id
    );
  }

  return withCounts(categoria);
}

async function remove(tenantId, id) {
  const categoria = await Categoria.findOne({ _id: id, tenant_id: tenantId });
  if (!categoria) return null;

  const modulos = await Modulo.find({ categoria_id: id }).select('_id');
  const moduloIds = modulos.map((m) => m._id);

  const eliminado_at = new Date();
  await Promise.all([
    Requerimiento.updateMany({ modulo_id: { $in: moduloIds } }, { eliminado_at }),
    Modulo.updateMany({ categoria_id: id }, { eliminado_at }),
  ]);

  const eliminada = await Categoria.findByIdAndUpdate(id, { eliminado_at }, { new: true });

  await notificacionesService.crear(
    tenantId,
    'categoria_eliminada',
    `Se eliminó la categoría "${categoria.nombre}"`,
    'Categoria',
    categoria._id
  );

  return eliminada;
}

async function reorder(tenantId, orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) => Categoria.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { orden: index }))
  );
  return getAll(tenantId);
}

module.exports = { getAll, getById, create, update, remove, reorder };
