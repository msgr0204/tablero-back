require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Da a las observaciones y al catálogo el campo `eliminado_at` que ya tenían
 * categorías, módulos y requerimientos. Solo AGREGA el campo donde falta, con
 * valor null (= vivo); no borra ni reescribe nada.
 *
 * Idempotente: solo toca documentos que aún no lo tienen. Correr una vez tras
 * desplegar el cambio de modelos. Driver nativo para no depender de que el
 * schema ya exija el campo.
 */
const COLECCIONES = [
  'observacionmodulos',
  'observacionrequerimientos',
  'estados',
  'prioridads',
  'tipos',
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado a MongoDB');
  const db = mongoose.connection.db;

  const resumen = {};
  for (const nombre of COLECCIONES) {
    const { modifiedCount } = await db.collection(nombre).updateMany(
      { eliminado_at: { $exists: false } },
      { $set: { eliminado_at: null } }
    );
    resumen[nombre] = modifiedCount;
  }

  console.log('Migración de soft delete completada:', resumen);
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error('Error en la migración:', error);
  process.exit(1);
});
