const mongoose = require('mongoose');

const observacionRequerimientoSchema = new mongoose.Schema({
  requerimiento_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Requerimiento', required: true },
  texto: { type: String, required: true, trim: true },
  fecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ObservacionRequerimiento', observacionRequerimientoSchema);
