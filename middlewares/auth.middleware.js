const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario_id = payload.usuario_id;
    req.tenant_id = payload.tenant_id;
    req.usuario_nombre = payload.nombre;
    req.usuario_rol = payload.rol ?? 'admin';
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Sesión inválida o expirada' });
  }
}

module.exports = authMiddleware;
