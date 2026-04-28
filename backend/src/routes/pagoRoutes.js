// backend/src/routes/pagoRoutes.js
const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
const { authMiddleware } = require('../middleware/auth'); // ✅ IMPORTAR MIDDLEWARE

// ✅ TODAS las rutas necesitan autenticación
router.post('/', authMiddleware, pagoController.registrarPago);
router.get('/cliente/:clienteId', authMiddleware, pagoController.getPagosByCliente);
router.get('/pedido/:pedidoId', authMiddleware, pagoController.getPagosByPedido);
router.get('/balance/general', authMiddleware, pagoController.getBalanceGeneral);
router.get('/balance/cliente/:clienteId', authMiddleware, pagoController.getBalanceCliente);
router.get('/resumen/financiero', authMiddleware, pagoController.getResumenFinanciero);
router.delete('/:id', authMiddleware, pagoController.eliminarPago);

module.exports = router;