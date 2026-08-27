const express = require('express');
const router = express.Router();
const tableroPersonalController = require('../controllers/tableroPersonal.controllers');

router.post('/inicializar', tableroPersonalController.inicializar);

module.exports = router;
