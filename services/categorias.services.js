const Categoria = require('../models/Categoria');
const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const Estado = require('../models/Estado');
const notificacionesService = require('./notificaciones.services');
const historialService = require('./historial.services');
const hayCambiosReales = require('../utils/hayCambiosReales');
const calcularCambios = require('../utils/calcularCambios');
const { auditar, resolverCatalogo, ACCIONES } = require('./auditoria.services');
const idsIguales = require('../utils/idsIguales');
const { limpiarCamposProtegidos } = require('../utils/camposProtegidos');
const { exigir } = require('../utils/permisos');

// El tablero personal es silencioso por ahora: no genera notificaciones ni
// historial (se cubre en su propio roadmap). Solo el ámbito empresa los emite.
function esEmpresa(ctx) {
  return ctx.ambito === 'empresa';
}

async function resolverPrioridad(ctx, estado, prioridad) {
  if (!estado) return prioridad ?? null;
  const estadoDoc = await Estado.findOne({ ...ctx, _id: estado });
  if (estadoDoc?.es_estado_final) return null;
  return prioridad ?? null;
}

// ¿El estado destino es un estado de cierre? Poner un ítem en estado final es
// potestad solo del dueño del tablero (regla de permisos), así que hay que
// detectarlo para bloquear a los colaboradores.
async function esEstadoFinal(ctx, estadoId) {
  if (!estadoId) return false;
  const estadoDoc = await Estado.findOne({ ...ctx, _id: estadoId });
  return !!estadoDoc?.es_estado_final;
}

async function withCounts(ctx, categorias) {
  const lista = Array.isArray(categorias) ? categorias : [categorias];
  const result = await Promise.all(
    lista.map(async (cat) => {
      const modulos = await Modulo.find({ ...ctx, ...ctx.filtroVisibilidad(), categoria_id: cat._id, eliminado_at: null }).select('_id');
      const moduloIds = modulos.map((m) => m._id);
      const totalRequerimientos = await Requerimiento.countDocuments({ ...ctx, modulo_id: { $in: moduloIds }, eliminado_at: null });
      return {
        ...cat.toObject(),
        totalModulos: modulos.length,
        totalRequerimientos,
      };
    })
  );
  return Array.isArray(categorias) ? result : result[0];
}

async function getAll(ctx) {
  const categorias = await Categoria.find({ ...ctx, ...ctx.filtroVisibilidad(), eliminado_at: null }).sort({ orden: 1 });
  return withCounts(ctx, categorias);
}

async function getById(ctx, id) {
  const categoria = await Categoria.findOne({ ...ctx, ...ctx.filtroVisibilidad(), _id: id, eliminado_at: null });
  if (!categoria) return null;
  return withCounts(ctx, categoria);
}

async function create(ctx, payload) {
  if (!payload.nombre || !payload.nombre.trim()) {
    throw new Error('El nombre de la categoría es obligatorio');
  }
  if (await esEstadoFinal(ctx, payload.estado)) {
    exigir(ctx.puedeCerrar(), 'No puedes crear esta categoría ya entregada');
  }
  const total = await Categoria.countDocuments({ ...ctx });
  const prioridad = await resolverPrioridad(ctx, payload.estado, payload.prioridad);
  // Solo el dueño decide público/privado; lo que crea un colaborador es siempre público.
  const visibilidad = ctx.puedeMarcarVisibilidad() && payload.visibilidad === 'privado' ? 'privado' : 'publico';
  const categoria = await Categoria.create({ ...payload, ...ctx, ...ctx.sello, prioridad, visibilidad, orden: total });


  await auditar(ctx, {
    accion: ACCIONES.CREAR,
    entidad: 'Categoria',
    entidad_id: categoria._id,
    entidad_nombre: categoria.nombre,
    contexto: { categoria_id: categoria._id },
  });

  if (esEmpresa(ctx)) {
    await notificacionesService.crear(
      ctx.tenant_id,
      'categoria_creada',
      `Se creó la categoría "${categoria.nombre}"`,
      'Categoria',
      categoria._id
    );
  }

  return withCounts(ctx, categoria);
}

async function update(ctx, id, payload) {
  const anterior = await Categoria.findOne({ ...ctx, _id: id });
  if (!anterior) return null;

  exigir(ctx.puedeModificar(anterior), 'Solo quien creó esta categoría o un administrador puede editarla');

  const data = limpiarCamposProtegidos(payload);
  // La visibilidad solo la cambia el dueño; si un colaborador la envía, se ignora.
  if ('visibilidad' in data && !ctx.puedeMarcarVisibilidad()) {
    delete data.visibilidad;
  }
  if ('nombre' in data && !data.nombre.trim()) {
    throw new Error('El nombre de la categoría es obligatorio');
  }
  if ('estado' in data) {
    // Igual que en requerimientos: el formulario de edición es la otra vía tanto
    // para entregar como para deshacer una entrega.
    if (!idsIguales(data.estado, anterior.estado)) {
      if (await esEstadoFinal(ctx, data.estado)) {
        exigir(ctx.puedeCerrar(), 'No puedes marcar esta categoría como entregada');
      }
      if (await esEstadoFinal(ctx, anterior.estado)) {
        exigir(ctx.puedeReabrir(), 'Solo un administrador puede reabrir esta categoría entregada');
      }
    }
    data.prioridad = await resolverPrioridad(ctx, data.estado, data.prioridad);
  }

  if (!hayCambiosReales(anterior, data)) {
    return withCounts(ctx, anterior);
  }

  const categoria = await Categoria.findOneAndUpdate({ ...ctx, _id: id }, data, { new: true });
  if (!categoria) return null;

  await auditar(ctx, {
    accion: ACCIONES.EDITAR,
    entidad: 'Categoria',
    entidad_id: categoria._id,
    entidad_nombre: categoria.nombre,
    contexto: { categoria_id: categoria._id },
    cambios: calcularCambios(anterior, data, await resolverCatalogo(ctx)),
  });

  if (esEmpresa(ctx)) {
    if ('estado' in data && !idsIguales(data.estado, anterior.estado)) {
      await historialService.registrar(ctx.tenant_id, 'Categoria', categoria._id, anterior.estado, categoria.estado);
      await notificacionesService.crear(
        ctx.tenant_id,
        'categoria_estado_cambiado',
        `La categoría "${categoria.nombre}" cambió de estado`,
        'Categoria',
        categoria._id
      );
    } else {
      await notificacionesService.crear(
        ctx.tenant_id,
        'categoria_editada',
        `Se editó la categoría "${categoria.nombre}"`,
        'Categoria',
        categoria._id
      );
    }
  }

  return withCounts(ctx, categoria);
}

async function remove(ctx, id) {
  const categoria = await Categoria.findOne({ ...ctx, _id: id });
  if (!categoria) return null;

  exigir(ctx.puedeEliminar(categoria), 'Solo quien creó esta categoría o un administrador puede eliminarla');

  const modulos = await Modulo.find({ ...ctx, categoria_id: id, eliminado_at: null }).select('_id nombre');
  const moduloIds = modulos.map((m) => m._id);
  // Cuántos requerimientos se van con ella: borrar una categoría arrastra
  // trabajo de otras personas, y el log debe decir cuánto.
  const totalReqs = await Requerimiento.countDocuments({ ...ctx, modulo_id: { $in: moduloIds }, eliminado_at: null });

  const eliminado_at = new Date();
  await Promise.all([
    Requerimiento.updateMany({ ...ctx, modulo_id: { $in: moduloIds } }, { eliminado_at }),
    Modulo.updateMany({ ...ctx, categoria_id: id }, { eliminado_at }),
  ]);

  const eliminada = await Categoria.findOneAndUpdate({ ...ctx, _id: id }, { eliminado_at }, { new: true });

  await auditar(ctx, {
    accion: ACCIONES.ELIMINAR,
    entidad: 'Categoria',
    entidad_id: categoria._id,
    entidad_nombre: categoria.nombre,
    contexto: { categoria_id: categoria._id },
    snapshot: {
      descripcion: categoria.descripcion,
      creado_por: categoria.creado_por,
      arrastro: { modulos: modulos.length, requerimientos: totalReqs },
      modulos_afectados: modulos.map((m) => m.nombre),
    },
  });

  if (esEmpresa(ctx)) {
    await notificacionesService.crear(
      ctx.tenant_id,
      'categoria_eliminada',
      `Se eliminó la categoría "${categoria.nombre}"`,
      'Categoria',
      categoria._id
    );
  }

  return eliminada;
}

async function reorder(ctx, orderedIds) {
  // Reordenar organiza el tablero completo (no un ítem propio): en un tablero
  // personal compartido, solo el dueño reordena.
  exigir(ctx.puedeReordenar(), 'No puedes reordenar este tablero');
  const ordenPrevio = await Categoria.find({ ...ctx, eliminado_at: null }).sort({ orden: 1 }).select('nombre');

  await Promise.all(
    orderedIds.map((id, index) => Categoria.findOneAndUpdate({ ...ctx, _id: id }, { orden: index }))
  );

  const resultado = await getAll(ctx);
  await auditar(ctx, {
    accion: ACCIONES.REORDENAR,
    entidad: 'Categoria',
    entidad_nombre: `${orderedIds.length} categoría(s)`,
    snapshot: { antes: ordenPrevio.map((c) => c.nombre), despues: resultado.map((c) => c.nombre) },
  });
  return resultado;
}

module.exports = { getAll, getById, create, update, remove, reorder };
