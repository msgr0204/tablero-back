const Estado = require('../models/Estado');
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

async function contarUso(ctx, estadoId) {
  const [categorias, modulos, requerimientos] = await Promise.all([
    Categoria.countDocuments({ ...ctx, estado: estadoId, eliminado_at: null }),
    Modulo.countDocuments({ ...ctx, estado: estadoId, eliminado_at: null }),
    Requerimiento.countDocuments({ ...ctx, estado: estadoId, eliminado_at: null }),
  ]);
  return categorias + modulos + requerimientos;
}

async function getAll(ctx) {
  return Estado.find({ ...ctx, eliminado_at: null }).sort({ orden: 1 });
}

async function create(ctx, { label, color, es_estado_final }) {
  exigirGestionCatalogo(ctx);
  if (!label || !label.trim()) {
    throw new Error('El nombre del estado es obligatorio');
  }
  const total = await Estado.countDocuments({ ...ctx, eliminado_at: null });
  const estado = await Estado.create({
    ...ctx,
    value: slugify(label),
    label: label.trim(),
    color,
    es_estado_final: !!es_estado_final,
    orden: total,
  });

  await auditar(ctx, {
    accion: ACCIONES.CREAR,
    entidad: 'Estado',
    entidad_id: estado._id,
    entidad_nombre: estado.label,
  });

  return estado;
}

async function update(ctx, id, payload) {
  exigirGestionCatalogo(ctx);
  const data = { ...payload };
  if ('label' in data) {
    if (!data.label || !data.label.trim()) {
      throw new Error('El nombre del estado es obligatorio');
    }
    data.label = data.label.trim();
  }
  // Se carga el anterior para poder registrar qué cambió exactamente.
  const anterior = await Estado.findOne({ ...ctx, _id: id, eliminado_at: null });
  const actualizado = await Estado.findOneAndUpdate({ ...ctx, _id: id }, data, { new: true });

  if (actualizado) {
    await auditar(ctx, {
      accion: ACCIONES.EDITAR,
      entidad: 'Estado',
      entidad_id: actualizado._id,
      entidad_nombre: actualizado.label,
      cambios: calcularCambios(anterior, data),
    });
  }

  return actualizado;
}

async function remove(ctx, id) {
  exigirGestionCatalogo(ctx);
  const estado = await Estado.findOne({ ...ctx, _id: id, eliminado_at: null });
  if (!estado) return null;

  const total = await Estado.countDocuments({ ...ctx, eliminado_at: null });
  if (total <= 1) {
    throw new Error('Debe existir al menos un estado');
  }

  const usos = await contarUso(ctx, estado._id);
  if (usos > 0) {
    throw new Error(`No se puede eliminar: este estado está en uso por ${usos} registro(s)`);
  }

  // Soft delete: el catálogo borrado se conserva para que la auditoría y los
  // registros históricos que lo usaban sigan siendo legibles.
  const eliminado = await Estado.findOneAndUpdate({ ...ctx, _id: id }, { eliminado_at: new Date() }, { new: true });

  await auditar(ctx, {
    accion: ACCIONES.ELIMINAR,
    entidad: 'Estado',
    entidad_id: estado._id,
    entidad_nombre: estado.label,
    snapshot: { label: estado.label, color: estado.color },
  });

  return eliminado;
}

async function reorder(ctx, orderedIds) {
  exigirGestionCatalogo(ctx);
  await Promise.all(
    orderedIds.map((id, index) => Estado.findOneAndUpdate({ ...ctx, _id: id }, { orden: index }))
  );
  await auditar(ctx, {
    accion: ACCIONES.REORDENAR,
    entidad: 'Estado',
    entidad_nombre: `${orderedIds.length} elemento(s) del catálogo`,
  });

  return getAll(ctx);
}

module.exports = { getAll, create, update, remove, reorder };
