const mongoose = require('mongoose');

const categoriaSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  nombre: { type: String, required: true, trim: true },
  descripcion: { type: String, default: null },
  estado: { type: mongoose.Schema.Types.ObjectId, ref: 'Estado', default: null },
  prioridad: { type: mongoose.Schema.Types.ObjectId, ref: 'Prioridad', default: null },
  fecha_entrega: { type: Date, default: null },
  dias_maximos: { type: Number, default: null },
  creado_por: { type: String, default: 'tu_usuario' },
  orden: { type: Number, default: 0 },
  eliminado_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Categoria', categoriaSchema);
