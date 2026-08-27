require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Marca todos los datos existentes como ámbito 'empresa' (que es lo que son:
 * el tablero compartido de cada tenant). Solo AGREGA los campos ambito/owner_id
 * donde faltan; no borra, no cambia, no reescribe ningún otro dato.
 *
 * Idempotente: solo toca documentos que aún no tienen `ambito`. Correr una vez
 * tras desplegar el cambio de modelo. Driver nativo para no depender de que el
 * schema Mongoose ya exija los campos.
 */
const COLECCIONES = ['categorias', 'modulos', 'requerimientos', 'estados', 'prioridads', 'tipos'];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado a MongoDB');
  const db = mongoose.connection.db;

  const resumen = {};
  for (const nombre of COLECCIONES) {
    const { modifiedCount } = await db.collection(nombre).updateMany(
      { ambito: { $exists: false } },
      { $set: { ambito: 'empresa', owner_id: null } }
    );
    resumen[nombre] = modifiedCount;
  }

  console.log('Migración de ámbito completada (solo se agregó ambito: empresa):', resumen);
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error('Error en la migración:', error);
  process.exit(1);
});
