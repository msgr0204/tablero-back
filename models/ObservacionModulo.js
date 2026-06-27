const mongoose = require('mongoose');

const observacionModuloSchema = new mongoose.Schema({
  modulo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Modulo', required: true },
  texto: { type: String, required: true, trim: true },
  fecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ObservacionModulo', observacionModuloSchema);
