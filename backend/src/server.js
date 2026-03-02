const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Importar rutas existentes
const clienteRoutes = require('./routes/clienteRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const pagoRoutes = require('./routes/pagoRoutes');
const estadoRoutes = require('./routes/estadoRoutes');
const productoRoutes = require('./routes/productoRoutes');

// ✅ Importar rutas de autenticación
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MIDDLEWARES ==========
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ✅ AÑADIDO - Para formularios

// ========== RUTAS ==========
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/estados', estadoRoutes);
app.use('/api/productos', productoRoutes);

// ========== RUTAS BÁSICAS ==========

// Página principal
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🦷 API Laboratorio de Prótesis Dental',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: 'MySQL + Prisma',
    status: 'operational',
    authentication: {
      base: '/api/auth',
      endpoints: {
        login: 'POST /api/auth/login',
        resetPasswordRequest: 'POST /api/auth/reset-password-request',
        verifyResetToken: 'GET /api/auth/verify-reset-token/:token',
        resetPassword: 'POST /api/auth/reset-password',
        profile: 'GET /api/auth/perfil (requiere token)',
        changePassword: 'POST /api/auth/change-password (requiere token)',
        adminOnly: 'GET /api/auth/admin-only (requiere super admin)'
      }
    },
    endpoints: {
      home: 'GET /',
      health: 'GET /api/health',
      clientes: {
        base: '/api/clientes',
        endpoints: {
          list: 'GET /api/clientes',
          search: 'GET /api/clientes/search?query=',
          get: 'GET /api/clientes/:id',
          create: 'POST /api/clientes',
          update: 'PUT /api/clientes/:id',
          delete: 'DELETE /api/clientes/:id'
        }
      },
      pedidos: {
        base: '/api/pedidos',
        endpoints: {
          list: 'GET /api/pedidos',
          create: 'POST /api/pedidos',
          get: 'GET /api/pedidos/:id',
          update: 'PUT /api/pedidos/:id',
          delete: 'DELETE /api/pedidos/:id',
          byClient: 'GET /api/pedidos/cliente/:clientId',
          statistics: 'GET /api/pedidos/estadisticas'
        }
      },
      pagos: {
        base: '/api/pagos',
        endpoints: {
          create: 'POST /api/pagos',
          byClient: 'GET /api/pagos/cliente/:clienteId',
          byOrder: 'GET /api/pagos/pedido/:pedidoId',
          delete: 'DELETE /api/pagos/:id',
          balance: {
            general: 'GET /api/pagos/balance/general',
            client: 'GET /api/pagos/balance/cliente/:clienteId',
            summary: 'GET /api/pagos/balance/resumen'
          }
        }
      },
      estados: {
        base: '/api/estados',
        endpoints: {
          list: 'GET /api/estados',
          listActivos: 'GET /api/estados/activos',
          get: 'GET /api/estados/:id',
          create: 'POST /api/estados',
          update: 'PUT /api/estados/:id',
          delete: 'DELETE /api/estados/:id'
        }
      },
      productos: {
        base: '/api/productos',
        endpoints: {
          list: 'GET /api/productos',
          listActivos: 'GET /api/productos/activos',
          get: 'GET /api/productos/:id',
          create: 'POST /api/productos',
          update: 'PUT /api/productos/:id',
          delete: 'DELETE /api/productos/:id',
          search: 'GET /api/productos/search/:term'
        }
      }
    }
  });
});

// Salud del sistema
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    authentication: true,
    endpoints: [
      '/api/auth',
      '/api/clientes',
      '/api/pedidos', 
      '/api/pagos',
      '/api/estados',
      '/api/productos'
    ]
  });
});

// ========== MANEJO DE ERRORES ==========

// Ruta no encontrada (404)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    requestedUrl: req.originalUrl,
    availableEndpoints: {
      auth: '/api/auth',
      clientes: '/api/clientes',
      pedidos: '/api/pedidos',
      pagos: '/api/pagos',
      estados: '/api/estados',
      productos: '/api/productos',
      health: '/api/health'
    }
  });
});

// Error handler global (500)
app.use((err, req, res, next) => {
  console.error('🔥 Error:', err);
  
  // Errores específicos de Prisma
  if (err.code === 'P2002') {
    return res.status(400).json({
      success: false,
      error: 'Ya existe un registro con esos datos únicos',
      code: err.code
    });
  }
  
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: 'Registro no encontrado',
      code: err.code
    });
  }

  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

// ========== MANEJO DE SEÑALES (para cierre graceful) ==========
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

// ========== INICIAR SERVIDOR ==========
const server = app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(70));
  console.log('🚀 API LABORATORIO DE PRÓTESIS DENTAL');
  console.log('='.repeat(70));
  console.log(`✅ Servidor: http://localhost:${PORT}`);
  console.log(`📊 Database: PostgreSQL + Prisma (Neon)`);
  console.log(`🦷 Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ Versión: 1.0.0`);
  console.log('='.repeat(70));
  
  console.log('🔐 ENDPOINTS AUTENTICACIÓN:');
  console.log('   • POST   /api/auth/login                    - Iniciar sesión');
  console.log('   • POST   /api/auth/reset-password-request   - Solicitar reset');
  console.log('   • GET    /api/auth/verify-reset-token/:token - Verificar token');
  console.log('   • POST   /api/auth/reset-password           - Resetear contraseña');
  console.log('   • GET    /api/auth/perfil                   - Ver perfil (🔒)');
  console.log('   • POST   /api/auth/change-password          - Cambiar contraseña (🔒)');
  console.log('   • GET    /api/auth/admin-only               - Solo super admin (🔒)');
  
  console.log('📝 ENDPOINTS CLIENTES:');
  console.log('   • GET    /api/clientes           - Listar todos los clientes');
  console.log('   • GET    /api/clientes/:id       - Obtener cliente por ID');
  console.log('   • POST   /api/clientes           - Crear nuevo cliente');
  console.log('   • PUT    /api/clientes/:id       - Actualizar cliente');
  console.log('   • DELETE /api/clientes/:id       - Eliminar cliente');
  console.log('   • GET    /api/clientes/search    - Buscar clientes');
  
  console.log('📝 ENDPOINTS PEDIDOS:');
  console.log('   • POST   /api/pedidos            - Crear nuevo pedido');
  console.log('   • GET    /api/pedidos            - Listar todos los pedidos');
  console.log('   • GET    /api/pedidos/:id        - Obtener pedido por ID');
  console.log('   • PUT    /api/pedidos/:id        - Actualizar pedido');
  console.log('   • DELETE /api/pedidos/:id        - Eliminar pedido');
  console.log('   • GET    /api/pedidos/cliente/:id- Pedidos por cliente');
  console.log('   • GET    /api/pedidos/estadisticas - Estadísticas');
  
  console.log('💰 ENDPOINTS PAGOS:');
  console.log('   • POST   /api/pagos              - Registrar pago');
  console.log('   • GET    /api/pagos/cliente/:id  - Pagos por cliente');
  console.log('   • GET    /api/pagos/pedido/:id   - Pagos por pedido');
  console.log('   • DELETE /api/pagos/:id          - Eliminar pago');
  console.log('   • GET    /api/pagos/balance/general - Balance general');
  console.log('   • GET    /api/pagos/balance/cliente/:id - Balance por cliente');
  console.log('   • GET    /api/pagos/balance/resumen - Resumen financiero');
  
  console.log('📊 ENDPOINTS ESTADOS:');
  console.log('   • GET    /api/estados            - Listar todos los estados');
  console.log('   • GET    /api/estados/activos    - Listar estados activos');
  console.log('   • GET    /api/estados/:id        - Obtener estado por ID');
  console.log('   • POST   /api/estados            - Crear nuevo estado');
  console.log('   • PUT    /api/estados/:id        - Actualizar estado');
  console.log('   • DELETE /api/estados/:id        - Eliminar estado');
  
  console.log('📦 ENDPOINTS PRODUCTOS:');
  console.log('   • GET    /api/productos          - Listar todos los productos');
  console.log('   • GET    /api/productos/activos  - Listar productos activos');
  console.log('   • GET    /api/productos/:id      - Obtener producto por ID');
  console.log('   • POST   /api/productos          - Crear nuevo producto');
  console.log('   • PUT    /api/productos/:id      - Actualizar producto');
  console.log('   • DELETE /api/productos/:id      - Eliminar producto');
  console.log('   • GET    /api/productos/search/:term - Buscar productos');
  
  console.log('='.repeat(70));
  console.log('🔧 Utilidades:');
  console.log('   • GET    /                       - Información de la API');
  console.log('   • GET    /api/health             - Estado del servidor');
  console.log('='.repeat(70));
  console.log('');
});

module.exports = { app, server };