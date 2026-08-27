const mongoose = require('mongoose');

/**
 * Acceso concedido al tablero personal de un usuario. Relación muchos-a-muchos
 * entre dueños y colaboradores dentro de un mismo tenant:
 *   - propietario_id: dueño del tablero personal que comparte.
 *   - colaborador_id: usuario al que se le dio acceso directo (sin invitación).
 *
 * El acceso es unidireccional: que A comparta con B no implica que B comparta
 * con A. Se modela como colección propia (no como array en Usuario) porque
 * escala en ambas direcciones —"¿a quién le di acceso?" y "¿a qué tableros
 * tengo acceso?"— sin inflar el documento del usuario, y permite crecer a
 * permisos más finos por fila en el futuro sin migrar el resto.
 */
const colaboradorTableroSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  propietario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  colaborador_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// Un mismo colaborador no puede estar dos veces en el mismo tablero.
colaboradorTableroSchema.index({ propietario_id: 1, colaborador_id: 1 }, { unique: true });
// "¿A qué tableros tengo acceso?" (selector de tableros del colaborador).
colaboradorTableroSchema.index({ tenant_id: 1, colaborador_id: 1 });

module.exports = mongoose.model('ColaboradorTablero', colaboradorTableroSchema);
