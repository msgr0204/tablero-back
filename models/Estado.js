const mongoose = require('mongoose');

const estadoSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  ambito: { type: String, enum: ['empresa', 'personal', 'equipo'], default: 'empresa' },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  value: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  color: { type: String, required: true, trim: true },
  es_estado_final: { type: Boolean, default: false },
  orden: { type: Number, default: 0 },
}, { timestamps: true });

estadoSchema.index({ tenant_id: 1, ambito: 1, owner_id: 1 });
// Impide catálogos duplicados por ámbito/dueño ante clonaciones concurrentes.
estadoSchema.index({ tenant_id: 1, ambito: 1, owner_id: 1, value: 1 }, { unique: true });

module.exports = mongoose.model('Estado', estadoSchema);
