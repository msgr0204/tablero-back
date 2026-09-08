const auditoriaService = require('../services/auditoria.services');
const { filtroAmbito } = require('../utils/filtroAmbito');

// El feed general lo ve todo el equipo: la trazabilidad solo sirve si es
// verificable por quienes trabajan en el tablero, no solo por quien administra.
async function listar(req, res) {
  try {
    const resultado = await auditoriaService.consultar(req.tenant_id, req.query);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Mi actividad: el mismo feed forzando el actor al usuario autenticado, para que
// nadie pueda pedir "la actividad de otro" por esta vía.
async function mias(req, res) {
  try {
    const resultado = await auditoriaService.consultar(req.tenant_id, {
      ...req.query,
      actor_id: req.usuario_id,
    });
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function historialEntidad(req, res) {
  try {
    const historial = await auditoriaService.historialDe(req.tenant_id, req.params.entidad, req.params.entidadId);
    res.json(historial);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID inválido' });
    res.status(500).json({ message: error.message });
  }
}

async function vistasEntidad(req, res) {
  try {
    const vistas = await auditoriaService.vistasDe(req.tenant_id, req.params.entidad, req.params.entidadId);
    res.json(vistas);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID inválido' });
    res.status(500).json({ message: error.message });
  }
}

async function actores(req, res) {
  try {
    res.json(await auditoriaService.actoresDelLog(req.tenant_id));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Registrar una apertura. El cliente solo dice QUÉ abrió; quién lo abrió sale
// del token, nunca del cuerpo de la petición.
async function registrarVista(req, res) {
  try {
    const { entidad, entidad_id, entidad_nombre } = req.body;
    if (!['Modulo', 'Requerimiento'].includes(entidad)) {
      return res.status(400).json({ message: 'Entidad no válida' });
    }
    await auditoriaService.registrarVista(filtroAmbito(req), { entidad, entidad_id, entidad_nombre });
    res.status(204).end();
  } catch (error) {
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

module.exports = { listar, mias, historialEntidad, vistasEntidad, actores, registrarVista };
