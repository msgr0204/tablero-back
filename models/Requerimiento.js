const mongoose = require('mongoose');

const adjuntoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  ruta: { type: String, required: true },
});

const requerimientoSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  ambito: { type: String, enum: ['empresa', 'personal', 'equipo'], default: 'empresa' },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  modulo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Modulo', required: true },
  texto: { type: String, required: true, trim: true },
  adjuntos: { type: [adjuntoSchema], default: [] },
  estado: { type: mongoose.Schema.Types.ObjectId, ref: 'Estado', default: null },
  prioridad: { type: mongoose.Schema.Types.ObjectId, ref: 'Prioridad', default: null },
  tipo: { type: mongoose.Schema.Types.ObjectId, ref: 'Tipo', default: null },
  estado_anterior: { type: mongoose.Schema.Types.ObjectId, ref: 'Estado', default: null },
  prioridad_anterior: { type: mongoose.Schema.Types.ObjectId, ref: 'Prioridad', default: null },
  tipo_anterior: { type: mongoose.Schema.Types.ObjectId, ref: 'Tipo', default: null },
  completado: { type: Boolean, default: false },
  completado_at: { type: Date, default: null },
  // Quién cerró y quién reabrió. Al reabrir, `completado_at` se limpia para que
  // el requerimiento vuelva a estar en curso; sin estos campos no quedaría
  // ningún rastro de que llegó a estar entregado ni de quién lo deshizo.
  completado_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  completado_por_nombre: { type: String, default: null },
  reabierto_por: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  reabierto_por_nombre: { type: String, default: null },
  reabierto_at: { type: Date, default: null },
  veces_reabierto: { type: Number, default: 0 },
  fecha_entrega: { type: Date, default: null },
  dias_maximos: { type: Number, default: null },
  creado_por: { type: String, default: 'tu_usuario' },
  creado_por_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  orden: { type: Number, default: 0 },
  eliminado_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

requerimientoSchema.index({ tenant_id: 1, ambito: 1, owner_id: 1 });

module.exports = mongoose.model('Requerimiento', requerimientoSchema);
