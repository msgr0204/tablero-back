const mongoose = require('mongoose');

const observacionRequerimientoSchema = new mongoose.Schema({
  requerimiento_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Requerimiento', required: true },
  texto: { type: String, required: true, trim: true },
  creado_por: { type: String, default: null },
  creado_por_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  fecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ObservacionRequerimiento', observacionRequerimientoSchema);
