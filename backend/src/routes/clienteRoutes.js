// backend/src/routes/clienteRoutes.js
const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');
const { authMiddleware } = require('../middleware/auth'); // ✅ IMPORTAR MIDDLEWARE

// ============================================
// 🟢 1. RUTAS ESPECÍFICAS (SIN PARÁMETROS) - PRIMERO
// ============================================
router.get('/health', authMiddleware, clienteController.healthCheck); // ✅ AGREGADO authMiddleware
router.get('/stats/tipo', authMiddleware, clienteController.getStatsByTipo); // ✅
router.get('/con-balance', authMiddleware, clienteController.getClientesConBalance); // ✅
router.get('/con-totales', authMiddleware, clienteController.getClientesConTotales); // ✅
router.get('/estadisticas', authMiddleware, clienteController.getEstadisticas); // ✅
router.get('/buscar', authMiddleware, clienteController.searchClientes); // ✅

// ============================================
// 🟡 2. RUTA PRINCIPAL PARA OBTENER TODOS LOS CLIENTES
// ============================================
router.get('/', authMiddleware, clienteController.getAllClientes); // ✅

// ============================================
// 🔴 3. RUTA GENÉRICA POR ID - SIEMPRE AL FINAL
// ============================================
router.get('/:id', authMiddleware, clienteController.getClienteById); // ✅

// ============================================
// 📦 4. RUTAS POST, PUT, DELETE
// ============================================
router.post('/', authMiddleware, clienteController.createCliente); // ✅
router.put('/:id', authMiddleware, clienteController.updateCliente); // ✅
router.delete('/:id', authMiddleware, clienteController.deleteCliente); // ✅

module.exports = router;