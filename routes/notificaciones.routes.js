const express = require('express');
const router = express.Router();
const notificacionesController = require('../controllers/notificaciones.controllers');

router.get('/', notificacionesController.getAll);
router.get('/historial', notificacionesController.getPaginado);
router.get('/no-leidas/count', notificacionesController.contarNoLeidas);
router.patch('/:id/leer', notificacionesController.marcarLeida);

module.exports = router;
