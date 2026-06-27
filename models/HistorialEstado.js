const mongoose = require('mongoose');

const historialEstadoSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  entidad: { type: String, enum: ['Categoria', 'Modulo', 'Requerimiento'], required: true },
  entidad_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  estado_anterior: { type: mongoose.Schema.Types.ObjectId, ref: 'Estado', default: null },
  estado_nuevo: { type: mongoose.Schema.Types.ObjectId, ref: 'Estado', default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('HistorialEstado', historialEstadoSchema);
