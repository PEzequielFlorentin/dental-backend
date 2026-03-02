// backend/src/routes/pagoRoutes.js
const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');

// ✅ Rutas actualizadas para nuevo schema
router.post('/', pagoController.registrarPago);
router.get('/cliente/:clienteId', pagoController.getPagosByCliente);
router.get('/pedido/:pedidoId', pagoController.getPagosByPedido);
router.get('/balance/general', pagoController.getBalanceGeneral);
router.get('/balance/cliente/:clienteId', pagoController.getBalanceCliente);
router.get('/resumen/financiero', pagoController.getResumenFinanciero);
router.delete('/:id', pagoController.eliminarPago);

module.exports = router;