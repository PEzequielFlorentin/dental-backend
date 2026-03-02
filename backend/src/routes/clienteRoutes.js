// backend/src/routes/clienteRoutes.js
const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');

// ============================================
// 🟢 1. RUTAS ESPECÍFICAS (SIN PARÁMETROS) - PRIMERO
// ============================================
router.get('/health', clienteController.healthCheck);
router.get('/stats/tipo', clienteController.getStatsByTipo);
router.get('/con-balance', clienteController.getClientesConBalance);
router.get('/con-totales', clienteController.getClientesConTotales); // ✅ NUEVA RUTA
router.get('/estadisticas', clienteController.getEstadisticas);
router.get('/buscar', clienteController.searchClientes); // ✅ QUERY STRING

// ============================================
// 🟡 2. RUTAS CON PARÁMETROS ESPECÍFICOS
// ============================================


// ============================================
// 🔴 3. RUTA GENÉRICA POR ID - SIEMPRE AL FINAL
// ============================================
router.get('/:id', clienteController.getClienteById);

// ============================================
// 📦 4. RUTAS POST, PUT, DELETE
// ============================================
router.post('/', clienteController.createCliente);
router.put('/:id', clienteController.updateCliente);
router.delete('/:id', clienteController.deleteCliente);

module.exports = router;