const metricasService = require('../services/metricas.services');

async function getMetricas(req, res) {
  try {
    const data = await metricasService.getMetricas(req.tenant_id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = { getMetricas };
