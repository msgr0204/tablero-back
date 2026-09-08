const mongoose = require('mongoose');

const observacionRequerimientoSchema = new mongoose.Schema({
  requerimiento_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Requerimiento', required: true },
  texto: { type: String, required: true, trim: true },
  creado_por: { type: String, default: null },
  creado_por_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  fecha: { type: Date, default: Date.now },
  // Soft delete: borrar deja de destruir el dato para que la auditoría pueda
  // mostrar qué se eliminó y quién lo hizo. Las lecturas filtran eliminado_at.
  eliminado_at: { type: Date, default: null },

});

module.exports = mongoose.model('ObservacionRequerimiento', observacionRequerimientoSchema);
