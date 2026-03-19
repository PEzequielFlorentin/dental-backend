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
router.get('/con-totales', clienteController.getClientesConTotales);
router.get('/estadisticas', clienteController.getEstadisticas);
router.get('/buscar', clienteController.searchClientes);

// ============================================
// 🟡 2. RUTA PRINCIPAL PARA OBTENER TODOS LOS CLIENTES
// ============================================
router.get('/', clienteController.getAllClientes); // ✅ AGREGAR ESTA RUTA

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