const express = require('express');
const router = express.Router();
const metricasController = require('../controllers/metricas.controllers');

router.get('/', metricasController.getMetricas);

module.exports = router;
