const colaboradoresService = require('../services/colaboradores.services');

// El propietario del tablero es SIEMPRE el usuario autenticado. Gestionar
// colaboradores solo afecta al tablero propio; nunca al de un tercero.

async function listarEquipo(req, res) {
  try {
    const equipo = await colaboradoresService.listarEquipo(req.tenant_id, req.usuario_id);
    res.json(equipo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function concederAcceso(req, res) {
  try {
    const resultado = await colaboradoresService.concederAcceso(req.tenant_id, req.usuario_id, req.params.colaboradorId);
    res.status(201).json(resultado);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de usuario inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function revocarAcceso(req, res) {
  try {
    const resultado = await colaboradoresService.revocarAcceso(req.tenant_id, req.usuario_id, req.params.colaboradorId);
    res.json(resultado);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de usuario inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function tablerosCompartidosConmigo(req, res) {
  try {
    const tableros = await colaboradoresService.tablerosCompartidosConmigo(req.tenant_id, req.usuario_id);
    res.json(tableros);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = { listarEquipo, concederAcceso, revocarAcceso, tablerosCompartidosConmigo };
