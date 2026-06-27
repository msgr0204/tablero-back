const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenant.controllers');
const uploadImagen = require('../middlewares/upload.middleware');

router.patch('/branding', tenantController.aplicarPlantilla);
router.patch('/logo', uploadImagen.single('logo'), tenantController.actualizarLogo);

module.exports = router;
