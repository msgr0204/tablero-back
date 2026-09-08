const Prioridad = require('../models/Prioridad');
const Categoria = require('../models/Categoria');
const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const slugify = require('../utils/slugify');
const calcularCambios = require('../utils/calcularCambios');
const { auditar, ACCIONES } = require('./auditoria.services');
const { exigir } = require('../utils/permisos');

function exigirGestionCatalogo(ctx) {
  // El catálogo es el vocabulario de TODO el tablero: renombrar un estado o
  // cambiar cuál cierra afecta a cada persona del equipo. Por eso en empresa lo
  // gestiona un administrador, y en un tablero personal solo su dueño.
  exigir(
    ctx.puedeGestionarCatalogo(),
    ctx.ambito === 'personal'
      ? 'Solo el dueño del tablero puede modificar su catálogo'
      : 'Solo un administrador puede modificar el catálogo de la empresa'
  );
}

async function contarUso(ctx, prioridadId) {
  const [categorias, modulos, requerimientos] = await Promise.all([
    Categoria.countDocuments({ ...ctx, prioridad: prioridadId, eliminado_at: null }),
    Modulo.countDocuments({ ...ctx, prioridad: prioridadId, eliminado_at: null }),
    Requerimiento.countDocuments({ ...ctx, prioridad: prioridadId, eliminado_at: null }),
  ]);
  return categorias + modulos + requerimientos;
}

async function getAll(ctx) {
  return Prioridad.find({ ...ctx, eliminado_at: null }).sort({ orden: 1 });
}

async function create(ctx, { label, color }) {
  exigirGestionCatalogo(ctx);
  if (!label || !label.trim()) {
    throw new Error('El nombre de la prioridad es obligatorio');
  }
  const total = await Prioridad.countDocuments({ ...ctx, eliminado_at: null });
  const prioridad = await Prioridad.create({
    ...ctx,
    value: slugify(label),
    label: label.trim(),
    color,
    orden: total,
  });

  await auditar(ctx, {
    accion: ACCIONES.CREAR,
    entidad: 'Prioridad',
    entidad_id: prioridad._id,
    entidad_nombre: prioridad.label,
  });

  return prioridad;
}

async function update(ctx, id, payload) {
  exigirGestionCatalogo(ctx);
  const data = { ...payload };
  if ('label' in data) {
    if (!data.label || !data.label.trim()) {
      throw new Error('El nombre de la prioridad es obligatorio');
    }
    data.label = data.label.trim();
  }
  // Se carga el anterior para poder registrar qué cambió exactamente.
  const anterior = await Prioridad.findOne({ ...ctx, _id: id, eliminado_at: null });
  const actualizado = await Prioridad.findOneAndUpdate({ ...ctx, _id: id }, data, { new: true });

  if (actualizado) {
    await auditar(ctx, {
      accion: ACCIONES.EDITAR,
      entidad: 'Prioridad',
      entidad_id: actualizado._id,
      entidad_nombre: actualizado.label,
      cambios: calcularCambios(anterior, data),
    });
  }

  return actualizado;
}

async function remove(ctx, id) {
  exigirGestionCatalogo(ctx);
  const prioridad = await Prioridad.findOne({ ...ctx, _id: id, eliminado_at: null });
  if (!prioridad) return null;

  const usos = await contarUso(ctx, prioridad._id);
  if (usos > 0) {
    throw new Error(`No se puede eliminar: esta prioridad está en uso por ${usos} registro(s)`);
  }

  // Soft delete: el catálogo borrado se conserva para que la auditoría y los
  // registros históricos que lo usaban sigan siendo legibles.
  const eliminado = await Prioridad.findOneAndUpdate({ ...ctx, _id: id }, { eliminado_at: new Date() }, { new: true });

  await auditar(ctx, {
    accion: ACCIONES.ELIMINAR,
    entidad: 'Prioridad',
    entidad_id: prioridad._id,
    entidad_nombre: prioridad.label,
    snapshot: { label: prioridad.label, color: prioridad.color },
  });

  return eliminado;
}

async function reorder(ctx, orderedIds) {
  exigirGestionCatalogo(ctx);
  await Promise.all(
    orderedIds.map((id, index) => Prioridad.findOneAndUpdate({ ...ctx, _id: id }, { orden: index }))
  );
  await auditar(ctx, {
    accion: ACCIONES.REORDENAR,
    entidad: 'Prioridad',
    entidad_nombre: `${orderedIds.length} elemento(s) del catálogo`,
  });

  return getAll(ctx);
}

module.exports = { getAll, create, update, remove, reorder };
