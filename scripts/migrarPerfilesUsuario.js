require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Da a los usuarios existentes los campos del perfil extendido. Solo AGREGA los
 * campos donde faltan; no borra ni reescribe nada previo. El único con default
 * significativo es `activo: true` (una cuenta ya creada estaba operando); el
 * resto quedan en cadena vacía para que el formulario los muestre sin valor.
 *
 * Idempotente: solo toca usuarios que aún no tienen `activo`. Correr una vez
 * tras desplegar el cambio de modelo. Driver nativo para no depender de que el
 * schema Mongoose ya exija los campos.
 */
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado a MongoDB');
  const db = mongoose.connection.db;

  const { modifiedCount } = await db.collection('usuarios').updateMany(
    { activo: { $exists: false } },
    { $set: { activo: true, cargo: '', telefono: '', documento: '', ubicacion: '' } }
  );

  console.log('Migración de perfiles completada. Usuarios actualizados:', modifiedCount);
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error('Error en la migración:', error);
  process.exit(1);
});
