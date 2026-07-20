const Tipo = require('../models/Tipo');
const Requerimiento = require('../models/Requerimiento');
const slugify = require('../utils/slugify');

async function contarUso(tenantId, tipoId) {
  return Requerimiento.countDocuments({ tenant_id: tenantId, tipo: tipoId });
}

async function getAll(tenantId) {
  return Tipo.find({ tenant_id: tenantId }).sort({ orden: 1 });
}

async function create(tenantId, { label, color }) {
  if (!label || !label.trim()) {
    throw new Error('El nombre del tipo es obligatorio');
  }
  const total = await Tipo.countDocuments({ tenant_id: tenantId });
  return Tipo.create({
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
      throw new Error('El nombre del tipo es obligatorio');
    }
    data.label = data.label.trim();
  }
  return Tipo.findOneAndUpdate({ _id: id, tenant_id: tenantId }, data, { new: true });
}

async function remove(tenantId, id) {
  const tipo = await Tipo.findOne({ _id: id, tenant_id: tenantId });
  if (!tipo) return null;

  const usos = await contarUso(tenantId, tipo._id);
  if (usos > 0) {
    throw new Error(`No se puede eliminar: este tipo está en uso por ${usos} registro(s)`);
  }

  return Tipo.findByIdAndDelete(id);
}

async function reorder(tenantId, orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) => Tipo.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { orden: index }))
  );
  return getAll(tenantId);
}

module.exports = { getAll, create, update, remove, reorder };
