const ETIQUETAS = {
  nombre: 'Nombre',
  texto: 'Texto',
  descripcion: 'Descripción',
  estado: 'Estado',
  prioridad: 'Prioridad',
  tipo: 'Tipo',
  fecha_entrega: 'Fecha de entrega',
  visibilidad: 'Visibilidad',
  label: 'Nombre',
  color: 'Color',
  es_estado_final: 'Estado de cierre',
  rol: 'Rol',
  activo: 'Estado de la cuenta',
  cargo: 'Cargo',
  telefono: 'Teléfono',
  documento: 'Documento',
  ubicacion: 'Ubicación',
  orden: 'Orden',
};

// Campos que nunca deben aparecer en el log: o son secretos, o son ruido de
// infraestructura que no dice nada a quien lee la auditoría.
const OCULTOS = new Set([
  'password', 'tenant_id', 'ambito', 'owner_id',
  'creado_por', 'creado_por_id', 'updated_at', 'created_at', '_id', '__v',
]);

function esObjectId(v) {
  return Boolean(v) && typeof v === 'object' && v._bsontype === 'ObjectID';
}

/**
 * Convierte un valor de Mongo en algo que una persona pueda leer en el log.
 * `resolver` traduce un ObjectId de catálogo a su etiqueta ("Pendiente"): sin
 * eso el registro mostraría dos ids y no diría nada.
 */
function legible(valor, resolver) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (esObjectId(valor) || (typeof valor === 'string' && /^[0-9a-fA-F]{24}$/.test(valor))) {
    const id = valor.toString();
    return resolver ? (resolver(id) ?? id) : id;
  }
  return valor;
}

function normalizar(valor) {
  if (valor === undefined || valor === '') return null;
  if (valor instanceof Date) return valor.getTime();
  if (esObjectId(valor)) return valor.toString();
  return valor;
}

/**
 * Diff de una edición: compara SOLO las claves presentes en el payload contra el
 * documento anterior y devuelve [{ campo, antes, despues }] ya en texto legible.
 *
 * Se limita a lo que el payload trae porque un update parcial no debe reportar
 * como "sin cambios" los campos que ni siquiera se enviaron.
 */
function calcularCambios(anterior, payload, resolver) {
  const cambios = [];
  for (const campo of Object.keys(payload)) {
    if (OCULTOS.has(campo)) continue;
    const antes = normalizar(anterior?.[campo]);
    const despues = normalizar(payload[campo]);
    if (antes === despues) continue;
    cambios.push({
      campo: ETIQUETAS[campo] ?? campo,
      antes: legible(anterior?.[campo], resolver),
      despues: legible(payload[campo], resolver),
    });
  }
  return cambios;
}

module.exports = calcularCambios;
module.exports.legible = legible;
