const usuariosService = require('../services/usuarios.services');
const { auditarDesdeReq, ACCIONES } = require('../services/auditoria.services');
const calcularCambios = require('../utils/calcularCambios');

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
    await auditarDesdeReq(req, {
      accion: ACCIONES.CREAR,
      entidad: 'Usuario',
      entidad_id: usuario._id ?? usuario.id,
      entidad_nombre: usuario.nombre,
      snapshot: { email: usuario.email, rol: usuario.rol },
    });
    res.status(201).json(usuario);
  } catch (error) {
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

async function update(req, res) {
  try {
    // El anterior se lee antes de mutar: cambiar el rol o desactivar una cuenta
    // son las acciones más sensibles de administración y deben quedar con su
    // valor previo en el log.
    const anterior = await usuariosService.getById(req.tenant_id, req.params.id);
    const usuario = await usuariosService.update(req.tenant_id, req.params.id, req.body, req.usuario_id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    await auditarDesdeReq(req, {
      accion: ACCIONES.EDITAR,
      entidad: 'Usuario',
      entidad_id: usuario._id ?? usuario.id,
      entidad_nombre: usuario.nombre,
      cambios: calcularCambios(anterior ?? {}, req.body),
    });
    res.json(usuario);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de usuario inválido' });
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

async function remove(req, res) {
  try {
    const usuario = await usuariosService.remove(req.tenant_id, req.params.id, req.usuario_id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });
    await auditarDesdeReq(req, {
      accion: ACCIONES.ELIMINAR,
      entidad: 'Usuario',
      entidad_id: usuario._id,
      entidad_nombre: usuario.nombre,
      snapshot: { email: usuario.email, rol: usuario.rol, cargo: usuario.cargo },
    });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'ID de usuario inválido' });
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

module.exports = { getAll, create, update, remove };
