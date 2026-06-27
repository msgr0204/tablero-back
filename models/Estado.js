const mongoose = require('mongoose');

const estadoSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  value: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  color: { type: String, required: true, trim: true },
  es_estado_final: { type: Boolean, default: false },
  orden: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Estado', estadoSchema);
