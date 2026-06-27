const requerimientosService = require('../services/requerimientos.services');

async function create(req, res) {
  try {
    const requerimiento = await requerimientosService.create(req.tenant_id, req.params.moduloId, { ...req.body, creado_por: req.usuario_nombre });
    res.status(201).json(requerimiento);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de módulo inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function update(req, res) {
  try {
    const requerimiento = await requerimientosService.update(req.tenant_id, req.params.id, req.body);
    if (!requerimiento) return res.status(404).json({ message: 'Requerimiento no encontrado' });
    res.json(requerimiento);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de requerimiento inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function remove(req, res) {
  try {
    const requerimiento = await requerimientosService.remove(req.tenant_id, req.params.id);
    if (!requerimiento) return res.status(404).json({ message: 'Requerimiento no encontrado' });
    res.json({ message: 'Requerimiento eliminado' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de requerimiento inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function reorder(req, res) {
  try {
    const requerimientos = await requerimientosService.reorder(req.tenant_id, req.params.moduloId, req.body.orderedIds);
    res.json(requerimientos);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function toggleCompletado(req, res) {
  try {
    const { completado, estadoRestaurado } = req.body;
    const requerimiento = await requerimientosService.toggleCompletado(req.tenant_id, req.params.id, completado, estadoRestaurado);
    if (!requerimiento) return res.status(404).json({ message: 'Requerimiento no encontrado' });
    res.json(requerimiento);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de requerimiento inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function addAdjunto(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Debes adjuntar una imagen' });
    }
    const requerimiento = await requerimientosService.addAdjunto(req.tenant_id, req.params.id, req.file.buffer);
    if (!requerimiento) return res.status(404).json({ message: 'Requerimiento no encontrado' });
    res.status(201).json(requerimiento);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de requerimiento inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function removeAdjunto(req, res) {
  try {
    const requerimiento = await requerimientosService.removeAdjunto(req.tenant_id, req.params.id, req.params.adjuntoId);
    if (!requerimiento) return res.status(404).json({ message: 'Requerimiento no encontrado' });
    res.json(requerimiento);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID inválido' });
    res.status(400).json({ message: error.message });
  }
}

module.exports = { create, update, remove, reorder, toggleCompletado, addAdjunto, removeAdjunto };
