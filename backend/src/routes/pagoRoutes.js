// backend/src/routes/pagoRoutes.js
const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
const { authMiddleware } = require('../middleware/auth'); // ✅ IMPORTAR MIDDLEWARE

// ============================================
// 🟢 1. RUTAS ESPECÍFICAS (SIN PARÁMETROS DINÁMICOS) - PRIMERO
// ============================================
router.get('/balance/general', authMiddleware, pagoController.getBalanceGeneral);
router.get('/resumen/financiero', authMiddleware, pagoController.getResumenFinanciero);

// ============================================
// 🟢 2. NUEVAS RUTAS PARA PAGOS CON SALDO A FAVOR
// ============================================
// Registrar pago usando saldo a favor del cliente
router.post('/pagar-con-saldo', authMiddleware, pagoController.registrarPagoConSaldo);
// Obtener saldo disponible para pagar un pedido específico
router.get('/saldo-disponible/:pedidoId', authMiddleware, pagoController.getSaldoDisponibleParaPago);

// ============================================
// 🟡 3. RUTAS CON PARÁMETROS (CLIENTE, PEDIDO)
// ============================================
router.get('/cliente/:clienteId', authMiddleware, pagoController.getPagosByCliente);
router.get('/pedido/:pedidoId', authMiddleware, pagoController.getPagosByPedido);
router.get('/balance/cliente/:clienteId', authMiddleware, pagoController.getBalanceCliente);

// ============================================
// 🔴 4. RUTA POST Y DELETE - SIEMPRE AL FINAL
// ============================================
router.post('/', authMiddleware, pagoController.registrarPago);
router.delete('/:id', authMiddleware, pagoController.eliminarPago);

module.exports = router;