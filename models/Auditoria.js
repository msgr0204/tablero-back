const mongoose = require('mongoose');

/**
 * Registro inmutable de las acciones que hacen las personas en la plataforma.
 *
 * Va aparte de Notificacion: la notificación avisa ("se completó X") y se marca
 * leída; esto es el rastro de QUIÉN hizo qué, y no se edita ni se marca nunca.
 *
 * Cubre los dos ámbitos: el tablero de empresa y los personales. En un tablero
 * personal compartido, `owner_id` dice de quién es el tablero y `actor_id` quién
 * operó — que pueden ser personas distintas.
 *
 * El nombre del actor y el de la entidad se guardan DESNORMALIZADOS a propósito:
 * si mañana se elimina el usuario o la categoría, el registro debe seguir siendo
 * legible por sí solo. Un log que dice "un usuario borrado editó algo borrado"
 * no sirve para rendir cuentas.
 */
const auditoriaSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  ambito: { type: String, enum: ['empresa', 'personal'], default: 'empresa' },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },

  actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  actor_nombre: { type: String, default: null },
  actor_rol: { type: String, default: null },

  accion: { type: String, required: true, trim: true },
  entidad: { type: String, required: true, trim: true },
  entidad_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  entidad_nombre: { type: String, default: null },

  // Rama del tablero donde ocurrió, para poder responder "qué pasó en este
  // módulo" sin recorrer todo el log.
  contexto: {
    categoria_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    modulo_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  },

  // Diff de una edición: qué campo cambió y entre qué valores, ya en texto
  // legible (no ObjectIds sueltos).
  cambios: [{
    _id: false,
    campo: String,
    antes: mongoose.Schema.Types.Mixed,
    despues: mongoose.Schema.Types.Mixed,
  }],

  // Copia del contenido al eliminar, y evidencia que el documento pierde al
  // mutar (p. ej. la fecha de completado que se borra al reabrir).
  snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// Feed general del tenant.
auditoriaSchema.index({ tenant_id: 1, created_at: -1 });
// "Mi actividad" y el filtro por persona.
auditoriaSchema.index({ tenant_id: 1, actor_id: 1, created_at: -1 });
// Historial de un ítem concreto.
auditoriaSchema.index({ entidad: 1, entidad_id: 1, created_at: -1 });
// Qué ocurrió dentro de un módulo.
auditoriaSchema.index({ tenant_id: 1, 'contexto.modulo_id': 1, created_at: -1 });

// Retención: Mongo purga solo las entradas más viejas que este plazo. Sin un
// techo, el log crecería indefinidamente. Se controla por variable de entorno
// para poder alargarlo si el negocio lo exige, sin tocar código.
const MESES_RETENCION = Number(process.env.AUDITORIA_MESES_RETENCION ?? 12);
auditoriaSchema.index(
  { created_at: 1 },
  { expireAfterSeconds: MESES_RETENCION * 30 * 24 * 60 * 60 }
);

module.exports = mongoose.model('Auditoria', auditoriaSchema);
