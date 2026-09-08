const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

/**
 * Autentica la petición y resuelve QUIÉN es y QUÉ puede hacer.
 *
 * El token acredita la identidad, pero el rol y el estado de la cuenta se leen
 * de la base de datos en cada petición, no del payload firmado. Un JWT vive
 * varios días: si el rol viniera dentro, degradar a alguien de administrador no
 * surtiría efecto hasta que su sesión caducara, y desactivar una cuenta la
 * dejaría operando mientras tanto. Con permisos por rol, eso convertiría el
 * sistema en un adorno.
 *
 * Es una consulta por petición, indexada por _id; el coste es despreciable al
 * lado de tener autorización desactualizada.
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  const token = authHeader.slice('Bearer '.length);

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: 'Sesión inválida o expirada' });
  }

  try {
    const usuario = await Usuario.findById(payload.usuario_id).select('nombre rol activo tenant_id');

    // La cuenta pudo eliminarse o desactivarse después de emitirse el token.
    if (!usuario) {
      return res.status(401).json({ message: 'Sesión inválida o expirada' });
    }
    if (usuario.activo === false) {
      return res.status(403).json({ message: 'Tu cuenta está desactivada. Contacta a un administrador.' });
    }

    req.usuario_id = usuario._id;
    req.tenant_id = usuario.tenant_id;
    req.usuario_nombre = usuario.nombre;
    // Sin rol reconocido se asume el mínimo privilegio, nunca el máximo.
    req.usuario_rol = usuario.rol === 'admin' ? 'admin' : 'miembro';
    next();
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo verificar la sesión' });
  }
}

module.exports = authMiddleware;
