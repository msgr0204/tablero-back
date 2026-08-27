const Usuario = require('../models/Usuario');
const ColaboradorTablero = require('../models/ColaboradorTablero');
const idsIguales = require('../utils/idsIguales');

/**
 * Gestión de colaboradores del tablero personal. El dueño de un tablero decide
 * qué usuarios del mismo tenant tienen acceso directo a él. El acceso es
 * unidireccional y se resuelve siempre contra el usuario autenticado como
 * propietario — nunca se administra el tablero de un tercero desde aquí.
 */

/**
 * Lista los usuarios del tenant (excepto el propio dueño) con un flag de si ya
 * tienen acceso al tablero del dueño. Alimenta el modal "Equipo".
 */
async function listarEquipo(tenantId, propietarioId) {
  const [usuarios, accesos] = await Promise.all([
    Usuario.find({ tenant_id: tenantId }).select('nombre email rol').sort({ nombre: 1 }),
    ColaboradorTablero.find({ tenant_id: tenantId, propietario_id: propietarioId }).select('colaborador_id'),
  ]);

  const conAcceso = new Set(accesos.map((a) => a.colaborador_id.toString()));

  return usuarios
    .filter((u) => !idsIguales(u._id, propietarioId))
    .map((u) => ({
      id: u._id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      tieneAcceso: conAcceso.has(u._id.toString()),
    }));
}

/**
 * Concede acceso al tablero del dueño a un colaborador del mismo tenant.
 * Idempotente (índice único evita duplicados). Valida que el colaborador exista
 * en el tenant y que no sea el propio dueño.
 */
async function concederAcceso(tenantId, propietarioId, colaboradorId) {
  if (idsIguales(colaboradorId, propietarioId)) {
    throw new Error('No puedes agregarte a ti mismo');
  }
  const colaborador = await Usuario.findOne({ _id: colaboradorId, tenant_id: tenantId });
  if (!colaborador) {
    throw new Error('Usuario no encontrado en tu empresa');
  }
  await ColaboradorTablero.updateOne(
    { tenant_id: tenantId, propietario_id: propietarioId, colaborador_id: colaboradorId },
    { $setOnInsert: { tenant_id: tenantId, propietario_id: propietarioId, colaborador_id: colaboradorId } },
    { upsert: true }
  );
  return { id: colaboradorId, tieneAcceso: true };
}

/**
 * Revoca el acceso de un colaborador al tablero del dueño.
 */
async function revocarAcceso(tenantId, propietarioId, colaboradorId) {
  await ColaboradorTablero.deleteOne({
    tenant_id: tenantId,
    propietario_id: propietarioId,
    colaborador_id: colaboradorId,
  });
  return { id: colaboradorId, tieneAcceso: false };
}

/**
 * Tableros a los que el usuario tiene acceso como colaborador (para el selector
 * "¿qué tablero estoy viendo?"). Devuelve el dueño de cada uno con su nombre.
 */
async function tablerosCompartidosConmigo(tenantId, colaboradorId) {
  const accesos = await ColaboradorTablero.find({ tenant_id: tenantId, colaborador_id: colaboradorId })
    .select('propietario_id')
    .sort({ created_at: 1 });

  const propietarioIds = accesos.map((a) => a.propietario_id);
  if (propietarioIds.length === 0) return [];

  const propietarios = await Usuario.find({ _id: { $in: propietarioIds }, tenant_id: tenantId }).select('nombre email');
  const porId = new Map(propietarios.map((u) => [u._id.toString(), u]));

  return propietarioIds
    .map((pid) => porId.get(pid.toString()))
    .filter(Boolean)
    .map((u) => ({ ownerId: u._id, nombre: u.nombre, email: u.email }));
}

module.exports = { listarEquipo, concederAcceso, revocarAcceso, tablerosCompartidosConmigo };
