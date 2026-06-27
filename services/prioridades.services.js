const Prioridad = require('../models/Prioridad');
const Categoria = require('../models/Categoria');
const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const slugify = require('../utils/slugify');

async function contarUso(tenantId, prioridadId) {
  const [categorias, modulos, requerimientos] = await Promise.all([
    Categoria.countDocuments({ tenant_id: tenantId, prioridad: prioridadId }),
    Modulo.countDocuments({ tenant_id: tenantId, prioridad: prioridadId }),
    Requerimiento.countDocuments({ tenant_id: tenantId, prioridad: prioridadId }),
  ]);
  return categorias + modulos + requerimientos;
}

async function getAll(tenantId) {
  return Prioridad.find({ tenant_id: tenantId }).sort({ orden: 1 });
}

async function create(tenantId, { label, color }) {
  if (!label || !label.trim()) {
    throw new Error('El nombre de la prioridad es obligatorio');
  }
  const total = await Prioridad.countDocuments({ tenant_id: tenantId });
  return Prioridad.create({
    tenant_id: tenantId,
    value: slugify(label),
    label: label.trim(),
    color,
    orden: total,
  });
}

async function update(tenantId, id, payload) {
  const data = { ...payload };
  if ('label' in data) {
    if (!data.label || !data.label.trim()) {
      throw new Error('El nombre de la prioridad es obligatorio');
    }
    data.label = data.label.trim();
  }
  return Prioridad.findOneAndUpdate({ _id: id, tenant_id: tenantId }, data, { new: true });
}

async function remove(tenantId, id) {
  const prioridad = await Prioridad.findOne({ _id: id, tenant_id: tenantId });
  if (!prioridad) return null;

  const usos = await contarUso(tenantId, prioridad._id);
  if (usos > 0) {
    throw new Error(`No se puede eliminar: esta prioridad está en uso por ${usos} registro(s)`);
  }

  return Prioridad.findByIdAndDelete(id);
}

async function reorder(tenantId, orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) => Prioridad.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { orden: index }))
  );
  return getAll(tenantId);
}

module.exports = { getAll, create, update, remove, reorder };
