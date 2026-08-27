const mongoose = require('mongoose');
const ColaboradorTablero = require('../models/ColaboradorTablero');
const idsIguales = require('../utils/idsIguales');

const AMBITOS_VALIDOS = ['empresa', 'personal'];

/**
 * Resuelve el ámbito y el contexto de propiedad de la petición. Debe montarse
 * DESPUÉS de authMiddleware (necesita req.usuario_id y req.tenant_id).
 *
 * Deja en el request tres piezas que gobiernan todo el sistema de permisos:
 *   - req.ambito     : 'empresa' | 'personal' (header X-Ambito).
 *   - req.actor_id   : quién opera; SIEMPRE el usuario autenticado.
 *   - req.owner_id   : de quién es el tablero personal que se está viendo.
 *   - req.es_dueno   : true si el actor es el dueño de ese tablero.
 *
 * Propiedad del tablero personal:
 *   - Sin header X-Owner-Id  -> el tablero es el propio (owner = actor). Como hoy.
 *   - Con X-Owner-Id = otro  -> se exige que el actor tenga acceso a ese tablero
 *     (es el dueño, o existe un ColaboradorTablero{ propietario, colaborador }).
 *     Sin acceso -> 403. La validación vive SOLO aquí: es la frontera de
 *     seguridad, resuelta en el servidor, nunca confiando en el cliente.
 *
 * En ámbito 'empresa' no hay dueño personal: owner_id = null, es_dueno = false
 * (el header X-Owner-Id se ignora).
 */
async function ambitoMiddleware(req, res, next) {
  try {
    const solicitado = (req.headers['x-ambito'] || 'empresa').toLowerCase();
    if (!AMBITOS_VALIDOS.includes(solicitado)) {
      return res.status(400).json({ message: 'Ámbito no válido' });
    }

    req.ambito = solicitado;
    req.actor_id = req.usuario_id;

    if (solicitado !== 'personal') {
      req.owner_id = null;
      req.es_dueno = false;
      return next();
    }

    const ownerSolicitado = req.headers['x-owner-id'];

    // Sin header o apuntando a mí mismo: tablero propio.
    if (!ownerSolicitado || idsIguales(ownerSolicitado, req.usuario_id)) {
      req.owner_id = req.usuario_id;
      req.es_dueno = true;
      return next();
    }

    if (!mongoose.isValidObjectId(ownerSolicitado)) {
      return res.status(400).json({ message: 'Tablero solicitado inválido' });
    }

    // Tablero de otro: exigir acceso concedido dentro del mismo tenant.
    const tieneAcceso = await ColaboradorTablero.exists({
      tenant_id: req.tenant_id,
      propietario_id: ownerSolicitado,
      colaborador_id: req.usuario_id,
    });

    if (!tieneAcceso) {
      return res.status(403).json({ message: 'No tienes acceso a este tablero' });
    }

    req.owner_id = ownerSolicitado;
    req.es_dueno = false;
    next();
  } catch (error) {
    res.status(500).json({ message: 'No se pudo resolver el acceso al tablero' });
  }
}

module.exports = ambitoMiddleware;
