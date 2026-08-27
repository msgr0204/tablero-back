const Tipo = require('../models/Tipo');
const Requerimiento = require('../models/Requerimiento');
const slugify = require('../utils/slugify');

async function contarUso(ctx, tipoId) {
  return Requerimiento.countDocuments({ ...ctx, tipo: tipoId });
}

async function getAll(ctx) {
  return Tipo.find({ ...ctx }).sort({ orden: 1 });
}

async function create(ctx, { label, color }) {
  if (!label || !label.trim()) {
    throw new Error('El nombre del tipo es obligatorio');
  }
  const total = await Tipo.countDocuments({ ...ctx });
  return Tipo.create({
    ...ctx,
    value: slugify(label),
    label: label.trim(),
    color,
    orden: total,
  });
}

async function update(ctx, id, payload) {
  const data = { ...payload };
  if ('label' in data) {
    if (!data.label || !data.label.trim()) {
      throw new Error('El nombre del tipo es obligatorio');
    }
    data.label = data.label.trim();
  }
  return Tipo.findOneAndUpdate({ ...ctx, _id: id }, data, { new: true });
}

async function remove(ctx, id) {
  const tipo = await Tipo.findOne({ ...ctx, _id: id });
  if (!tipo) return null;

  const usos = await contarUso(ctx, tipo._id);
  if (usos > 0) {
    throw new Error(`No se puede eliminar: este tipo está en uso por ${usos} registro(s)`);
  }

  return Tipo.findOneAndDelete({ ...ctx, _id: id });
}

async function reorder(ctx, orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) => Tipo.findOneAndUpdate({ ...ctx, _id: id }, { orden: index }))
  );
  return getAll(ctx);
}

module.exports = { getAll, create, update, remove, reorder };
