const vistoService = require('../services/visto.services');

// El acuse de recibo aplica solo al tablero de empresa. El usuario que confirma
// es siempre el autenticado.
async function marcar(req, res) {
  try {
    const resultado = await vistoService.marcarVisto(req.tenant_id, req.usuario_id, req.params.entidad, req.params.entidadId);
    res.status(201).json(resultado);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function detalle(req, res) {
  try {
    const lista = await vistoService.detalle(req.tenant_id, req.params.entidad, req.params.entidadId);
    res.json(lista);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID inválido' });
    res.status(400).json({ message: error.message });
  }
}

module.exports = { marcar, detalle };
