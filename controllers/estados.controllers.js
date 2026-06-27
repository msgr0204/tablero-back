const estadosService = require('../services/estados.services');

async function getAll(req, res) {
  try {
    const estados = await estadosService.getAll(req.tenant_id);
    res.json(estados);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function create(req, res) {
  try {
    const estado = await estadosService.create(req.tenant_id, req.body);
    res.status(201).json(estado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function update(req, res) {
  try {
    const estado = await estadosService.update(req.tenant_id, req.params.id, req.body);
    if (!estado) return res.status(404).json({ message: 'Estado no encontrado' });
    res.json(estado);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de estado inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function remove(req, res) {
  try {
    const estado = await estadosService.remove(req.tenant_id, req.params.id);
    if (!estado) return res.status(404).json({ message: 'Estado no encontrado' });
    res.json({ message: 'Estado eliminado' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de estado inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function reorder(req, res) {
  try {
    const estados = await estadosService.reorder(req.tenant_id, req.body.orderedIds);
    res.json(estados);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

module.exports = { getAll, create, update, remove, reorder };
