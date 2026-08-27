const mongoose = require('mongoose');

const prioridadSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  ambito: { type: String, enum: ['empresa', 'personal', 'equipo'], default: 'empresa' },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  value: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  color: { type: String, required: true, trim: true },
  orden: { type: Number, default: 0 },
}, { timestamps: true });

prioridadSchema.index({ tenant_id: 1, ambito: 1, owner_id: 1 });
// Impide catálogos duplicados por ámbito/dueño ante clonaciones concurrentes.
prioridadSchema.index({ tenant_id: 1, ambito: 1, owner_id: 1, value: 1 }, { unique: true });

module.exports = mongoose.model('Prioridad', prioridadSchema);
