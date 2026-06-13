// backend/src/routes/clienteRoutes.js
const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');
const { authMiddleware } = require('../middleware/auth'); // ✅ IMPORTAR MIDDLEWARE

// ============================================
// 🟢 1. RUTAS ESPECÍFICAS (SIN PARÁMETROS) - PRIMERO
// ============================================
router.get('/health', authMiddleware, clienteController.healthCheck);
router.get('/stats/tipo', authMiddleware, clienteController.getStatsByTipo);
router.get('/con-balance', authMiddleware, clienteController.getClientesConBalance);
router.get('/con-totales', authMiddleware, clienteController.getClientesConTotales);
router.get('/estadisticas', authMiddleware, clienteController.getEstadisticas);
router.get('/buscar', authMiddleware, clienteController.searchClientes);

// ============================================
// 🟢 2. NUEVAS RUTAS PARA SALDO A FAVOR
// ============================================
// Actualizar saldo del cliente (ABONAR o DESCONTAR)
router.post('/:id/saldo', authMiddleware, clienteController.actualizarSaldoCliente);
// Obtener saldo actual del cliente
router.get('/:id/saldo', authMiddleware, clienteController.getSaldoCliente);
// Obtener historial completo de movimientos de saldo
router.get('/:id/historial-saldo', authMiddleware, clienteController.getHistorialSaldo);

// ============================================
// 🟡 3. RUTA PRINCIPAL PARA OBTENER TODOS LOS CLIENTES
// ============================================
router.get('/', authMiddleware, clienteController.getAllClientes);

// ============================================
// 🔴 4. RUTA GENÉRICA POR ID - SIEMPRE AL FINAL
// ============================================
router.get('/:id', authMiddleware, clienteController.getClienteById);

// ============================================
// 📦 5. RUTAS POST, PUT, DELETE
// ============================================
router.post('/', authMiddleware, clienteController.createCliente);
router.put('/:id', authMiddleware, clienteController.updateCliente);
router.delete('/:id', authMiddleware, clienteController.deleteCliente);

module.exports = router;