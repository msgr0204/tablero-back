const mongoose = require('mongoose');

const COLOR_KEYS = [
  'primero', 'primero-claro', 'primero-fuerte', 'primero-oscuro',
  'segundo', 'segundo-claro', 'segundo-oscuro',
  'tercero', 'tercero-claro', 'tercero-oscuro',
  'cuarto', 'cuarto-claro', 'cuarto-oscuro',
  'quinto', 'quinto-claro', 'quinto-oscuro',
];

const tenantSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  logoUrl: { type: String, default: null },
  colors: { type: Map, of: String, default: {} },
  personalizado: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Tenant', tenantSchema);
module.exports.COLOR_KEYS = COLOR_KEYS;
