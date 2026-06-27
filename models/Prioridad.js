const mongoose = require('mongoose');

const prioridadSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  value: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  color: { type: String, required: true, trim: true },
  orden: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Prioridad', prioridadSchema);
