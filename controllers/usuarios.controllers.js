const usuariosService = require('../services/usuarios.services');

async function getAll(req, res) {
  try {
    const usuarios = await usuariosService.getAll(req.tenant_id);
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function create(req, res) {
  try {
    const usuario = await usuariosService.create(req.tenant_id, req.body);
    res.status(201).json(usuario);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function update(req, res) {
  try {
    const usuario = await usuariosService.update(req.tenant_id, req.params.id, req.body, req.usuario_id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de usuario inválido' });
    res.status(400).json({ message: error.message });
  }
}

async function remove(req, res) {
  try {
    const usuario = await usuariosService.remove(req.tenant_id, req.params.id, req.usuario_id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de usuario inválido' });
    res.status(400).json({ message: error.message });
  }
}

module.exports = { getAll, create, update, remove };
