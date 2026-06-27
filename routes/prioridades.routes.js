const express = require('express');
const router = express.Router();
const prioridadesController = require('../controllers/prioridades.controllers');

router.get('/', prioridadesController.getAll);
router.post('/', prioridadesController.create);
router.post('/reorder', prioridadesController.reorder);
router.patch('/:id', prioridadesController.update);
router.delete('/:id', prioridadesController.remove);

module.exports = router;
