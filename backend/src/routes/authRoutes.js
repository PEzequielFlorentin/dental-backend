const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, superAdminMiddleware } = require('../middleware/auth');
const { loginLimiter, resetPasswordLimiter } = require('../middleware/rateLimiter');
const {
  loginValidator,
  resetPasswordRequestValidator,
  resetPasswordValidator,
  changePasswordValidator
} = require('../utils/validators');

// Rutas públicas
router.post('/login', loginLimiter, loginValidator, authController.login);
router.post('/solicitar-codigo', resetPasswordLimiter, authController.solicitarCodigo);
router.post('/verificar-codigo', authController.verificarCodigo);
router.post('/reset-password', resetPasswordValidator, authController.resetPassword);

// Rutas protegidas
router.use(authMiddleware);
router.get('/perfil', authController.perfil);
router.post('/change-password', changePasswordValidator, authController.cambiarPassword);
router.post('/logout', authController.logout);
router.get('/admin-only', superAdminMiddleware, (req, res) => {
  res.json({ message: 'Ruta solo para super admins' });
});

module.exports = router;