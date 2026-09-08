const Auditoria = require('../models/Auditoria');
const Estado = require('../models/Estado');
const Prioridad = require('../models/Prioridad');
const Tipo = require('../models/Tipo');
const VistaRegistro = require('../models/VistaRegistro');

// Verbos del sistema. Se centralizan aquí para que el frontend pueda traducir y
// filtrar por un conjunto cerrado, en vez de por cadenas escritas a mano en
// cada service.
const ACCIONES = {
  CREAR: 'crear',
  EDITAR: 'editar',
  ELIMINAR: 'eliminar',
  REORDENAR: 'reordenar',
  COMPLETAR: 'completar',
  REABRIR: 'reabrir',
  MARCAR_VISTO: 'marcar_visto',
  ADJUNTAR: 'adjuntar',
  QUITAR_ADJUNTO: 'quitar_adjunto',
  CONCEDER_ACCESO: 'conceder_acceso',
  REVOCAR_ACCESO: 'revocar_acceso',
  INICIALIZAR_TABLERO: 'inicializar_tablero',
  CAMBIAR_BRANDING: 'cambiar_branding',
};

// Un snapshot es una ayuda para leer el log, no un respaldo: se recorta para que
// un texto largo o una lista de adjuntos no hagan crecer la colección sin techo.
const LIMITE_SNAPSHOT = 8000;

// Escapa lo que el usuario escriba en el buscador: sin esto, un texto con
// caracteres de expresión regular haría fallar la consulta.
// Escapa lo que el usuario escriba en el buscador: sin esto, un texto con
// caracteres de expresion regular haria fallar la consulta. Se recorre carácter
// a carácter para no depender de un literal de regex con escapes frágiles.
const ESPECIALES = new Set([...".*+?^${}()|[]\/"]);
function escaparRegex(texto) {
  return [...texto].map((c) => (ESPECIALES.has(c) ? "\\" + c : c)).join("");
}

function recortar(valor) {
  if (valor === null || valor === undefined) return null;
  try {
    const json = JSON.stringify(valor);
    if (json.length <= LIMITE_SNAPSHOT) return valor;
    return { _truncado: true, resumen: json.slice(0, LIMITE_SNAPSHOT) };
  } catch {
    return null;
  }
}

/**
 * Escribe una entrada del log. ÚNICO punto de escritura de la auditoría.
 *
 * Nunca lanza: si el registro falla, la operación de negocio que lo invocó debe
 * completarse igual. Perder una línea del log es malo; perder el trabajo del
 * usuario porque el log falló, es peor.
 *
 * `ctx` es el que ya viaja por todos los services de dominio (filtroAmbito), así
 * que instrumentar una mutación no obliga a cambiar su firma.
 */
async function auditar(ctx, datos) {
  try {
    await Auditoria.create({
      tenant_id: ctx.tenant_id,
      ambito: ctx.ambito ?? 'empresa',
      owner_id: ctx.owner_id ?? null,
      actor_id: ctx.actor_id ?? null,
      actor_nombre: ctx.creado_por ?? null,
      actor_rol: ctx.actor_rol ?? null,
      accion: datos.accion,
      entidad: datos.entidad,
      entidad_id: datos.entidad_id ?? null,
      entidad_nombre: datos.entidad_nombre ?? null,
      contexto: {
        categoria_id: datos.contexto?.categoria_id ?? null,
        modulo_id: datos.contexto?.modulo_id ?? null,
      },
      cambios: datos.cambios ?? [],
      snapshot: recortar(datos.snapshot),
    });
  } catch (error) {
    console.error('[auditoria] no se pudo registrar:', error.message);
  }
}

/**
 * Variante para lo que ocurre fuera del dominio con ámbito (usuarios, equipo,
 * branding), donde no hay un ctx de filtroAmbito sino el request suelto.
 */
async function auditarDesdeReq(req, datos) {
  const ctx = {
    tenant_id: req.tenant_id,
    ambito: 'empresa',
    owner_id: null,
    actor_id: req.usuario_id ?? null,
    creado_por: req.usuario_nombre ?? null,
    actor_rol: req.usuario_rol ?? null,
  };
  return auditar(ctx, datos);
}

/**
 * Registra que alguien ABRIÓ algo. Una fila por usuario/entidad/día: la pregunta
 * que importa es quién lo ha visto y desde cuándo, no cuántas veces se repintó
 * la pantalla. El upsert hace la llamada idempotente.
 */
async function registrarVista(ctx, { entidad, entidad_id, entidad_nombre }) {
  try {
    const dia = new Date().toISOString().slice(0, 10);
    await VistaRegistro.updateOne(
      { usuario_id: ctx.actor_id, entidad, entidad_id, dia },
      {
        $setOnInsert: {
          tenant_id: ctx.tenant_id,
          ambito: ctx.ambito ?? 'empresa',
          owner_id: ctx.owner_id ?? null,
          usuario_nombre: ctx.creado_por ?? null,
          entidad_nombre: entidad_nombre ?? null,
        },
        $inc: { vistas: 1 },
        $set: { ultima_vista_at: new Date() },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('[auditoria] no se pudo registrar la vista:', error.message);
  }
}

/**
 * Traductor de ids de catálogo a etiquetas. Sin esto, el diff de una edición
 * mostraría dos ObjectIds y no diría absolutamente nada a quien lee el log.
 * Se cargan los tres catálogos del ámbito de una vez (son listas cortas) en vez
 * de consultar por cada campo cambiado.
 */
async function resolverCatalogo(ctx) {
  try {
    const filtro = { tenant_id: ctx.tenant_id, ambito: ctx.ambito ?? 'empresa' };
    if (filtro.ambito === 'personal') filtro.owner_id = ctx.owner_id ?? null;
    const [estados, prioridades, tipos] = await Promise.all([
      Estado.find(filtro).select('label'),
      Prioridad.find(filtro).select('label'),
      Tipo.find(filtro).select('label'),
    ]);
    const mapa = new Map();
    [...estados, ...prioridades, ...tipos].forEach((d) => mapa.set(d._id.toString(), d.label));
    return (id) => mapa.get(id);
  } catch {
    return () => undefined;
  }
}


/**
 * Feed del tablero: todo lo que ha pasado en el tenant, del más reciente al más
 * antiguo. Los filtros son opcionales y se componen entre sí.
 */
async function consultar(tenantId, filtros = {}) {
  const { actor_id, accion, entidad, ambito, desde, hasta, texto, pagina = 1, porPagina = 30 } = filtros;

  const query = { tenant_id: tenantId };
  if (actor_id) query.actor_id = actor_id;
  if (accion) query.accion = accion;
  if (entidad) query.entidad = entidad;
  if (ambito) query.ambito = ambito;
  if (desde || hasta) {
    query.created_at = {};
    if (desde) query.created_at.$gte = new Date(desde);
    // `hasta` llega como día suelto: se incluye completo hasta las 23:59.
    if (hasta) query.created_at.$lte = new Date(new Date(hasta).setHours(23, 59, 59, 999));
  }
  if (texto && texto.trim()) {
    const rx = new RegExp(escaparRegex(texto.trim()), 'i');
    query.$or = [{ entidad_nombre: rx }, { actor_nombre: rx }];
  }

  const limite = Math.min(Number(porPagina) || 30, 100);
  const saltar = (Math.max(Number(pagina) || 1, 1) - 1) * limite;

  const [items, total] = await Promise.all([
    Auditoria.find(query).sort({ created_at: -1 }).skip(saltar).limit(limite).lean(),
    Auditoria.countDocuments(query),
  ]);

  return { items, total, pagina: Number(pagina) || 1, porPagina: limite, totalPaginas: Math.ceil(total / limite) };
}

/** Historial de un ítem concreto: qué le ha pasado y quién lo tocó. */
async function historialDe(tenantId, entidad, entidadId) {
  return Auditoria.find({ tenant_id: tenantId, entidad, entidad_id: entidadId })
    .sort({ created_at: -1 })
    .limit(100)
    .lean();
}

/** Quiénes abrieron una entidad y cuándo la vieron por última vez. */
async function vistasDe(tenantId, entidad, entidadId) {
  return VistaRegistro.find({ tenant_id: tenantId, entidad, entidad_id: entidadId })
    .sort({ ultima_vista_at: -1 })
    .lean();
}

/** Quiénes son los actores presentes en el log (para el filtro por persona). */
async function actoresDelLog(tenantId) {
  const ids = await Auditoria.aggregate([
    { $match: { tenant_id: tenantId, actor_id: { $ne: null } } },
    { $group: { _id: '$actor_id', nombre: { $last: '$actor_nombre' } } },
    { $sort: { nombre: 1 } },
  ]);
  return ids.map((a) => ({ id: a._id, nombre: a.nombre }));
}

module.exports = {
  auditar, auditarDesdeReq, registrarVista, resolverCatalogo,
  consultar, historialDe, vistasDe, actoresDelLog,
  ACCIONES,
};
