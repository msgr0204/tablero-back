const express = require('express');
const router = express.Router();
const auditoriaController = require('../controllers/auditoria.controllers');

// El log es de solo lectura: la única escritura expuesta es el registro de una
// apertura, y ahí el actor lo pone el servidor. No existe endpoint para crear,
// editar ni borrar entradas de auditoría.
router.get('/', auditoriaController.listar);
router.get('/mias', auditoriaController.mias);
router.get('/actores', auditoriaController.actores);
router.get('/entidad/:entidad/:entidadId', auditoriaController.historialEntidad);
router.get('/vistas/:entidad/:entidadId', auditoriaController.vistasEntidad);
router.post('/vista', auditoriaController.registrarVista);

module.exports = router;
