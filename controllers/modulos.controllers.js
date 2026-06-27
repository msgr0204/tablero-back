const modulosService = require('../services/modulos.services');

async function getByCategory(req, res) {
  try {
    const modulos = await modulosService.getByCategory(req.tenant_id, req.params.categoriaId);
    res.json(modulos);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de categoría inválido' });
    res.status(500).json({ message: error.message });
  }
}

async function getById(req, res) {
  try {
    const modulo = await modulosService.getById(req.tenant_id, req.params.id);
    if (!modulo) return res.status(404).json({ message: 'Módulo no encontrado' });
    res.json(modulo);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de módulo inválido' });
    res.status(500).json({ message: error.message });
  }
}

async function create(req, res) {
  try {
    const modulo = await modulosService.create(req.tenant_id, req.params.categoriaId, { ...req.body, creado_por: req.usuario_nombre });
    res.status(201).json(modulo);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de categoría inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function updateDetail(req, res) {
  try {
    const modulo = await modulosService.updateDetail(req.tenant_id, req.params.id, req.body);
    if (!modulo) return res.status(404).json({ message: 'Módulo no encontrado' });
    res.json(modulo);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de módulo inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function remove(req, res) {
  try {
    const modulo = await modulosService.remove(req.tenant_id, req.params.id);
    if (!modulo) return res.status(404).json({ message: 'Módulo no encontrado' });
    res.json({ message: 'Módulo eliminado' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de módulo inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function reorder(req, res) {
  try {
    const modulos = await modulosService.reorder(req.tenant_id, req.params.categoriaId, req.body.orderedIds);
    res.json(modulos);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

module.exports = { getByCategory, getById, create, updateDetail, remove, reorder };
