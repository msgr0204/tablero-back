const plantillasBrandingService = require('../services/plantillasBranding.services');

function getAll(req, res) {
  res.json(plantillasBrandingService.getAll());
}

module.exports = { getAll };
