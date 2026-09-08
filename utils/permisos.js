/**
 * Error de autorización: la petición se entiende y es válida, pero quien la hace
 * no tiene derecho a ejecutarla. Se distingue del error de validación para que
 * el controller pueda responder 403 en vez de 400 — no es lo mismo "lo pediste
 * mal" que "no puedes hacerlo", y el frontend necesita saber cuál es cuál.
 */
class ErrorPermiso extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorPermiso';
    this.status = 403;
  }
}

/**
 * Guarda de permiso. Evita repetir el `if (!x) throw new ErrorPermiso(...)` en
 * las decenas de puntos donde se comprueba un derecho.
 */
function exigir(condicion, mensaje) {
  if (!condicion) throw new ErrorPermiso(mensaje);
}

module.exports = { ErrorPermiso, exigir };
