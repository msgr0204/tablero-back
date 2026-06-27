const express = require('express');
const router = express.Router();
const estadosController = require('../controllers/estados.controllers');

router.get('/', estadosController.getAll);
router.post('/', estadosController.create);
router.post('/reorder', estadosController.reorder);
router.patch('/:id', estadosController.update);
router.delete('/:id', estadosController.remove);

module.exports = router;
