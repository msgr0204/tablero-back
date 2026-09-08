const prioridadesService = require('../services/prioridades.services');
const { filtroAmbito } = require('../utils/filtroAmbito');

async function getAll(req, res) {
  try {
    const prioridades = await prioridadesService.getAll(filtroAmbito(req));
    res.json(prioridades);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function create(req, res) {
  try {
    const prioridad = await prioridadesService.create(filtroAmbito(req), req.body);
    res.status(201).json(prioridad);
  } catch (error) {
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

async function update(req, res) {
  try {
    const prioridad = await prioridadesService.update(filtroAmbito(req), req.params.id, req.body);
    if (!prioridad) return res.status(404).json({ message: 'Prioridad no encontrada' });
    res.json(prioridad);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de prioridad inválido' });
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

async function remove(req, res) {
  try {
    const prioridad = await prioridadesService.remove(filtroAmbito(req), req.params.id);
    if (!prioridad) return res.status(404).json({ message: 'Prioridad no encontrada' });
    res.json({ message: 'Prioridad eliminada' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de prioridad inválido' });
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

async function reorder(req, res) {
  try {
    const prioridades = await prioridadesService.reorder(filtroAmbito(req), req.body.orderedIds);
    res.json(prioridades);
  } catch (error) {
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

module.exports = { getAll, create, update, remove, reorder };
