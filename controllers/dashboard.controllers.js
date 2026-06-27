const dashboardService = require('../services/dashboard.services');

async function getDashboard(req, res) {
  try {
    const data = await dashboardService.getDashboard(req.tenant_id, req.query.categoriaId || null);
    res.json(data);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de categoría inválido' });
    res.status(500).json({ message: error.message });
  }
}

module.exports = { getDashboard };
