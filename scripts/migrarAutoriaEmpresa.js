require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Reconstruye `creado_por_id` en los ítems de empresa que solo tienen el nombre
 * del autor.
 *
 * El nombre (`creado_por`) se guardó desde el principio; el id se empezó a
 * sellar después. Sin ese id no se puede distinguir "lo mío" de "lo ajeno", que
 * es la base de la matriz de permisos: el código compara por id y no por nombre
 * porque un nombre puede repetirse o cambiar, y el permiso quedaría a merced de
 * un renombrado.
 *
 * Solo rellena donde falta; nunca reescribe una autoría ya sellada. Un nombre
 * que no corresponda a ningún usuario se deja intacto y se reporta, en vez de
 * adjudicárselo a alguien que no lo creó.
 *
 * Uso:
 *   node scripts/migrarAutoriaEmpresa.js --dry-run   (simula, no escribe)
 *   node scripts/migrarAutoriaEmpresa.js             (aplica)
 */
const COLECCIONES = ['categorias', 'modulos', 'requerimientos'];

const clave = (nombre) => String(nombre ?? '').trim().toLowerCase();

async function run() {
  const simulacion = process.argv.includes('--dry-run');

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log(simulacion ? '— SIMULACIÓN (no se escribe nada) —\n' : '— APLICANDO CAMBIOS —\n');

  const usuarios = await db.collection('usuarios').find({}).project({ nombre: 1 }).toArray();
  const porNombre = new Map(usuarios.map((u) => [clave(u.nombre), u._id]));

  const sinCoincidencia = new Map();
  let totalActualizados = 0;

  for (const coleccion of COLECCIONES) {
    const pendientes = await db.collection(coleccion)
      .find({ ambito: 'empresa', creado_por_id: null })
      .project({ creado_por: 1 })
      .toArray();

    // Se agrupan por autor para resolver cada nombre con un solo updateMany en
    // vez de una escritura por documento.
    const porAutor = new Map();
    for (const item of pendientes) {
      const k = clave(item.creado_por);
      const usuarioId = porNombre.get(k);
      if (!usuarioId) {
        sinCoincidencia.set(item.creado_por, (sinCoincidencia.get(item.creado_por) ?? 0) + 1);
        continue;
      }
      if (!porAutor.has(k)) porAutor.set(k, { usuarioId, ids: [] });
      porAutor.get(k).ids.push(item._id);
    }

    let actualizados = 0;
    for (const [, { usuarioId, ids }] of porAutor) {
      if (!simulacion) {
        await db.collection(coleccion).updateMany(
          { _id: { $in: ids } },
          { $set: { creado_por_id: usuarioId } }
        );
      }
      actualizados += ids.length;
    }

    totalActualizados += actualizados;
    console.log(`${coleccion.padEnd(16)} ${String(actualizados).padStart(4)} de ${pendientes.length} pendientes`);
  }

  console.log(`\nTotal: ${totalActualizados} ítems con autoría ${simulacion ? 'recuperable' : 'restaurada'}`);

  if (sinCoincidencia.size) {
    console.log('\nSin usuario coincidente (se dejan sin autor, quedan solo para administradores):');
    for (const [nombre, n] of sinCoincidencia) console.log(`  "${nombre}" → ${n} ítem(s)`);
  }

  if (simulacion) console.log('\nNada se escribió. Ejecuta sin --dry-run para aplicar.');

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error('Error en la migración:', error);
  process.exit(1);
});
