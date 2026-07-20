const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const Tenant = require('../models/Tenant');
const Estado = require('../models/Estado');
const Prioridad = require('../models/Prioridad');
const Tipo = require('../models/Tipo');

const SALT_ROUNDS = 10;

const ESTADOS_INICIALES = [
  { value: 'pendiente', label: 'Pendiente', color: '#38BDF8', es_estado_final: false, orden: 0 },
  { value: 'en_analisis', label: 'En análisis', color: '#FACC15', es_estado_final: false, orden: 1 },
  { value: 'desarrollo', label: 'Desarrollo', color: '#A78BFA', es_estado_final: false, orden: 2 },
  { value: 'pruebas', label: 'Pruebas', color: '#FB923C', es_estado_final: false, orden: 3 },
  { value: 'entregado', label: 'Entregado', color: '#57F0FE', es_estado_final: true, orden: 4 },
];

const PRIORIDADES_INICIALES = [
  { value: 'critica', label: 'Crítica', color: '#B33E3F', orden: 0 },
  { value: 'alta', label: 'Alta', color: '#FB923C', orden: 1 },
  { value: 'media', label: 'Media', color: '#FACC15', orden: 2 },
  { value: 'baja', label: 'Baja', color: '#57F0FE', orden: 3 },
];

const TIPOS_INICIALES = [
  { value: 'nueva_funcionalidad', label: 'Nueva funcionalidad', color: '#38BDF8', orden: 0 },
  { value: 'mejora', label: 'Mejora', color: '#57F0FE', orden: 1 },
  { value: 'error', label: 'Error', color: '#B33E3F', orden: 2 },
  { value: 'solicitud_cliente', label: 'Solicitud cliente', color: '#A78BFA', orden: 3 },
  { value: 'deuda_tecnica', label: 'Deuda técnica', color: '#FACC15', orden: 4 },
];

async function crearCatalogoInicial(tenantId) {
  await Promise.all([
    Estado.insertMany(ESTADOS_INICIALES.map((e) => ({ ...e, tenant_id: tenantId }))),
    Prioridad.insertMany(PRIORIDADES_INICIALES.map((p) => ({ ...p, tenant_id: tenantId }))),
    Tipo.insertMany(TIPOS_INICIALES.map((t) => ({ ...t, tenant_id: tenantId }))),
  ]);
}

function firmarToken(usuario) {
  return jwt.sign(
    { usuario_id: usuario._id, tenant_id: usuario.tenant_id, nombre: usuario.nombre, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' }
  );
}

async function register({ nombre, email, password, nombreEmpresa }) {
  if (!nombre || !nombre.trim()) {
    throw new Error('El nombre es obligatorio');
  }
  if (!email || !email.trim()) {
    throw new Error('El correo es obligatorio');
  }
  if (!password || password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }
  if (!nombreEmpresa || !nombreEmpresa.trim()) {
    throw new Error('El nombre de la empresa es obligatorio');
  }

  const existente = await Usuario.findOne({ email: email.trim().toLowerCase() });
  if (existente) {
    throw new Error('Ya existe una cuenta registrada con este correo');
  }

  const tenant = await Tenant.create({ nombre: nombreEmpresa.trim() });
  await crearCatalogoInicial(tenant._id);

  const passwordHasheado = await bcrypt.hash(password, SALT_ROUNDS);
  const usuario = await Usuario.create({
    nombre: nombre.trim(),
    email: email.trim().toLowerCase(),
    password: passwordHasheado,
    tenant_id: tenant._id,
    rol: 'admin',
  });

  const token = firmarToken(usuario);

  return {
    token,
    usuario: { id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    tenant: { id: tenant._id, nombre: tenant.nombre, logoUrl: tenant.logoUrl, colors: tenant.colors, personalizado: tenant.personalizado },
  };
}

async function login({ email, password }) {
  if (!email || !password) {
    throw new Error('Correo y contraseña son obligatorios');
  }

  const usuario = await Usuario.findOne({ email: email.trim().toLowerCase() });
  if (!usuario) {
    throw new Error('Correo o contraseña incorrectos');
  }

  const passwordValido = await bcrypt.compare(password, usuario.password);
  if (!passwordValido) {
    throw new Error('Correo o contraseña incorrectos');
  }

  const tenant = await Tenant.findById(usuario.tenant_id);

  const token = firmarToken(usuario);

  return {
    token,
    usuario: { id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    tenant: { id: tenant._id, nombre: tenant.nombre, logoUrl: tenant.logoUrl, colors: tenant.colors, personalizado: tenant.personalizado },
  };
}

async function getPerfil(usuarioId) {
  const usuario = await Usuario.findById(usuarioId);
  if (!usuario) return null;
  const tenant = await Tenant.findById(usuario.tenant_id);
  return {
    usuario: { id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    tenant: { id: tenant._id, nombre: tenant.nombre, logoUrl: tenant.logoUrl, colors: tenant.colors, personalizado: tenant.personalizado },
  };
}

module.exports = { register, login, getPerfil };
