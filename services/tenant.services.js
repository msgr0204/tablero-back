const Tenant = require('../models/Tenant');
const plantillasBrandingService = require('./plantillasBranding.services');
const storageService = require('./storage.services');

async function aplicarPlantilla(tenantId, plantillaId) {
  const plantilla = plantillasBrandingService.getById(plantillaId);
  if (!plantilla) {
    throw new Error('Plantilla no encontrada');
  }

  const tenant = await Tenant.findByIdAndUpdate(
    tenantId,
    { colors: plantilla.colors, personalizado: true },
    { new: true }
  );
  if (!tenant) {
    throw new Error('Tenant no encontrado');
  }

  return tenant;
}

async function actualizarLogo(tenantId, buffer) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new Error('Tenant no encontrado');
  }

  const logoAnteriorRuta = storageService.rutaDesdeUrl(tenant.logoUrl);
  const { url } = await storageService.subirImagen(`${tenantId}/logo`, buffer);

  tenant.logoUrl = url;
  await tenant.save();

  if (logoAnteriorRuta) {
    await storageService.eliminarImagen(logoAnteriorRuta);
  }

  return tenant;
}

module.exports = { aplicarPlantilla, actualizarLogo };
