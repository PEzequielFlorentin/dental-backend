// backend/src/routes/productoRoutes.js
const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const { authMiddleware } = require('../middleware/auth'); // ✅ IMPORTAR MIDDLEWARE

// ✅ TODAS las rutas necesitan autenticación (excepto si son globales)
router.get('/', authMiddleware, productoController.getAllProductos);
router.get('/search/:term', authMiddleware, productoController.searchProductos);
router.get('/activos', authMiddleware, productoController.getProductosActivos);
router.get('/:id', authMiddleware, productoController.getProductoById);
router.post('/', authMiddleware, productoController.createProducto);
router.put('/:id', authMiddleware, productoController.updateProducto);
router.delete('/:id', authMiddleware, productoController.deleteProducto);

module.exports = router;