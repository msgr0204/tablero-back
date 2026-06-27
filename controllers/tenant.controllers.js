const tenantService = require('../services/tenant.services');

async function aplicarPlantilla(req, res) {
  try {
    const tenant = await tenantService.aplicarPlantilla(req.tenant_id, req.body.plantillaId);
    res.json({ id: tenant._id, nombre: tenant.nombre, logoUrl: tenant.logoUrl, colors: tenant.colors, personalizado: tenant.personalizado });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function actualizarLogo(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Debes adjuntar una imagen' });
    }
    const tenant = await tenantService.actualizarLogo(req.tenant_id, req.file.buffer);
    res.json({ id: tenant._id, nombre: tenant.nombre, logoUrl: tenant.logoUrl, colors: tenant.colors, personalizado: tenant.personalizado });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

module.exports = { aplicarPlantilla, actualizarLogo };
