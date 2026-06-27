const Estado = require('../models/Estado');
const Categoria = require('../models/Categoria');
const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const slugify = require('../utils/slugify');

async function contarUso(tenantId, estadoId) {
  const [categorias, modulos, requerimientos] = await Promise.all([
    Categoria.countDocuments({ tenant_id: tenantId, estado: estadoId }),
    Modulo.countDocuments({ tenant_id: tenantId, estado: estadoId }),
    Requerimiento.countDocuments({ tenant_id: tenantId, estado: estadoId }),
  ]);
  return categorias + modulos + requerimientos;
}

async function getAll(tenantId) {
  return Estado.find({ tenant_id: tenantId }).sort({ orden: 1 });
}

async function create(tenantId, { label, color, es_estado_final }) {
  if (!label || !label.trim()) {
    throw new Error('El nombre del estado es obligatorio');
  }
  const total = await Estado.countDocuments({ tenant_id: tenantId });
  return Estado.create({
    tenant_id: tenantId,
    value: slugify(label),
    label: label.trim(),
    color,
    es_estado_final: !!es_estado_final,
    orden: total,
  });
}

async function update(tenantId, id, payload) {
  const data = { ...payload };
  if ('label' in data) {
    if (!data.label || !data.label.trim()) {
      throw new Error('El nombre del estado es obligatorio');
    }
    data.label = data.label.trim();
  }
  return Estado.findOneAndUpdate({ _id: id, tenant_id: tenantId }, data, { new: true });
}

async function remove(tenantId, id) {
  const estado = await Estado.findOne({ _id: id, tenant_id: tenantId });
  if (!estado) return null;

  const total = await Estado.countDocuments({ tenant_id: tenantId });
  if (total <= 1) {
    throw new Error('Debe existir al menos un estado');
  }

  const usos = await contarUso(tenantId, estado._id);
  if (usos > 0) {
    throw new Error(`No se puede eliminar: este estado está en uso por ${usos} registro(s)`);
  }

  return Estado.findByIdAndDelete(id);
}

async function reorder(tenantId, orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) => Estado.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { orden: index }))
  );
  return getAll(tenantId);
}

module.exports = { getAll, create, update, remove, reorder };
