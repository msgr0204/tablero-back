function normalizar(valor) {
  if (valor === undefined) return null;
  if (valor instanceof Date) return valor.getTime();
  if (valor && typeof valor.toString === 'function' && valor._bsontype === 'ObjectID') return valor.toString();
  return valor;
}

/**
 * Compara, campo por campo, solo las claves presentes en el payload contra
 * el documento original. Evita disparar updates/notificaciones cuando el
 * usuario confirma un formulario sin haber modificado realmente ningún valor.
 */
function hayCambiosReales(anterior, payload) {
  return Object.keys(payload).some((key) => {
    const valorAnterior = normalizar(anterior[key]);
    const valorNuevo = normalizar(payload[key]);
    return valorAnterior !== valorNuevo;
  });
}

module.exports = hayCambiosReales;
