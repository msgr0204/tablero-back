const notificacionesService = require('../services/notificaciones.services');

async function getAll(req, res) {
  try {
    const notificaciones = await notificacionesService.getAll(req.tenant_id);
    res.json(notificaciones);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function getPaginado(req, res) {
  try {
    const pagina = parseInt(req.query.pagina, 10) || 1;
    const porPagina = parseInt(req.query.porPagina, 10) || 20;
    const resultado = await notificacionesService.getPaginado(req.tenant_id, pagina, porPagina);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function contarNoLeidas(req, res) {
  try {
    const total = await notificacionesService.contarNoLeidas(req.tenant_id);
    res.json({ total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function marcarLeida(req, res) {
  try {
    const notificacion = await notificacionesService.marcarLeida(req.tenant_id, req.params.id);
    if (!notificacion) return res.status(404).json({ message: 'Notificación no encontrada' });
    res.json(notificacion);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de notificación inválido' });
    res.status(400).json({ message: error.message });
  }
}

module.exports = { getAll, getPaginado, contarNoLeidas, marcarLeida };
