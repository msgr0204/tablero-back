const express = require('express');
const router = express.Router();
const tiposController = require('../controllers/tipos.controllers');

router.get('/', tiposController.getAll);
router.post('/', tiposController.create);
router.post('/reorder', tiposController.reorder);
router.patch('/:id', tiposController.update);
router.delete('/:id', tiposController.remove);

module.exports = router;
