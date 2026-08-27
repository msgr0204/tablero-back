const tiposService = require('../services/tipos.services');
const { filtroAmbito } = require('../utils/filtroAmbito');

async function getAll(req, res) {
  try {
    const tipos = await tiposService.getAll(filtroAmbito(req));
    res.json(tipos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function create(req, res) {
  try {
    const tipo = await tiposService.create(filtroAmbito(req), req.body);
    res.status(201).json(tipo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function update(req, res) {
  try {
    const tipo = await tiposService.update(filtroAmbito(req), req.params.id, req.body);
    if (!tipo) return res.status(404).json({ message: 'Tipo no encontrado' });
    res.json(tipo);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de tipo inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function remove(req, res) {
  try {
    const tipo = await tiposService.remove(filtroAmbito(req), req.params.id);
    if (!tipo) return res.status(404).json({ message: 'Tipo no encontrado' });
    res.json({ message: 'Tipo eliminado' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de tipo inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function reorder(req, res) {
  try {
    const tipos = await tiposService.reorder(filtroAmbito(req), req.body.orderedIds);
    res.json(tipos);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

module.exports = { getAll, create, update, remove, reorder };
