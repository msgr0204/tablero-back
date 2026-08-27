// Campos que definen propiedad, ámbito y autoría de una entidad. Los sella el
// servidor al crear (via ctx.sello) y NUNCA deben poder cambiarse desde el body
// de un update: si el cliente los envía, se descartan. Evita que alguien —aun
// sobre un ítem propio— lo saque de su tablero, cambie de ámbito o reasigne la
// autoría (mass-assignment).
const CAMPOS_PROTEGIDOS = ['tenant_id', 'ambito', 'owner_id', 'creado_por', 'creado_por_id'];

function limpiarCamposProtegidos(data) {
  const limpio = { ...data };
  for (const campo of CAMPOS_PROTEGIDOS) {
    delete limpio[campo];
  }
  return limpio;
}

module.exports = { limpiarCamposProtegidos, CAMPOS_PROTEGIDOS };
