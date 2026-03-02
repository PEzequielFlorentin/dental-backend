const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');

// ============================================
// 🟢 RUTAS ESPECÍFICAS (SIN PARÁMETROS) - PRIMERO
// ============================================
router.get('/', pedidoController.getAllPedidos);
router.get('/estadisticas', pedidoController.getEstadisticas);
router.get('/fecha', pedidoController.getPedidosPorFecha);
router.get('/agenda', pedidoController.getAgenda);
router.get('/buscar', pedidoController.searchPedidos);

// ============================================
// 🟡 RUTAS CON PARÁMETROS ESPECÍFICOS
// ============================================
router.get('/cliente/:clienteId', pedidoController.getPedidosByCliente);

// ============================================
// 🔴 RUTA GENÉRICA POR ID - SIEMPRE AL FINAL
// ============================================
router.get('/:id', pedidoController.getPedidoById);

// ============================================
// 📦 RUTAS POST (CREAR)
// ============================================
router.post('/', pedidoController.createPedido);
router.post('/:id/detalles', pedidoController.agregarDetallePedido);
router.post('/:id/pagos', pedidoController.agregarPago);

// ============================================
// ✏️ RUTAS PUT (ACTUALIZAR)
// ============================================
router.put('/:pedidoId/detalles/:detalleId/estado', pedidoController.updateEstadoDetalle);
router.put('/:id/estado', pedidoController.updateEstadoPedido);
// ============================================
// 🗑️ RUTAS DELETE (ELIMINAR)
// ============================================
router.delete('/:id', pedidoController.deletePedido);

module.exports = router;