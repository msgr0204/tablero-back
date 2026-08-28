const Visto = require('../models/Visto');
const Usuario = require('../models/Usuario');
const Requerimiento = require('../models/Requerimiento');
const idsIguales = require('../utils/idsIguales');

const MODELOS = { Requerimiento };

// Confirma (acuse de recibo) que el usuario vio una categoría/módulo de empresa.
// Valida que la entidad exista en el tenant y en ámbito empresa. Idempotente.
async function marcarVisto(tenantId, usuarioId, entidad, entidadId) {
  const Model = MODELOS[entidad];
  if (!Model) throw new Error('Entidad no válida');

  const doc = await Model.findOne({ _id: entidadId, tenant_id: tenantId, ambito: 'empresa' }).select('creado_por_id');
  if (!doc) throw new Error('No encontrado');
  // El creador no confirma lo suyo.
  if (doc.creado_por_id && idsIguales(doc.creado_por_id, usuarioId)) {
    return { yaEra: true };
  }

  await Visto.updateOne(
    { entidad, entidad_id: entidadId, usuario_id: usuarioId },
    { $setOnInsert: { tenant_id: tenantId, entidad, entidad_id: entidadId, usuario_id: usuarioId } },
    { upsert: true }
  );
  return { visto: true };
}

/**
 * Resumen de visto para un conjunto de entidades del mismo tipo. Devuelve un
 * mapa entidadId -> { vistos, total, loVi }. `total` = usuarios del tenant que
 * deben confirmar (todos menos el creador). Se calcula en lote para no hacer N
 * queries al listar.
 */
async function resumenPorEntidades(tenantId, usuarioId, entidad, docs) {
  const totalUsuarios = await Usuario.countDocuments({ tenant_id: tenantId });
  const ids = docs.map((d) => d._id);
  if (ids.length === 0) return new Map();

  const vistos = await Visto.find({ tenant_id: tenantId, entidad, entidad_id: { $in: ids } })
    .select('entidad_id usuario_id');

  const conteo = new Map();      // entidadId -> nº de vistos
  const loViSet = new Set();     // entidadIds que YO vi
  for (const v of vistos) {
    const key = v.entidad_id.toString();
    conteo.set(key, (conteo.get(key) ?? 0) + 1);
    if (idsIguales(v.usuario_id, usuarioId)) loViSet.add(key);
  }

  const resumen = new Map();
  for (const d of docs) {
    const key = d._id.toString();
    // El total excluye al creador (no confirma lo suyo); si no se conoce, todos.
    const total = d.creado_por_id ? Math.max(0, totalUsuarios - 1) : totalUsuarios;
    const esCreador = d.creado_por_id && idsIguales(d.creado_por_id, usuarioId);
    resumen.set(key, {
      vistos: conteo.get(key) ?? 0,
      total,
      loVi: esCreador || loViSet.has(key), // el creador cuenta como "no le aplica" -> lo tratamos como visto para no molestarlo
      esCreador: !!esCreador,
    });
  }
  return resumen;
}

// Detalle de trazabilidad: quiénes vieron y quiénes faltan (para el creador/todos).
async function detalle(tenantId, entidad, entidadId) {
  const Model = MODELOS[entidad];
  if (!Model) throw new Error('Entidad no válida');
  const doc = await Model.findOne({ _id: entidadId, tenant_id: tenantId, ambito: 'empresa' }).select('creado_por_id');
  if (!doc) throw new Error('No encontrado');

  const [usuarios, vistos] = await Promise.all([
    Usuario.find({ tenant_id: tenantId }).select('nombre email'),
    Visto.find({ tenant_id: tenantId, entidad, entidad_id: entidadId }).select('usuario_id visto_at'),
  ]);

  const vistoPorId = new Map(vistos.map((v) => [v.usuario_id.toString(), v.visto_at]));

  const relevantes = usuarios.filter((u) => !(doc.creado_por_id && idsIguales(doc.creado_por_id, u._id)));
  return relevantes.map((u) => ({
    id: u._id,
    nombre: u.nombre,
    email: u.email,
    visto: vistoPorId.has(u._id.toString()),
    visto_at: vistoPorId.get(u._id.toString()) ?? null,
  }));
}

module.exports = { marcarVisto, resumenPorEntidades, detalle };
