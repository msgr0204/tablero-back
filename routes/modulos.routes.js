const express = require('express');
const router = express.Router();
const modulosController = require('../controllers/modulos.controllers');
const requerimientosController = require('../controllers/requerimientos.controllers');
const observacionesController = require('../controllers/observaciones.controllers');
const uploadImagen = require('../middlewares/upload.middleware');

// Módulos por categoría
router.get('/categoria/:categoriaId', modulosController.getByCategory);
router.post('/categoria/:categoriaId', modulosController.create);
router.post('/categoria/:categoriaId/reorder', modulosController.reorder);

// Módulo individual
router.get('/:id', modulosController.getById);
router.patch('/:id', modulosController.updateDetail);
router.delete('/:id', modulosController.remove);

// Observaciones de módulo
router.post('/:moduloId/observations', observacionesController.addModuleObservation);
router.delete('/:moduloId/observations/:obsId', observacionesController.removeModuleObservation);

// Requerimientos del módulo
router.post('/:moduloId/requirements', requerimientosController.create);
router.post('/:moduloId/requirements/reorder', requerimientosController.reorder);
router.patch('/requirements/:id', requerimientosController.update);
router.patch('/requirements/:id/toggle-complete', requerimientosController.toggleCompletado);
router.delete('/requirements/:id', requerimientosController.remove);
router.post('/requirements/:id/adjuntos', uploadImagen.single('archivo'), requerimientosController.addAdjunto);
router.delete('/requirements/:id/adjuntos/:adjuntoId', requerimientosController.removeAdjunto);

// Observaciones de requerimiento
router.post('/requirements/:reqId/observations', observacionesController.addReqObservation);
router.delete('/requirements/:reqId/observations/:obsId', observacionesController.removeReqObservation);

module.exports = router;
