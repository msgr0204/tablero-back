const mongoose = require('mongoose');

/**
 * Aperturas automáticas: deja constancia de que alguien ABRIÓ un módulo o un
 * requerimiento, sin que tenga que hacer nada.
 *
 * Vive en su propia colección y no dentro de Auditoria porque el volumen no es
 * comparable: con cientos de requerimientos y un equipo navegando a diario, las
 * lecturas serían órdenes de magnitud más numerosas que las acciones reales, y
 * un "fulano reabrió un entregado" se perdería entre miles de "fulano vio…".
 *
 * No sustituye al modelo Visto: ese es el acuse DELIBERADO (el botón "Marcar
 * visto"), que es una declaración de la persona. Abrir algo no es confirmarlo.
 *
 * Se guarda una fila por usuario/entidad/día (`dia` en formato YYYY-MM-DD): la
 * pregunta útil es "quién lo ha visto y desde cuándo", no cuántas veces se
 * repintó el componente.
 */
const vistaRegistroSchema = new mongoose.Schema({
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  ambito: { type: String, enum: ['empresa', 'personal'], default: 'empresa' },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },

  usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  usuario_nombre: { type: String, default: null },

  entidad: { type: String, enum: ['Modulo', 'Requerimiento'], required: true },
  entidad_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  entidad_nombre: { type: String, default: null },

  dia: { type: String, required: true },
  vistas: { type: Number, default: 1 },
  ultima_vista_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// Una fila por usuario/entidad/día: hace la escritura idempotente ante
// re-renders y navegación repetida.
vistaRegistroSchema.index({ usuario_id: 1, entidad: 1, entidad_id: 1, dia: 1 }, { unique: true });
// "¿Quiénes abrieron esto?"
vistaRegistroSchema.index({ tenant_id: 1, entidad: 1, entidad_id: 1, ultima_vista_at: -1 });
// Actividad de lectura de una persona.
vistaRegistroSchema.index({ tenant_id: 1, usuario_id: 1, ultima_vista_at: -1 });

// Retención más corta que la del log de acciones: las aperturas son el mayor
// volumen y su valor caduca rápido — importa quién vio algo hace una semana,
// no hace un año.
const DIAS_RETENCION = Number(process.env.VISTAS_DIAS_RETENCION ?? 90);
vistaRegistroSchema.index(
  { created_at: 1 },
  { expireAfterSeconds: DIAS_RETENCION * 24 * 60 * 60 }
);

module.exports = mongoose.model('VistaRegistro', vistaRegistroSchema);
