const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const authMiddleware = require('./middlewares/auth.middleware');
const adminMiddleware = require('./middlewares/admin.middleware');

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
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware para permitir CORS
app.use(express.json());

//Rutas
const authRoutes = require('./routes/auth.routes');
const estadosRoutes = require('./routes/estados.routes');
const prioridadesRoutes = require('./routes/prioridades.routes');
const categoriasRoutes = require('./routes/categorias.routes');
const modulosRoutes = require('./routes/modulos.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');
const plantillasBrandingRoutes = require('./routes/plantillasBranding.routes');
const tenantRoutes = require('./routes/tenant.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const metricasRoutes = require('./routes/metricas.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

//Uso de rutas
app.use("/api/auth", authRoutes);
app.use("/api/plantillas-branding", plantillasBrandingRoutes);
app.use("/api/estados", authMiddleware, estadosRoutes);
app.use("/api/prioridades", authMiddleware, prioridadesRoutes);
app.use("/api/categorias", authMiddleware, categoriasRoutes);
app.use("/api/modulos", authMiddleware, modulosRoutes);
app.use("/api/notificaciones", authMiddleware, notificacionesRoutes);
app.use("/api/tenant", authMiddleware, tenantRoutes);
app.use("/api/dashboard", authMiddleware, dashboardRoutes);
app.use("/api/metricas", authMiddleware, metricasRoutes);
app.use("/api/usuarios", authMiddleware, adminMiddleware, usuariosRoutes);


app.get('/', (req, res) => {
  res.send('API de gestión para Quantum Infinty Technologies');
});


app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${port}`);
});
