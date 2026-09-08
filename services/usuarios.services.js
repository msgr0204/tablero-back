const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

const SALT_ROUNDS = 10;

// Campos de perfil que el cliente puede escribir libremente (todo opcional).
// Se recortan y se pasan a string para no guardar tipos raros; el documento se
// valida aparte solo si viene con contenido.
function extraerPerfil(payload) {
  const perfil = {};
  for (const campo of ['cargo', 'telefono', 'documento', 'ubicacion']) {
    if (campo in payload) perfil[campo] = String(payload[campo] ?? '').trim();
  }
  if (perfil.documento && !/^\d{4,15}$/.test(perfil.documento)) {
    throw new Error('El documento debe tener entre 4 y 15 dígitos');
  }
  return perfil;
}

async function contarAdmins(tenantId) {
  return Usuario.countDocuments({ tenant_id: tenantId, rol: 'admin' });
}

async function getAll(tenantId) {
  return Usuario.find({ tenant_id: tenantId }).select('-password').sort({ created_at: 1 });
}

// Lectura puntual para que la auditoría pueda comparar contra el estado previo.
async function getById(tenantId, id) {
  return Usuario.findOne({ _id: id, tenant_id: tenantId }).select('-password').lean();
}

async function create(tenantId, payload) {
  const { nombre, email, password, rol } = payload;
  if (!nombre || !nombre.trim()) {
    throw new Error('El nombre es obligatorio');
  }
  if (!email || !email.trim()) {
    throw new Error('El correo es obligatorio');
  }
  if (!password || password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }

  const existente = await Usuario.findOne({ email: email.trim().toLowerCase() });
  if (existente) {
    throw new Error('Ya existe una cuenta registrada con este correo');
  }

  const perfil = extraerPerfil(payload);

  const passwordHasheado = await bcrypt.hash(password, SALT_ROUNDS);
  const usuario = await Usuario.create({
    nombre: nombre.trim(),
    email: email.trim().toLowerCase(),
    password: passwordHasheado,
    tenant_id: tenantId,
    rol: rol === 'miembro' ? 'miembro' : 'admin',
    activo: payload.activo === false ? false : true,
    ...perfil,
  });

  const { password: _password, ...usuarioSinPassword } = usuario.toObject();
  return usuarioSinPassword;
}

async function update(tenantId, id, payload, usuarioActualId) {
  const usuario = await Usuario.findOne({ _id: id, tenant_id: tenantId });
  if (!usuario) return null;

  const data = {};
  if ('nombre' in payload) {
    if (!payload.nombre || !payload.nombre.trim()) {
      throw new Error('El nombre es obligatorio');
    }
    data.nombre = payload.nombre.trim();
  }
  if ('rol' in payload) {
    const esElMismo = id === usuarioActualId.toString();
    const dejariaSinAdmin = usuario.rol === 'admin' && payload.rol !== 'admin' && (await contarAdmins(tenantId)) <= 1;
    if (esElMismo && payload.rol !== 'admin') {
      throw new Error('No puedes quitarte el rol de administrador a ti mismo');
    }
    if (dejariaSinAdmin) {
      throw new Error('Debe existir al menos un administrador en la empresa');
    }
    data.rol = payload.rol === 'miembro' ? 'miembro' : 'admin';
  }
  if ('password' in payload && payload.password) {
    if (payload.password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    data.password = await bcrypt.hash(payload.password, SALT_ROUNDS);
  }
  if ('activo' in payload) {
    const esElMismo = id === usuarioActualId.toString();
    if (esElMismo && payload.activo === false) {
      throw new Error('No puedes desactivar tu propia cuenta');
    }
    data.activo = payload.activo !== false;
  }

  Object.assign(data, extraerPerfil(payload));

  const actualizado = await Usuario.findByIdAndUpdate(id, data, { new: true }).select('-password');
  return actualizado;
}

async function remove(tenantId, id, usuarioActualId) {
  const usuario = await Usuario.findOne({ _id: id, tenant_id: tenantId });
  if (!usuario) return null;

  if (id === usuarioActualId.toString()) {
    throw new Error('No puedes eliminar tu propia cuenta');
  }
  if (usuario.rol === 'admin' && (await contarAdmins(tenantId)) <= 1) {
    throw new Error('Debe existir al menos un administrador en la empresa');
  }

  return Usuario.findByIdAndDelete(id);
}

module.exports = { getAll, getById, create, update, remove };
