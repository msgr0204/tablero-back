const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controllers');

router.get('/', usuariosController.getAll);
router.post('/', usuariosController.create);
router.patch('/:id', usuariosController.update);
router.delete('/:id', usuariosController.remove);

module.exports = router;
