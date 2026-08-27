/**
 * Única fuente de verdad del filtro de aislamiento por ámbito. Junto a
 * tenant_id, el ámbito es la segunda frontera de seguridad: separa el tablero
 * de la empresa del tablero personal de cada usuario dentro del mismo tenant.
 *
 * Se construye SIEMPRE desde datos resueltos en el servidor (req.tenant_id,
 * req.ambito, req.owner_id que setea ambito.middleware a partir del token y
 * del header validado), nunca desde un owner_id que mande el cliente.
 *
 * - Ámbito 'empresa':  { tenant_id, ambito: 'empresa' }         (owner_id no aplica)
 * - Ámbito 'personal': { tenant_id, ambito: 'personal', owner_id } (solo lo del usuario)
 *
 * Devuelve el filtro base; cada service le añade sus condiciones propias
 * (eliminado_at: null, _id, etc.).
 */
function filtroAmbito(req) {
  const base = { tenant_id: req.tenant_id, ambito: req.ambito };
  if (req.ambito === 'personal') {
    base.owner_id = req.owner_id;
  }
  return base;
}

/**
 * Campos de ámbito para sellar al CREAR una entidad, tomados del contexto del
 * servidor. Garantiza que lo creado nace en el ámbito correcto y con el dueño
 * correcto, sin depender del payload del cliente.
 */
function sellarAmbito(req) {
  return {
    ambito: req.ambito,
    owner_id: req.ambito === 'personal' ? req.owner_id : null,
  };
}

module.exports = { filtroAmbito, sellarAmbito };
