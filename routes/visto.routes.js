const express = require('express');
const router = express.Router();
const vistoController = require('../controllers/visto.controllers');

// entidad: 'Categoria' | 'Modulo'
router.post('/:entidad/:entidadId', vistoController.marcar);
router.get('/:entidad/:entidadId', vistoController.detalle);

module.exports = router;
