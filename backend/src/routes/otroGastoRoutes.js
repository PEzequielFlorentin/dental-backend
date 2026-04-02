// backend/src/routes/otroGastoRoutes.js
const express = require('express');
const router = express.Router();
const otroGastoController = require('../controllers/otroGastoController');

// Rutas principales (igual que estadoRoutes)
router.get('/', otroGastoController.getAllOtrosGastos);
router.get('/estadisticas', otroGastoController.getEstadisticasOtrosGastos);
router.post('/', otroGastoController.createOtroGasto);
router.put('/:id', otroGastoController.updateOtroGasto);
router.delete('/:id', otroGastoController.deleteOtroGasto);

module.exports = router;