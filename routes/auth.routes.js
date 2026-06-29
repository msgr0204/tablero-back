const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controllers');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/register', authController.register);
//Recordar rutas de auth con numero celular
router.post('/login', authController.login);

router.get('/perfil', authMiddleware, authController.getPerfil);

module.exports = router;
