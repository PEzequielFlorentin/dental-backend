// backend/src/routes/otroGastoRoutes.js
const express = require('express');
const router = express.Router();
const otroGastoController = require('../controllers/otroGastoController');
const { authMiddleware } = require('../middleware/auth'); // ✅ IMPORTAR MIDDLEWARE

// ✅ TODAS las rutas necesitan autenticación
router.get('/', authMiddleware, otroGastoController.getAllOtrosGastos);
router.get('/estadisticas', authMiddleware, otroGastoController.getEstadisticasOtrosGastos);
router.post('/', authMiddleware, otroGastoController.createOtroGasto);
router.put('/:id', authMiddleware, otroGastoController.updateOtroGasto);
router.delete('/:id', authMiddleware, otroGastoController.deleteOtroGasto);

module.exports = router;