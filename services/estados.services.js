const Estado = require('../models/Estado');
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

async function contarUso(ctx, estadoId) {
  const [categorias, modulos, requerimientos] = await Promise.all([
    Categoria.countDocuments({ ...ctx, estado: estadoId }),
    Modulo.countDocuments({ ...ctx, estado: estadoId }),
    Requerimiento.countDocuments({ ...ctx, estado: estadoId }),
  ]);
  return categorias + modulos + requerimientos;
}

async function getAll(ctx) {
  return Estado.find({ ...ctx }).sort({ orden: 1 });
}

async function create(ctx, { label, color, es_estado_final }) {
  exigirDueno(ctx);
  if (!label || !label.trim()) {
    throw new Error('El nombre del estado es obligatorio');
  }
  const total = await Estado.countDocuments({ ...ctx });
  return Estado.create({
    ...ctx,
    value: slugify(label),
    label: label.trim(),
    color,
    es_estado_final: !!es_estado_final,
    orden: total,
  });
}

async function update(ctx, id, payload) {
  exigirDueno(ctx);
  const data = { ...payload };
  if ('label' in data) {
    if (!data.label || !data.label.trim()) {
      throw new Error('El nombre del estado es obligatorio');
    }
    data.label = data.label.trim();
  }
  return Estado.findOneAndUpdate({ ...ctx, _id: id }, data, { new: true });
}

async function remove(ctx, id) {
  exigirDueno(ctx);
  const estado = await Estado.findOne({ ...ctx, _id: id });
  if (!estado) return null;

  const total = await Estado.countDocuments({ ...ctx });
  if (total <= 1) {
    throw new Error('Debe existir al menos un estado');
  }

  const usos = await contarUso(ctx, estado._id);
  if (usos > 0) {
    throw new Error(`No se puede eliminar: este estado está en uso por ${usos} registro(s)`);
  }

  return Estado.findOneAndDelete({ ...ctx, _id: id });
}

async function reorder(ctx, orderedIds) {
  exigirDueno(ctx);
  await Promise.all(
    orderedIds.map((id, index) => Estado.findOneAndUpdate({ ...ctx, _id: id }, { orden: index }))
  );
  return getAll(ctx);
}

module.exports = { getAll, create, update, remove, reorder };
