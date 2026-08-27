const Estado = require('../models/Estado');
const Prioridad = require('../models/Prioridad');
const Tipo = require('../models/Tipo');

/**
 * Clona los catálogos de la empresa (estados, prioridades, tipos) al ámbito
 * personal de un usuario, la primera vez que abre su tablero personal. Las
 * copias son independientes: a partir de aquí el usuario las edita sin afectar
 * los catálogos de la empresa, y viceversa.
 *
 * Idempotente: si el usuario ya tiene catálogo personal (aunque sea uno solo de
 * los tres), no vuelve a clonar ese. Así se puede llamar sin miedo en cada
 * acceso al tablero personal (lazy init).
 */
async function clonarModelo(Model, tenantId, ownerId) {
  const yaExiste = await Model.exists({ tenant_id: tenantId, ambito: 'personal', owner_id: ownerId });
  if (yaExiste) return 0;

  const original = await Model.find({ tenant_id: tenantId, ambito: 'empresa' }).sort({ orden: 1 }).lean();
  if (original.length === 0) return 0;

  const copias = original.map(({ _id, createdAt, updatedAt, created_at, updated_at, ...campos }) => ({
    ...campos,
    tenant_id: tenantId,
    ambito: 'personal',
    owner_id: ownerId,
  }));

  try {
    // El índice único { tenant_id, ambito, owner_id, value } es la red final:
    // si dos peticiones concurrentes pasan el exists() a la vez, la segunda
    // choca aquí. ordered:false inserta lo que pueda y el error de duplicado
    // (11000) se ignora — el resultado es un solo catálogo, sin duplicados.
    await Model.insertMany(copias, { ordered: false });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return copias.length;
}

/**
 * Garantiza que el usuario tenga sus catálogos personales. Se llama al entrar al
 * tablero personal. Devuelve cuántos documentos se clonaron (0 si ya existían).
 */
async function asegurarCatalogoPersonal(tenantId, ownerId) {
  const [estados, prioridades, tipos] = await Promise.all([
    clonarModelo(Estado, tenantId, ownerId),
    clonarModelo(Prioridad, tenantId, ownerId),
    clonarModelo(Tipo, tenantId, ownerId),
  ]);
  return { estados, prioridades, tipos };
}

module.exports = { asegurarCatalogoPersonal };
