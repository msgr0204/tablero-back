const authService = require('../services/auth.services');

async function register(req, res) {
  try {
    const resultado = await authService.register(req.body);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function login(req, res) {
  try {
    const resultado = await authService.login(req.body);
    res.json(resultado);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
}

async function getPerfil(req, res) {
  try {
    const perfil = await authService.getPerfil(req.usuario_id);
    if (!perfil) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(perfil);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = { register, login, getPerfil };
