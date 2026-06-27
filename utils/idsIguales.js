/**
 * Compara dos valores que pueden ser ObjectId, string, null o undefined,
 * normalizando ambos a string antes de comparar. Dos instancias de ObjectId
 * con el mismo valor no son === entre sí, así que cualquier comparación
 * directa de campos tipo ref (estado, prioridad) debe pasar por aquí.
 */
function idsIguales(a, b) {
  const normalizar = (valor) => (valor === undefined || valor === null ? null : valor.toString());
  return normalizar(a) === normalizar(b);
}

module.exports = idsIguales;
