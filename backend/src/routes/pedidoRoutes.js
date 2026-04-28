const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const { authMiddleware } = require('../middleware/auth'); // ✅ IMPORTAR MIDDLEWARE

// ============================================
// 🟢 RUTAS ESPECÍFICAS (SIN PARÁMETROS) - PRIMERO
// ============================================
router.get('/', authMiddleware, pedidoController.getAllPedidos);
router.get('/estadisticas', authMiddleware, pedidoController.getEstadisticas);
router.get('/fecha', authMiddleware, pedidoController.getPedidosPorFecha);
router.get('/agenda', authMiddleware, pedidoController.getAgenda);
router.get('/buscar', authMiddleware, pedidoController.searchPedidos);

// ============================================
// 🟡 RUTAS CON PARÁMETROS ESPECÍFICOS
// ============================================
router.get('/cliente/:clienteId', authMiddleware, pedidoController.getPedidosByCliente);

// ============================================
// 🔴 RUTA GENÉRICA POR ID - SIEMPRE AL FINAL
// ============================================
router.get('/:id', authMiddleware, pedidoController.getPedidoById);

// ============================================
// 📦 RUTAS POST (CREAR)
// ============================================
router.post('/', authMiddleware, pedidoController.createPedido);
router.post('/:id/detalles', authMiddleware, pedidoController.agregarDetallePedido);
router.post('/:id/pagos', authMiddleware, pedidoController.agregarPago);

// ============================================
// ✏️ RUTAS PUT (ACTUALIZAR)
// ============================================
router.put('/:pedidoId/detalles/:detalleId/estado', authMiddleware, pedidoController.updateEstadoDetalle);
router.put('/:id/estado', authMiddleware, pedidoController.updateEstadoPedido);

// ============================================
// 🗑️ RUTAS DELETE (ELIMINAR)
// ============================================
router.delete('/:id', authMiddleware, pedidoController.deletePedido);

module.exports = router;