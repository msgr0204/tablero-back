const express = require('express');
const router = express.Router();
const colaboradoresController = require('../controllers/colaboradores.controllers');

// Equipo de MI tablero personal (a quién le doy/quito acceso).
router.get('/equipo', colaboradoresController.listarEquipo);
router.post('/equipo/:colaboradorId', colaboradoresController.concederAcceso);
router.delete('/equipo/:colaboradorId', colaboradoresController.revocarAcceso);

// Tableros de OTROS a los que tengo acceso (para el selector).
router.get('/compartidos-conmigo', colaboradoresController.tablerosCompartidosConmigo);

module.exports = router;
