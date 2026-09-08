const mongoose = require('mongoose');

const prioridadSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  ambito: { type: String, enum: ['empresa', 'personal', 'equipo'], default: 'empresa' },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  value: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  color: { type: String, required: true, trim: true },
  orden: { type: Number, default: 0 },
  // Soft delete: borrar deja de destruir el dato para que la auditoría pueda
  // mostrar qué se eliminó y quién lo hizo. Las lecturas filtran eliminado_at.
  eliminado_at: { type: Date, default: null },
}, { timestamps: true });

prioridadSchema.index({ tenant_id: 1, ambito: 1, owner_id: 1 });
// Impide catálogos duplicados por ámbito/dueño ante clonaciones concurrentes.
// Único solo entre los VIVOS: con soft delete, un índice único a secas dejaría
// el nombre reservado para siempre e impediría volver a crear uno igual tras
// borrarlo.
prioridadSchema.index({ tenant_id: 1, ambito: 1, owner_id: 1, value: 1 }, { unique: true, partialFilterExpression: { eliminado_at: null } });

module.exports = mongoose.model('Prioridad', prioridadSchema);
