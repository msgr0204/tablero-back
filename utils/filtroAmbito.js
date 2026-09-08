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
 *   2. Como contexto de permiso: `ctx.actor_id`, `ctx.es_dueno`, `ctx.es_admin`
 *      y los helpers `ctx.puedeModificar(item)`, `ctx.puedeEliminar(item)`,
 *      `ctx.puedeCerrar()`, `ctx.puedeReabrir()`, `ctx.puedeGestionarCatalogo()`,
 *      `ctx.puedeReordenar()`, `ctx.puedeCrearHijo()`.
 *
 * Cada derecho tiene su propio helper en lugar de reutilizar uno genérico: son
 * reglas distintas que evolucionan por separado, y colgarlas todas del mismo
 * predicado hacía que restringir una cambiara otras sin querer (reordenar
 * dependía del permiso de marcar como entregado).
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
  // El rol lo resuelve authMiddleware contra la base de datos en cada petición.
  // Viaja en el ctx para decidir permisos y para que la auditoría deje constancia
  // de con qué autoridad se hizo cada acción.
  const actor_rol = req.usuario_rol ?? 'miembro';
  const es_admin = actor_rol === 'admin';
  const esEmpresa = req.ambito !== 'personal';

  // No enumerables: no se copian con `{ ...ctx }`, así nunca contaminan un filtro.
  Object.defineProperties(ctx, {
    actor_id: { value: actor_id, enumerable: false },
    actor_rol: { value: actor_rol, enumerable: false },
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
    // Administrador del tenant. En el tablero de empresa es la figura que puede
    // intervenir sobre lo ajeno; en un tablero personal no manda sobre el dueño.
    es_admin: { value: es_admin, enumerable: false },

    // ── Autoría ──────────────────────────────────────────────────────────────
    // Modificar/eliminar un ítem: su autor, o un administrador en empresa. El
    // administrador necesita esa puerta para casos reales —alguien deja la
    // empresa, hay un dato erróneo que corregir— y cada intervención suya queda
    // en la auditoría.
    //
    // Un ítem sin autor solo lo toca un administrador: antes quedaba abierto a
    // todos para no romper datos viejos, pero eso convertía la regla en un
    // adorno. Hoy ya no debería haber ninguno (ver migrarAutoriaEmpresa).
    puedeModificar: {
      enumerable: false,
      value: (item) => {
        if (item?.creado_por_id && idsIguales(item.creado_por_id, actor_id)) return true;
        return esEmpresa ? es_admin : false;
      },
    },
    puedeEliminar: {
      enumerable: false,
      value: (item) => {
        if (item?.creado_por_id && idsIguales(item.creado_por_id, actor_id)) return true;
        return esEmpresa ? es_admin : false;
      },
    },

    // Aportar contenido dentro de algo ajeno (un módulo en la categoría de otro)
    // NO es modificarlo: es colaborar, que es para lo que existe un tablero
    // compartido. Exigir autoría del padre paralizaría al equipo, porque casi
    // toda la estructura la creó un puñado de personas.
    puedeCrearHijo: {
      enumerable: false,
      value: () => true,
    },

    // ── Ciclo de cierre ──────────────────────────────────────────────────────
    // Completar avanza el trabajo: no se le pide permiso a nadie.
    puedeCerrar: {
      enumerable: false,
      value: () => (esEmpresa ? true : es_dueno),
    },
    // Reabrir DESHACE el cierre de otra persona, y es la acción que más
    // malentendidos genera. En empresa queda reservada a administradores.
    puedeReabrir: {
      enumerable: false,
      value: () => (esEmpresa ? es_admin : es_dueno),
    },

    // ── Configuración compartida ─────────────────────────────────────────────
    // El catálogo define el vocabulario de TODO el tablero: renombrar "Entregado"
    // o cambiar qué estado cierra afecta a cada persona del equipo.
    puedeGestionarCatalogo: {
      enumerable: false,
      value: () => (esEmpresa ? es_admin : es_dueno),
    },
    // Reordenar solo cambia cómo se ve el tablero, no lo que contiene.
    puedeReordenar: {
      enumerable: false,
      value: () => (esEmpresa ? true : es_dueno),
    },
    // Solo el dueño marca sus ítems como público/privado.
    puedeMarcarVisibilidad: {
      enumerable: false,
      value: () => req.ambito === 'personal' && es_dueno,
    },
    // Fragmento de filtro de visibilidad para colecciones con el campo
    // `visibilidad` (Categoria, Modulo). Se compone EXPLÍCITAMENTE en sus
    // queries (no va en el spread del ctx, para no aplicarlo a colecciones que
    // no tienen el campo). Un colaborador solo ve: lo público, o lo que NO creó
    // el dueño (los ítems de colaboradores no tienen privacidad). El dueño y el
    // ámbito empresa no filtran nada -> devuelve {}.
    filtroVisibilidad: {
      enumerable: false,
      value: () => {
        if (req.ambito !== 'personal' || es_dueno) return {};
        return { $or: [{ visibilidad: 'publico' }, { creado_por_id: { $ne: req.owner_id } }] };
      },
    },
  });

  return ctx;
}

module.exports = { filtroAmbito };
