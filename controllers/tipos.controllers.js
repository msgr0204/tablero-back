const tiposService = require('../services/tipos.services');

async function getAll(req, res) {
  try {
    const tipos = await tiposService.getAll(req.tenant_id);
    res.json(tipos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function create(req, res) {
  try {
    const tipo = await tiposService.create(req.tenant_id, req.body);
    res.status(201).json(tipo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function update(req, res) {
  try {
    const tipo = await tiposService.update(req.tenant_id, req.params.id, req.body);
    if (!tipo) return res.status(404).json({ message: 'Tipo no encontrado' });
    res.json(tipo);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de tipo inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function remove(req, res) {
  try {
    const tipo = await tiposService.remove(req.tenant_id, req.params.id);
    if (!tipo) return res.status(404).json({ message: 'Tipo no encontrado' });
    res.json({ message: 'Tipo eliminado' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de tipo inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function reorder(req, res) {
  try {
    const tipos = await tiposService.reorder(req.tenant_id, req.body.orderedIds);
    res.json(tipos);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

module.exports = { getAll, create, update, remove, reorder };
