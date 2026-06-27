# Tablero de Requerimientos — Backend

API Node/Express + MongoDB (Mongoose), multi-tenant. Dominio: Tenant (empresa) → Usuario → Categoria → Modulo → Requerimiento, con Estado/Prioridad como catálogos editables por tenant, y Notificacion como log de eventos.

## Disciplina de código (no negociable, lo que nos ha funcionado)

- Código profesional, 0 parches, full limpio, 100% escalable. Si una capa no aplica a un cambio, no se toca "por si acaso".
- Cero comentarios de QUÉ. Solo PORQUÉ cuando hay una decisión no obvia — ver ejemplos reales abajo (`utils/idsIguales.js`, `utils/hayCambiosReales.js`).
- Nunca abstraer antes de tener 2-3 casos reales que lo pidan. Los 5 controllers de catálogo (`categorias`, `modulos`, `requerimientos`, `estados`, `prioridades`) son casi idénticos en estructura y NO se unificaron en un controller genérico — la repetición explícita es preferible aquí.
- Validar solo en el borde (body del request, antes de tocar Mongo). Nunca validar "por si el dato interno está mal" — si está mal, es un bug en otra capa, no algo que tapar aquí.

## El patrón exacto, capa por capa (replicar literal para cualquier entidad nueva)

Cuatro capas siempre, nunca te las puedes saltar: `routes/*.routes.js` → `controllers/*.controllers.js` → `services/*.services.js` → `models/*.js`.

**`controllers/categorias.controllers.js`** — referencia de cómo se ve un controller correcto:
```js
async function create(req, res) {
  try {
    const categoria = await categoriasService.create(req.tenant_id, { ...req.body, creado_por: req.usuario_nombre });
    res.status(201).json(categoria);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
```
- El controller NUNCA toca Mongoose directo. Solo: extrae de `req`, llama UNA función del service, mapea el resultado/error a un status code.
- `req.tenant_id` siempre es el primer argumento que se le pasa al service (lo inyecta `middlewares/auth.middleware.js`).
- `error.name === 'CastError'` → 400 "ID de X inválido" (id mal formado). Cualquier otro error del service → 400 con `error.message` tal cual (los services lanzan `Error('mensaje en español ya listo para mostrar al usuario')`).
- `getAll`/`getById` que fallan por causa del servidor (no del cliente) → 500. `create`/`update`/`remove` → 400 (se asume que el error es validación, no infraestructura).

**`services/*.services.js`** — toda la lógica de negocio, siempre con `tenantId` como primer parámetro de cada función exportada. Patrón de `update` (ver `categorias.services.js`, `modulos.services.js`, `requerimientos.services.js`):
1. `findOne({ _id: id, tenant_id: tenantId })` para traer el "anterior" — nunca un `findByIdAndUpdate` directo sin haber confirmado antes que pertenece al tenant.
2. Validar el payload (ej. `nombre` no vacío).
3. `if (!hayCambiosReales(anterior, data)) return <documento sin tocar>` — nunca se llega a Mongo si nada cambió de verdad.
4. `findOneAndUpdate({ _id: id, tenant_id: tenantId }, data, { new: true })`.
5. Notificar (`notificacionesService.crear(...)`) solo si el paso 3 no cortó antes.

## Multi-tenancy: `tenant_id` denormalizado, sin joins

Cada colección de dominio lo lleva como campo obligatorio. Cada query de cada service lo usa como filtro — es la única frontera de seguridad real entre tenants, así que un `findOne({ _id: id })` sin `tenant_id` en el filtro es un bug de seguridad, no un detalle de estilo. Todas las rutas pasan por `authMiddleware` excepto `/api/auth` y `/api/plantillas-branding` (catálogo público, sin datos de tenant).

## Identificadores: SIEMPRE `_id` real, nunca un slug de texto editable

Bug real ya corregido y por qué importa: `Estado`/`Prioridad` tenían `value` (slug derivado de `label`, vía `utils/slugify.js`) que se regeneraba cada vez que el usuario renombraba el `label`. Como `Categoria.estado`/`Modulo.estado`/`Requerimiento.estado`/`prioridad` guardaban ese `value` como string, renombrar un estado dejaba huérfanos todos los registros que ya lo usaban (apuntaban a un slug que ya no existía en ningún lado).

Fix de fondo aplicado (replicar este patrón para cualquier catálogo editable futuro):
- `Categoria.estado`, `Modulo.estado`, `Requerimiento.estado`/`prioridad`/`estado_anterior` son `{ type: mongoose.Schema.Types.ObjectId, ref: 'Estado' }` (o `'Prioridad'`), nunca `String`.
- `value` en `Estado`/`Prioridad` se sigue generando con `slugify(label)` SOLO en `create()`. En `update()` NUNCA se regenera, aunque el `label` cambie 100 veces — ver `services/estados.services.js#update` y `services/prioridades.services.js#update`.
- Comparar dos ObjectId con `===`/`!==` es un bug silencioso (son objetos, nunca son `===` aunque representen el mismo id). Usar siempre `utils/idsIguales.js`. Ejemplo real en `categorias.services.js`: `if ('estado' in data && !idsIguales(data.estado, anterior.estado))`.
- `services/requerimientos.services.js#toggleCompletado` NO hardcodea ningún valor de estado — busca dinámicamente `Estado.findOne({ tenant_id, es_estado_final: true })` para saber a qué estado mover el requerimiento al completarlo.
- Migraciones de datos viejos (cuando un schema cambia de tipo sobre datos ya existentes) van en `scripts/` y usan el driver nativo de Mongo (`mongoose.connection.db.collection('categorias').find()/updateOne()`), nunca los modelos Mongoose — si el modelo ya espera `ObjectId` y el dato guardado es un string viejo, Mongoose lanza `CastError` al leer con `.find()` del modelo. Ver `scripts/migrarEstadosPrioridades.js` como plantilla exacta.

## Utils compartidos (no reinventar, ya existen)

- `utils/idsIguales.js`: comparar dos valores que pueden ser ObjectId/string/null.
- `utils/hayCambiosReales.js`: comparar `anterior` vs `payload` campo por campo (normaliza Date y ObjectId a string) antes de cualquier update/notificación.
- `utils/slugify.js`: solo para generar el `value` legible de un catálogo nuevo, una sola vez en `create()`.

## Notificaciones

`services/notificaciones.services.js` — se crea una notificación en cada mutación relevante (`crear(tenantId, tipo, mensaje, entidad, entidad_id)`). El destino de navegación (a qué categoría/módulo/requerimiento lleva el link) se resuelve dinámicamente en `getAll`/`getPaginado` vía `resolverDestino()`, nunca se guarda fijo en el documento — así nunca queda desincronizado si algo se reorganiza después, y se puede detectar si la entidad ya fue eliminada (destino `null`).

## Cómo trabajamos en este proyecto

- El usuario prueba todo manualmente él mismo en su navegador/Postman — nunca correr `npm run dev`/levantar el servidor salvo que lo pida explícitamente. Solo decir qué se cambió y, si aplica, qué comando correr (ej. el script de migración).
- Cambios que toquen el modelo de datos (tipo de un campo, nueva relación, migración de datos existentes) se confirman con el usuario ANTES de tocar código — preguntar el alcance exacto, no asumirlo. Ejemplo real: antes de migrar `estado`/`prioridad` a ObjectId se preguntó explícitamente si confirmaba el cambio sabiendo que ya tenía datos de prueba creados.
- Cuando una tarea toca más de ~5 archivos en cascada, usar TodoWrite para trackearla — no perder el hilo a mitad de una migración grande.
- Al terminar: resumen corto de qué cambió y por qué, no narración de cada paso intermedio.
