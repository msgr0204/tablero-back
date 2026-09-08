const categoriasService = require('../services/categorias.services');
const { filtroAmbito } = require('../utils/filtroAmbito');

async function getAll(req, res) {
  try {
    const categorias = await categoriasService.getAll(filtroAmbito(req));
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function getById(req, res) {
  try {
    const categoria = await categoriasService.getById(filtroAmbito(req), req.params.id);
    if (!categoria) return res.status(404).json({ message: 'Categoría no encontrada' });
    res.json(categoria);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de categoría inválido' });
    res.status(500).json({ message: error.message });
  }
}

async function create(req, res) {
  try {
    const categoria = await categoriasService.create(filtroAmbito(req), { ...req.body, creado_por: req.usuario_nombre });
    res.status(201).json(categoria);
  } catch (error) {
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

async function update(req, res) {
  try {
    const categoria = await categoriasService.update(filtroAmbito(req), req.params.id, req.body);
    if (!categoria) return res.status(404).json({ message: 'Categoría no encontrada' });
    res.json(categoria);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de categoría inválido' });
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

async function remove(req, res) {
  try {
    const categoria = await categoriasService.remove(filtroAmbito(req), req.params.id);
    if (!categoria) return res.status(404).json({ message: 'Categoría no encontrada' });
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de categoría inválido' });
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

async function reorder(req, res) {
  try {
    const categorias = await categoriasService.reorder(filtroAmbito(req), req.body.orderedIds);
    res.json(categorias);
  } catch (error) {
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

module.exports = { getAll, getById, create, update, remove, reorder };
