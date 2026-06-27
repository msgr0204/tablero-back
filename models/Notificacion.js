const mongoose = require('mongoose');

const notificacionSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  tipo: { type: String, required: true, trim: true },
  mensaje: { type: String, required: true, trim: true },
  entidad: { type: String, required: true, trim: true },
  entidad_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  leida: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Notificacion', notificacionSchema);
