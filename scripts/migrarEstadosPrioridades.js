require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Migra Categoria/Modulo/Requerimiento.estado y .prioridad del formato
 * legado (string slug, ej. 'pendiente') al nuevo formato (ObjectId real
 * del Estado/Prioridad correspondiente).
 *
 * Usa el driver nativo de MongoDB (no los modelos Mongoose) porque el
 * schema ya fue cambiado a ObjectId: si leyéramos con los modelos normales,
 * Mongoose intentaría castear los strings viejos y lanzaría CastError antes
 * de poder migrarlos. Se ejecuta una sola vez tras desplegar el cambio.
 */
async function migrarColeccion(db, nombreColeccion, campos, estadosPorTenant, prioridadesPorTenant) {
  const coleccion = db.collection(nombreColeccion);
  const documentos = await coleccion.find({}).toArray();
  let migrados = 0;

  for (const doc of documentos) {
    const tenantId = doc.tenant_id.toString();
    const estadosMap = estadosPorTenant.get(tenantId) ?? new Map();
    const prioridadesMap = prioridadesPorTenant.get(tenantId) ?? new Map();
    const set = {};
    let cambio = false;

    for (const campo of campos) {
      const valor = doc[campo];
      if (valor === null || valor === undefined) continue;
      if (typeof valor !== 'string') continue;

      const mapa = campo === 'prioridad' ? prioridadesMap : estadosMap;
      const nuevoId = mapa.get(valor) ?? null;
      set[campo] = nuevoId;
      cambio = true;
    }

    if (cambio) {
      await coleccion.updateOne({ _id: doc._id }, { $set: set });
      migrados++;
    }
  }

  return migrados;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado a MongoDB');
  const db = mongoose.connection.db;

  const tenants = await db.collection('tenants').find({}).project({ _id: 1 }).toArray();
  const estadosPorTenant = new Map();
  const prioridadesPorTenant = new Map();

  for (const tenant of tenants) {
    const tenantId = tenant._id.toString();
    const [estados, prioridades] = await Promise.all([
      db.collection('estados').find({ tenant_id: tenant._id }).toArray(),
      db.collection('prioridads').find({ tenant_id: tenant._id }).toArray(),
    ]);
    estadosPorTenant.set(tenantId, new Map(estados.map((e) => [e.value, e._id])));
    prioridadesPorTenant.set(tenantId, new Map(prioridades.map((p) => [p.value, p._id])));
  }

  const categoriasMigradas = await migrarColeccion(db, 'categorias', ['estado', 'prioridad'], estadosPorTenant, prioridadesPorTenant);
  const modulosMigrados = await migrarColeccion(db, 'modulos', ['estado', 'prioridad'], estadosPorTenant, prioridadesPorTenant);
  const requerimientosMigrados = await migrarColeccion(db, 'requerimientos', ['estado', 'prioridad', 'estado_anterior'], estadosPorTenant, prioridadesPorTenant);

  console.log(`Categorías migradas: ${categoriasMigradas}`);
  console.log(`Módulos migrados: ${modulosMigrados}`);
  console.log(`Requerimientos migrados: ${requerimientosMigrados}`);

  await mongoose.disconnect();
  console.log('Migración completada');
}

run().catch((error) => {
  console.error('Error en la migración:', error);
  process.exit(1);
});
