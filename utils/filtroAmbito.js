const idsIguales = require('./idsIguales');

/**
 * Contexto de una petición de dominio. Junto a tenant_id, el ámbito es la
 * segunda frontera de seguridad: separa el tablero de la empresa del personal,
 * e —dentro de personal— el tablero de cada dueño (owner_id, resuelto y validado
 * por ambito.middleware).
 *
 * `filtroAmbito(req)` devuelve un objeto pensado para dos usos a la vez:
 *   1. Como filtro de query: `Model.find({ ...ctx, _id: id })`. Al esparcirlo,
 *      SOLO se copian tenant_id/ambito/owner_id (las props enumerables) — nunca
 *      los metadatos de permiso, que van en una propiedad NO enumerable.
 *   2. Como contexto de permiso: `ctx.actor_id`, `ctx.es_dueno`, y los helpers
 *      `ctx.puedeModificar(item)` / `ctx.puedeMarcarFinal()`.
 *
 * Así un mismo `ctx` viaja por los services sin cambiar firmas y sin riesgo de
 * filtrar metadatos dentro de una consulta de Mongo.
 *
 * - Ámbito 'empresa':  { tenant_id, ambito: 'empresa' }
 * - Ámbito 'personal': { tenant_id, ambito: 'personal', owner_id }
 */
function filtroAmbito(req) {
  const ctx = { tenant_id: req.tenant_id, ambito: req.ambito };
  if (req.ambito === 'personal') {
    ctx.owner_id = req.owner_id;
  }

  const actor_id = req.actor_id ?? null;
  const es_dueno = req.es_dueno === true;

  // No enumerables: no se copian con `{ ...ctx }`, así nunca contaminan un filtro.
  Object.defineProperties(ctx, {
    actor_id: { value: actor_id, enumerable: false },
    es_dueno: { value: es_dueno, enumerable: false },
    creado_por: { value: req.usuario_nombre ?? null, enumerable: false },
    // Campos a sellar al CREAR: ámbito/dueño + quién crea realmente el ítem.
    sello: {
      enumerable: false,
      value: {
        ambito: req.ambito,
        owner_id: req.ambito === 'personal' ? req.owner_id : null,
        creado_por_id: actor_id,
      },
    },
    // Regla de autoría: editar/eliminar un ítem solo quien lo creó. Los ítems
    // sin creado_por_id (empresa, o previos a esta función) quedan abiertos para
    // no romper datos existentes.
    puedeModificar: {
      enumerable: false,
      value: (item) => !item.creado_por_id || idsIguales(item.creado_por_id, actor_id),
    },
    // Marcar estado final / completar: solo el dueño del tablero personal. En
    // empresa no hay dueño personal, así que no restringe.
    puedeMarcarFinal: {
      enumerable: false,
      value: () => req.ambito !== 'personal' || es_dueno,
    },
    // Gestionar el catálogo (estados/prioridades/tipos): solo el dueño del
    // tablero personal. Un colaborador usa el catálogo ajeno pero no lo edita.
    puedeGestionarCatalogo: {
      enumerable: false,
      value: () => req.ambito !== 'personal' || es_dueno,
    },
  });

  return ctx;
}

module.exports = { filtroAmbito };
