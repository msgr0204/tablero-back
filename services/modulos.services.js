const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const ObservacionModulo = require('../models/ObservacionModulo');
const ObservacionRequerimiento = require('../models/ObservacionRequerimiento');
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

async function attachNested(modulo) {
  const requerimientos = await Requerimiento.find({ modulo_id: modulo._id, eliminado_at: null }).sort({ orden: 1 });
  const requerimientosConObs = await Promise.all(
    requerimientos.map(async (r) => {
      const observaciones = await ObservacionRequerimiento.find({ requerimiento_id: r._id }).sort({ fecha: 1 });
      return { ...r.toObject(), observaciones };
    })
  );
  const observaciones = await ObservacionModulo.find({ modulo_id: modulo._id }).sort({ fecha: 1 });
  return { ...modulo.toObject(), requerimientos: requerimientosConObs, observaciones };
}

async function getByCategory(tenantId, categoriaId) {
  const modulos = await Modulo.find({ tenant_id: tenantId, categoria_id: categoriaId, eliminado_at: null }).sort({ orden: 1 });
  return Promise.all(modulos.map(attachNested));
}

async function getById(tenantId, id) {
  const modulo = await Modulo.findOne({ _id: id, tenant_id: tenantId, eliminado_at: null });
  if (!modulo) return null;
  return attachNested(modulo);
}

async function create(tenantId, categoriaId, payload) {
  if (!payload.nombre || !payload.nombre.trim()) {
    throw new Error('El nombre del módulo es obligatorio');
  }
  const total = await Modulo.countDocuments({ categoria_id: categoriaId });
  const prioridad = await resolverPrioridad(tenantId, payload.estado, payload.prioridad);
  const modulo = await Modulo.create({ ...payload, tenant_id: tenantId, prioridad, categoria_id: categoriaId, orden: total });

  await notificacionesService.crear(
    tenantId,
    'modulo_creado',
    `Se creó el módulo "${modulo.nombre}"`,
    'Modulo',
    modulo._id
  );

  return attachNested(modulo);
}

async function updateDetail(tenantId, id, payload) {
  const anterior = await Modulo.findOne({ _id: id, tenant_id: tenantId });
  if (!anterior) return null;

  const data = { ...payload };
  if ('nombre' in data && !data.nombre.trim()) {
    throw new Error('El nombre del módulo es obligatorio');
  }
  if ('estado' in data) {
    data.prioridad = await resolverPrioridad(tenantId, data.estado, data.prioridad);
  }

  if (!hayCambiosReales(anterior, data)) {
    return attachNested(anterior);
  }

  const modulo = await Modulo.findOneAndUpdate({ _id: id, tenant_id: tenantId }, data, { new: true });
  if (!modulo) return null;

  if ('estado' in data && !idsIguales(data.estado, anterior.estado)) {
    await historialService.registrar(tenantId, 'Modulo', modulo._id, anterior.estado, modulo.estado);
    await notificacionesService.crear(
      tenantId,
      'modulo_estado_cambiado',
      `El módulo "${modulo.nombre}" cambió de estado`,
      'Modulo',
      modulo._id
    );
  } else {
    await notificacionesService.crear(
      tenantId,
      'modulo_editado',
      `Se editó el módulo "${modulo.nombre}"`,
      'Modulo',
      modulo._id
    );
  }

  return attachNested(modulo);
}

async function remove(tenantId, id) {
  const modulo = await Modulo.findOne({ _id: id, tenant_id: tenantId });
  if (!modulo) return null;

  const eliminado_at = new Date();
  await Requerimiento.updateMany({ modulo_id: id }, { eliminado_at });
  const eliminado = await Modulo.findByIdAndUpdate(id, { eliminado_at }, { new: true });

  await notificacionesService.crear(
    tenantId,
    'modulo_eliminado',
    `Se eliminó el módulo "${modulo.nombre}"`,
    'Modulo',
    modulo._id
  );

  return eliminado;
}

async function reorder(tenantId, categoriaId, orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) => Modulo.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { orden: index }))
  );
  return getByCategory(tenantId, categoriaId);
}

module.exports = { getByCategory, getById, create, updateDetail, remove, reorder };
