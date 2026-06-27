function adminMiddleware(req, res, next) {
  if (req.usuario_rol !== 'admin') {
    return res.status(403).json({ message: 'Solo un administrador puede realizar esta acción' });
  }
  next();
}

module.exports = adminMiddleware;
