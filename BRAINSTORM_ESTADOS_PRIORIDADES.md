# Brainstorm pendiente: escalabilidad de Estados/Prioridades por tenant

Pendiente de decisión. No implementado todavía — solo diagnóstico y opciones para retomar después.

## El problema

Cada tenant nuevo (`auth.services.js#register`) crea sus propios 5 Estados + 5 Prioridades como documentos sueltos en las colecciones `estados` y `prioridads`, filtrados por `tenant_id`. No hay catálogo compartido: cada tenant tiene su propia copia física desde el registro.

Con 200 tenants × 10 documentos (5 estados + 5 prioridades) = 2000 documentos. El volumen en sí no es un problema técnico real para MongoDB (maneja millones de documentos chicos sin esfuerzo), pero sí:
- Ensucia la visibilidad/auditoría de los datos (cuesta distinguir "catálogo real" de "ruido de copias casi idénticas" mirando la colección directo).
- Implica N queries pequeñas por tenant en vez de una lectura eficiente.

Confirmado con el usuario: la mayoría de los tenants **sí termina personalizando** su catálogo tarde o temprano (no es un caso raro). Esto descarta cualquier solución basada en "plantilla global + copiar solo cuando se edita" — la copia ocurriría casi siempre igual, sin ahorro real, solo complejidad extra.

## Hallazgo lateral (no es el problema de fondo, pero originó esta conversación)

Se encontró un documento con `value: "editado"` y `label: "Pendiente"` desincronizados. Diagnóstico: resto de un bug ya corregido en el código actual — en algún momento pasado, `update()` regeneraba `value = slugify(label)` en cada edición; el código actual (`estados.services.js#update`, `prioridades.services.js#update`) ya NO toca `value` en update, solo en `create()`. El dato suelto es histórico, no reproducible con el código de hoy. No se corrigió ese documento puntual — queda pendiente si se quiere prolijidad, pero no es urgente (el `_id` real es el identificador usado en toda referencia, `value` es solo un slug legible interno).

## Opciones evaluadas

**A. Plantilla global + copia perezosa (lazy copy) por documento individual**
Colección `EstadosDefault`/`PrioridadesDefault` sin `tenant_id`. El tenant "hereda" la plantilla mientras no la toque; solo al editar se genera su copia personalizada. *Descartada* tras confirmar que la mayoría sí personaliza — la copia ocurriría casi siempre, sin ahorro real, y agrega complejidad de fallback en cada lectura.

**B. No cambiar nada (el problema es solo percepción de volumen)**
Mongo soporta el volumen sin problema técnico. *Descartada parcialmente* — el usuario confirmó que también le preocupa la limpieza/auditoría de los datos, no solo performance, así que vale la pena resolverlo igual.

**C. Flag `personalizado` a nivel tenant (todo o nada)**
Variante de A pero copiando los 5 documentos completos de una sola vez en la primera edición, en vez de por documento individual. Misma objeción que A: si casi todos personalizan, el ahorro es marginal.

**D. Un solo documento de catálogo por tenant (array embebido) — opción que se estaba explorando al cortar la conversación**
En vez de 5-10 documentos sueltos por tenant, una colección `catalogos_estados` (y `catalogos_prioridades`) con **un documento por tenant**, conteniendo un array de sub-documentos:

```js
// colección "catalogos_estados", 1 documento por tenant (índice único en tenant_id)
{
  _id: ObjectId,
  tenant_id: ObjectId,
  items: [
    { _id: ObjectId, value: "pendiente", label: "Pendiente", color: "#38BDF8", es_estado_final: false, orden: 0 },
    { _id: ObjectId, value: "en_analisis", label: "En análisis", color: "#ffdc52", es_estado_final: false, orden: 1 },
  ]
}
```

Ventajas:
- 200 tenants = 200 documentos (no 2000) en cada colección de catálogo.
- Los `_id` de cada item siguen siendo ObjectId reales — `Categoria.estado`/`Modulo.estado`/`Requerimiento.estado`/`prioridad` no cambian en nada, siguen guardando ese `_id` exactamente igual que hoy.
- `getAll(tenantId)` pasa de `find()` a `findOne()` — una lectura en vez de N.
- Reordenar pasa de N `findOneAndUpdate` en paralelo a un solo update reemplazando el array.

Costo:
- Cambio de modelo real: todas las funciones de `estados.services.js`/`prioridades.services.js` pasan de operar sobre documentos sueltos a operar sobre un array embebido (`$push`, `$pull`, posicional o `arrayFilters` para editar un item puntual).
- Requiere migración de datos existentes: agrupar los documentos sueltos actuales por `tenant_id` en el nuevo formato de array (mismo patrón que `scripts/migrarEstadosPrioridades.js`: driver nativo de Mongo, no los modelos Mongoose, para no chocar con el cambio de schema).

## Preguntas abiertas para retomar

1. ¿Avanzamos con la opción D (array embebido, un documento de catálogo por tenant)? Es la que quedó mejor posicionada dado que la mayoría de tenants personaliza.
2. Si se acepta D: ¿edición de un item individual dentro del array se hace con `arrayFilters` de Mongo, o se trae el documento completo, se modifica en memoria y se reemplaza el array entero? (afecta concurrencia: dos ediciones simultáneas sobre el mismo tenant podrían pisarse si se reemplaza el array completo sin atomicidad por item).
3. ¿El límite de items por catálogo (estados/prioridades) preocupa para el tamaño máximo de documento de MongoDB (16MB)? Casi seguro no es un problema real dado el tamaño de cada item, pero vale confirmarlo si en el futuro se permiten catálogos con muchísimos estados.
4. ¿Se corrige el dato suelto (`value: "editado"`/`label: "Pendiente"`) como parte de la misma migración, o se ignora porque no afecta funcionalidad?
5. Si se decide NO tocar el modelo (opción B), ¿alcanza con agregar índices (`tenant_id`) y/o herramientas de auditoría en Compass para resolver solo el dolor de "limpieza visual", sin migrar nada?
