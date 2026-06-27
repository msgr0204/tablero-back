const HistorialEstado = require('../models/HistorialEstado');

async function registrar(tenantId, entidad, entidadId, estadoAnterior, estadoNuevo) {
  await HistorialEstado.create({
    tenant_id: tenantId,
    entidad,
    entidad_id: entidadId,
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
  });
}

module.exports = { registrar };
