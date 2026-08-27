const observacionesService = require('../services/observaciones.services');
const { filtroAmbito } = require('../utils/filtroAmbito');

async function addModuleObservation(req, res) {
  try {
    const observacion = await observacionesService.addModuleObservation(filtroAmbito(req), req.params.moduloId, req.body.texto);
    res.status(201).json(observacion);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de módulo inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function removeModuleObservation(req, res) {
  try {
    await observacionesService.removeModuleObservation(filtroAmbito(req), req.params.moduloId, req.params.obsId);
    res.json({ message: 'Observación eliminada' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de observación inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function editModuleObservation(req, res) {
  try {
    const observacion = await observacionesService.editModuleObservation(filtroAmbito(req), req.params.moduloId, req.params.obsId, req.body.texto);
    if (!observacion) return res.status(404).json({ message: 'Observación no encontrada' });
    res.json(observacion);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de observación inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function addReqObservation(req, res) {
  try {
    const observacion = await observacionesService.addReqObservation(filtroAmbito(req), req.params.reqId, req.body.texto);
    res.status(201).json(observacion);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de requerimiento inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function removeReqObservation(req, res) {
  try {
    await observacionesService.removeReqObservation(filtroAmbito(req), req.params.reqId, req.params.obsId);
    res.json({ message: 'Observación eliminada' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de observación inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function editReqObservation(req, res) {
  try {
    const observacion = await observacionesService.editReqObservation(filtroAmbito(req), req.params.reqId, req.params.obsId, req.body.texto);
    if (!observacion) return res.status(404).json({ message: 'Observación no encontrada' });
    res.json(observacion);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de observación inválido' });
    res.status(400).json({ message: error.message });
  }
}

module.exports = {
  addModuleObservation, removeModuleObservation, editModuleObservation,
  addReqObservation, removeReqObservation, editReqObservation,
};
