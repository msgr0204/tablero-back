const AMBITOS_VALIDOS = ['empresa', 'personal'];

/**
 * Resuelve el ámbito de la petición a partir del header 'X-Ambito' y lo deja en
 * req.ambito / req.owner_id para que filtroAmbito lo use. Debe montarse DESPUÉS
 * de authMiddleware (necesita req.usuario_id y req.tenant_id).
 *
 * Regla de seguridad: el dueño de un tablero personal es SIEMPRE el usuario
 * autenticado (req.usuario_id), nunca un valor que venga del cliente. Un header
 * ausente o inválido cae a 'empresa' (el comportamiento seguro por defecto, el
 * de siempre). 'equipo' aún no está soportado; se rechaza explícitamente hasta
 * su propio roadmap.
 */
function ambitoMiddleware(req, res, next) {
  const solicitado = (req.headers['x-ambito'] || 'empresa').toLowerCase();

  if (!AMBITOS_VALIDOS.includes(solicitado)) {
    return res.status(400).json({ message: 'Ámbito no válido' });
  }

  req.ambito = solicitado;
  req.owner_id = solicitado === 'personal' ? req.usuario_id : null;
  next();
}

module.exports = ambitoMiddleware;
