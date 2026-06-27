const { randomUUID } = require('crypto');
const sharp = require('sharp');
const bucket = require('../config/firebase');

const PREFIJO_RAIZ = 'tareq';
const ANCHO_MAXIMO_PX = 1600;

async function optimizarImagen(buffer) {
  return sharp(buffer)
    .resize({ width: ANCHO_MAXIMO_PX, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

async function subirImagen(rutaCarpeta, buffer) {
  const optimizado = await optimizarImagen(buffer);
  const ruta = `${PREFIJO_RAIZ}/${rutaCarpeta}/${randomUUID()}.webp`;
  const archivo = bucket.file(ruta);

  await archivo.save(optimizado, { contentType: 'image/webp' });
  await archivo.makePublic();

  return { url: `https://storage.googleapis.com/${bucket.name}/${ruta}`, ruta };
}

async function eliminarImagen(ruta) {
  if (!ruta) return;
  await bucket.file(ruta).delete({ ignoreNotFound: true });
}

/**
 * Las URLs guardadas son públicas (https://storage.googleapis.com/...), pero
 * para borrar del bucket se necesita la ruta interna del archivo, no la URL
 * completa — se reconstruye quitando el host y el nombre del bucket.
 */
function rutaDesdeUrl(url) {
  if (!url) return null;
  const prefijo = `https://storage.googleapis.com/${bucket.name}/`;
  if (!url.startsWith(prefijo)) return null;
  return url.slice(prefijo.length);
}

module.exports = { subirImagen, eliminarImagen, rutaDesdeUrl };
