const Prioridad = require('../models/Prioridad');
const Categoria = require('../models/Categoria');
const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const slugify = require('../utils/slugify');

// El catálogo del tablero personal solo lo gestiona su dueño; un colaborador lo
// usa pero no lo edita. En empresa no aplica esta restricción.
function exigirDueno(ctx) {
  if (!ctx.puedeGestionarCatalogo()) {
    throw new Error('Solo el dueño del tablero puede modificar su catálogo');
  }
}

async function contarUso(ctx, prioridadId) {
  const [categorias, modulos, requerimientos] = await Promise.all([
    Categoria.countDocuments({ ...ctx, prioridad: prioridadId }),
    Modulo.countDocuments({ ...ctx, prioridad: prioridadId }),
    Requerimiento.countDocuments({ ...ctx, prioridad: prioridadId }),
  ]);
  return categorias + modulos + requerimientos;
}

async function getAll(ctx) {
  return Prioridad.find({ ...ctx }).sort({ orden: 1 });
}

async function create(ctx, { label, color }) {
  exigirDueno(ctx);
  if (!label || !label.trim()) {
    throw new Error('El nombre de la prioridad es obligatorio');
  }
  const total = await Prioridad.countDocuments({ ...ctx });
  return Prioridad.create({
    ...ctx,
    value: slugify(label),
    label: label.trim(),
    color,
    orden: total,
  });
}

async function update(ctx, id, payload) {
  exigirDueno(ctx);
  const data = { ...payload };
  if ('label' in data) {
    if (!data.label || !data.label.trim()) {
      throw new Error('El nombre de la prioridad es obligatorio');
    }
    data.label = data.label.trim();
  }
  return Prioridad.findOneAndUpdate({ ...ctx, _id: id }, data, { new: true });
}

async function remove(ctx, id) {
  exigirDueno(ctx);
  const prioridad = await Prioridad.findOne({ ...ctx, _id: id });
  if (!prioridad) return null;

  const usos = await contarUso(ctx, prioridad._id);
  if (usos > 0) {
    throw new Error(`No se puede eliminar: esta prioridad está en uso por ${usos} registro(s)`);
  }

  return Prioridad.findOneAndDelete({ ...ctx, _id: id });
}

async function reorder(ctx, orderedIds) {
  exigirDueno(ctx);
  await Promise.all(
    orderedIds.map((id, index) => Prioridad.findOneAndUpdate({ ...ctx, _id: id }, { orden: index }))
  );
  return getAll(ctx);
}

module.exports = { getAll, create, update, remove, reorder };
