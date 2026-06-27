const express = require('express');
const router = express.Router();
const categoriasController = require('../controllers/categorias.controllers');

router.get('/', categoriasController.getAll);
router.post('/', categoriasController.create);
router.post('/reorder', categoriasController.reorder);
router.get('/:id', categoriasController.getById);
router.patch('/:id', categoriasController.update);
router.delete('/:id', categoriasController.remove);

module.exports = router;
