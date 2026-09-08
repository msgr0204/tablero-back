const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const authMiddleware = require('./middlewares/auth.middleware');
const adminMiddleware = require('./middlewares/admin.middleware');
const ambitoMiddleware = require('./middlewares/ambito.middleware');

const port = process.env.PORT || 2406;

connectDB();

const app = express();
const defaultAllowedOrigins = [
  'http://localhost:5200',
  'http://127.0.0.1:5200',
  'https://tablero-front.vercel.app',
];

function normalizeOrigin(origin) {
  return origin
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '');
}

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || defaultAllowedOrigins.join(','))
  .replace(/^['"]|['"]$/g, '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
      return callback(null, true);
    }

    console.warn(`Origen bloqueado por CORS: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Ambito', 'X-Owner-Id'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware para permitir CORS
// Límite explícito: el body de una petición no debería crecer sin techo, y los
// snapshots de auditoría se recortan aparte antes de guardarse.
app.use(express.json({ limit: '1mb' }));

//Rutas
const authRoutes = require('./routes/auth.routes');
const estadosRoutes = require('./routes/estados.routes');
const prioridadesRoutes = require('./routes/prioridades.routes');
const tiposRoutes = require('./routes/tipos.routes');
const categoriasRoutes = require('./routes/categorias.routes');
const modulosRoutes = require('./routes/modulos.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');
const plantillasBrandingRoutes = require('./routes/plantillasBranding.routes');
const tenantRoutes = require('./routes/tenant.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const metricasRoutes = require('./routes/metricas.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const tableroPersonalRoutes = require('./routes/tableroPersonal.routes');
const colaboradoresRoutes = require('./routes/colaboradores.routes');
const vistoRoutes = require('./routes/visto.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');

//Uso de rutas
app.use("/api/auth", authRoutes);
app.use("/api/plantillas-branding", plantillasBrandingRoutes);
app.use("/api/estados", authMiddleware, ambitoMiddleware, estadosRoutes);
app.use("/api/prioridades", authMiddleware, ambitoMiddleware, prioridadesRoutes);
app.use("/api/tipos", authMiddleware, ambitoMiddleware, tiposRoutes);
app.use("/api/categorias", authMiddleware, ambitoMiddleware, categoriasRoutes);
app.use("/api/modulos", authMiddleware, ambitoMiddleware, modulosRoutes);
app.use("/api/notificaciones", authMiddleware, notificacionesRoutes);
// El branding es la identidad de la empresa: lo cambia un administrador.
app.use("/api/tenant", authMiddleware, adminMiddleware, tenantRoutes);
app.use("/api/dashboard", authMiddleware, dashboardRoutes);
app.use("/api/metricas", authMiddleware, metricasRoutes);
app.use("/api/usuarios", authMiddleware, adminMiddleware, usuariosRoutes);
app.use("/api/tablero-personal", authMiddleware, tableroPersonalRoutes);
app.use("/api/colaboradores", authMiddleware, colaboradoresRoutes);
app.use("/api/visto", authMiddleware, vistoRoutes);
app.use("/api/auditoria", authMiddleware, ambitoMiddleware, auditoriaRoutes);


app.get('/', (req, res) => {
  res.send('API de gestión para Quantum Infinty Technologies');
});


app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${port}`);
});
