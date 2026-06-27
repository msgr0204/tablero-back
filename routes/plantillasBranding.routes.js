const express = require('express');
const router = express.Router();
const plantillasBrandingController = require('../controllers/plantillasBranding.controllers');

router.get('/', plantillasBrandingController.getAll);

module.exports = router;
