const clonarCatalogoService = require('../services/clonarCatalogo.services');

/**
 * Prepara el tablero personal del usuario autenticado: clona los catálogos de
 * la empresa a su ámbito personal si aún no los tiene. Idempotente; el front lo
 * llama al entrar a "Mi tablero".
 */
async function inicializar(req, res) {
  try {
    const clonados = await clonarCatalogoService.asegurarCatalogoPersonal(req.tenant_id, req.usuario_id, req);
    res.json({ clonados });
  } catch (error) {
    res.status(error.status ?? 400).json({ message: error.message });
  }
}

module.exports = { inicializar };
