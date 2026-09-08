const Tipo = require('../models/Tipo');
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

async function contarUso(ctx, tipoId) {
  return Requerimiento.countDocuments({ ...ctx, tipo: tipoId, eliminado_at: null });
}

async function getAll(ctx) {
  return Tipo.find({ ...ctx, eliminado_at: null }).sort({ orden: 1 });
}

async function create(ctx, { label, color }) {
  exigirGestionCatalogo(ctx);
  if (!label || !label.trim()) {
    throw new Error('El nombre del tipo es obligatorio');
  }
  const total = await Tipo.countDocuments({ ...ctx, eliminado_at: null });
  const tipo = await Tipo.create({
    ...ctx,
    value: slugify(label),
    label: label.trim(),
    color,
    orden: total,
  });

  await auditar(ctx, {
    accion: ACCIONES.CREAR,
    entidad: 'Tipo',
    entidad_id: tipo._id,
    entidad_nombre: tipo.label,
  });

  return tipo;
}

async function update(ctx, id, payload) {
  exigirGestionCatalogo(ctx);
  const data = { ...payload };
  if ('label' in data) {
    if (!data.label || !data.label.trim()) {
      throw new Error('El nombre del tipo es obligatorio');
    }
    data.label = data.label.trim();
  }
  // Se carga el anterior para poder registrar qué cambió exactamente.
  const anterior = await Tipo.findOne({ ...ctx, _id: id, eliminado_at: null });
  const actualizado = await Tipo.findOneAndUpdate({ ...ctx, _id: id }, data, { new: true });

  if (actualizado) {
    await auditar(ctx, {
      accion: ACCIONES.EDITAR,
      entidad: 'Tipo',
      entidad_id: actualizado._id,
      entidad_nombre: actualizado.label,
      cambios: calcularCambios(anterior, data),
    });
  }

  return actualizado;
}

async function remove(ctx, id) {
  exigirGestionCatalogo(ctx);
  const tipo = await Tipo.findOne({ ...ctx, _id: id, eliminado_at: null });
  if (!tipo) return null;

  const usos = await contarUso(ctx, tipo._id);
  if (usos > 0) {
    throw new Error(`No se puede eliminar: este tipo está en uso por ${usos} registro(s)`);
  }

  // Soft delete: el catálogo borrado se conserva para que la auditoría y los
  // registros históricos que lo usaban sigan siendo legibles.
  const eliminado = await Tipo.findOneAndUpdate({ ...ctx, _id: id }, { eliminado_at: new Date() }, { new: true });

  await auditar(ctx, {
    accion: ACCIONES.ELIMINAR,
    entidad: 'Tipo',
    entidad_id: tipo._id,
    entidad_nombre: tipo.label,
    snapshot: { label: tipo.label, color: tipo.color },
  });

  return eliminado;
}

async function reorder(ctx, orderedIds) {
  exigirGestionCatalogo(ctx);
  await Promise.all(
    orderedIds.map((id, index) => Tipo.findOneAndUpdate({ ...ctx, _id: id }, { orden: index }))
  );
  await auditar(ctx, {
    accion: ACCIONES.REORDENAR,
    entidad: 'Tipo',
    entidad_nombre: `${orderedIds.length} elemento(s) del catálogo`,
  });

  return getAll(ctx);
}

module.exports = { getAll, create, update, remove, reorder };
