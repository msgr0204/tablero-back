const mongoose = require('mongoose');

/**
 * Acuse de recibo: registra que un usuario del tenant confirmó haber visto un
 * requerimiento del tablero de empresa. La ausencia de registro significa "no
 * visto"; no se pre-crean filas al crear la entidad.
 *
 * Se lleva a nivel de requerimiento (la unidad de trabajo que se agrega
 * continuamente), no de categoría/módulo. Solo aplica al ámbito empresa. El
 * creador no confirma lo suyo, así que nunca se le pide ni se le cuenta.
 */
const vistoSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  entidad: { type: String, enum: ['Requerimiento'], required: true },
  entidad_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
}, { timestamps: { createdAt: 'visto_at', updatedAt: false } });

// Un usuario ve una entidad una sola vez (idempotente ante doble clic).
vistoSchema.index({ entidad: 1, entidad_id: 1, usuario_id: 1 }, { unique: true });
// "¿Quiénes vieron esta entidad?" (resumen y detalle de trazabilidad).
vistoSchema.index({ tenant_id: 1, entidad: 1, entidad_id: 1 });

module.exports = mongoose.model('Visto', vistoSchema);
