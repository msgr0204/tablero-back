const observacionesService = require('../services/observaciones.services');

async function addModuleObservation(req, res) {
  try {
    const observacion = await observacionesService.addModuleObservation(req.tenant_id, req.params.moduloId, req.body.texto);
    res.status(201).json(observacion);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de módulo inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function removeModuleObservation(req, res) {
  try {
    await observacionesService.removeModuleObservation(req.tenant_id, req.params.moduloId, req.params.obsId);
    res.json({ message: 'Observación eliminada' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de observación inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function addReqObservation(req, res) {
  try {
    const observacion = await observacionesService.addReqObservation(req.tenant_id, req.params.reqId, req.body.texto);
    res.status(201).json(observacion);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de requerimiento inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function removeReqObservation(req, res) {
  try {
    await observacionesService.removeReqObservation(req.tenant_id, req.params.reqId, req.params.obsId);
    res.json({ message: 'Observación eliminada' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de observación inválido' });
    res.status(400).json({ message: error.message });
  }
}

module.exports = { addModuleObservation, removeModuleObservation, addReqObservation, removeReqObservation };
