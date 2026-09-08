const tenantService = require('../services/tenant.services');
const { auditarDesdeReq, ACCIONES } = require('../services/auditoria.services');

async function aplicarPlantilla(req, res) {
  try {
    const tenant = await tenantService.aplicarPlantilla(req.tenant_id, req.body.plantillaId);
    await auditarDesdeReq(req, {
      accion: ACCIONES.CAMBIAR_BRANDING,
      entidad: 'Tenant',
      entidad_id: tenant._id,
      entidad_nombre: tenant.nombre,
      snapshot: { plantilla: req.body.plantillaId },
    });
    res.json({ id: tenant._id, nombre: tenant.nombre, logoUrl: tenant.logoUrl, colors: tenant.colors, personalizado: tenant.personalizado });
  } catch (error) {
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

async function actualizarLogo(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Debes adjuntar una imagen' });
    }
    const tenant = await tenantService.actualizarLogo(req.tenant_id, req.file.buffer);
    await auditarDesdeReq(req, {
      accion: ACCIONES.CAMBIAR_BRANDING,
      entidad: 'Tenant',
      entidad_id: tenant._id,
      entidad_nombre: tenant.nombre,
      snapshot: { cambio: 'logo' },
    });
    res.json({ id: tenant._id, nombre: tenant.nombre, logoUrl: tenant.logoUrl, colors: tenant.colors, personalizado: tenant.personalizado });
  } catch (error) {
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

module.exports = { aplicarPlantilla, actualizarLogo };
