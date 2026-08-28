const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  password: { type: String, required: true },
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  rol: { type: String, enum: ['admin', 'miembro'], default: 'admin' },
  // Perfil extendido: todo opcional para no romper cuentas ya creadas. Un
  // usuario inactivo conserva su historial pero no debería poder operar.
  cargo: { type: String, trim: true, default: '' },
  telefono: { type: String, trim: true, default: '' },
  documento: { type: String, trim: true, default: '' },
  ubicacion: { type: String, trim: true, default: '' },
  activo: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Usuario', usuarioSchema);
