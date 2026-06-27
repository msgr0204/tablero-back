const mongoose = require('mongoose');

const adjuntoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  ruta: { type: String, required: true },
});

const requerimientoSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  modulo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Modulo', required: true },
  texto: { type: String, required: true, trim: true },
  adjuntos: { type: [adjuntoSchema], default: [] },
  estado: { type: mongoose.Schema.Types.ObjectId, ref: 'Estado', default: null },
  prioridad: { type: mongoose.Schema.Types.ObjectId, ref: 'Prioridad', default: null },
  estado_anterior: { type: mongoose.Schema.Types.ObjectId, ref: 'Estado', default: null },
  prioridad_anterior: { type: mongoose.Schema.Types.ObjectId, ref: 'Prioridad', default: null },
  completado: { type: Boolean, default: false },
  completado_at: { type: Date, default: null },
  fecha_entrega: { type: Date, default: null },
  dias_maximos: { type: Number, default: null },
  creado_por: { type: String, default: 'tu_usuario' },
  orden: { type: Number, default: 0 },
  eliminado_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Requerimiento', requerimientoSchema);
