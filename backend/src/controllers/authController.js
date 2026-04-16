const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const emailService = require('../utils/emailService');
const prisma = require('../config/prisma');

class AuthController {
  // ============================================
  // LOGIN
  // ============================================
  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      
      console.log('📡 Login intento - Email:', email);

      // ✅ Buscar el email EXACTAMENTE como llegó
      const admin = await prisma.administrador.findFirst({
        where: { email: email }
      });

      if (!admin) {
        console.log('❌ Email no encontrado:', email);
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      if (admin.activo === false) {
        return res.status(401).json({ error: 'Cuenta desactivada' });
      }

      const validPassword = await bcrypt.compare(password, admin.password);
      
      if (!validPassword) {
        console.log('❌ Contraseña incorrecta');
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      console.log('✅ Login exitoso para:', admin.email);

      const token = jwt.sign(
        { 
          id: admin.id, 
          email: admin.email, 
          nombre: admin.nombre,
          super_usuario: admin.super_usuario
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        token,
        admin: {
          id: admin.id,
          nombre: admin.nombre,
          email: admin.email,
          super_usuario: admin.super_usuario
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  }

  // ============================================
  // SOLICITAR CÓDIGO DE VERIFICACIÓN
  // ============================================
  async solicitarCodigo(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      console.log('📡 Solicitando código para:', email);

      // ✅ Buscar el email EXACTAMENTE como llegó
      const admin = await prisma.administrador.findFirst({
        where: { email: email }
      });

      if (!admin) {
        console.log('❌ Email no encontrado:', email);
        return res.status(404).json({ 
          success: false,
          error: 'Email no encontrado en el sistema' 
        });
      }

      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiresAt = new Date(Date.now() + 60 * 60000);

      await prisma.administrador.update({
        where: { id: admin.id },
        data: {
          resetPasswordToken: resetToken,
          resetPasswordExpiry: tokenExpiresAt
        }
      });

      console.log('📧 Código:', verificationCode);

      try {
        await emailService.sendVerificationCode(email, verificationCode);
        console.log('✅ Email enviado a:', email);
        
        res.json({ 
          success: true,
          message: 'Código enviado correctamente',
          token: resetToken
        });
        
      } catch (emailError) {
        console.error('❌ Error enviando email:', emailError);
        
        if (process.env.NODE_ENV === 'development') {
          res.json({ 
            success: true,
            code: verificationCode,
            token: resetToken
          });
        } else {
          res.json({ 
            success: true,
            message: 'Código generado, falló el envío del email' 
          });
        }
      }

    } catch (error) {
      console.error('Error solicitando código:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al procesar la solicitud' 
      });
    }
  }

  // ============================================
  // VERIFICAR CÓDIGO
  // ============================================
  async verificarCodigo(req, res) {
    try {
      const { email, code, token } = req.body;

      console.log('📡 Verificando código para:', email);

      if (!email || !code) {
        return res.status(400).json({ error: 'Email y código son requeridos' });
      }

      const admin = await prisma.administrador.findFirst({
        where: { 
          email: email,
          resetPasswordToken: token || undefined,
          resetPasswordExpiry: { gt: new Date() }
        }
      });

      if (!admin) {
        console.log('❌ Token inválido o expirado');
        return res.status(400).json({ error: 'Solicitud inválida o expirada' });
      }
      
      console.log('✅ Código válido');
      res.json({ 
        success: true, 
        token: admin.resetPasswordToken,
        message: 'Código válido' 
      });

    } catch (error) {
      console.error('Error verificando código:', error);
      res.status(500).json({ error: 'Error al verificar código' });
    }
  }

  // ============================================
  // RESETEAR CONTRASEÑA
  // ============================================
  async resetPassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, newPassword } = req.body;

      console.log('📡 Reseteando contraseña');

      const admin = await prisma.administrador.findFirst({
        where: {
          resetPasswordToken: token,
          resetPasswordExpiry: { gt: new Date() }
        }
      });

      if (!admin) {
        console.log('❌ Token inválido o expirado');
        return res.status(400).json({ error: 'Token inválido o expirado' });
      }

      console.log('✅ Token válido para:', admin.email);

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.administrador.update({
        where: { id: admin.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpiry: null
        }
      });

      console.log('✅ Contraseña actualizada');

      try {
        await emailService.sendPasswordChangedEmail(admin.email);
        console.log('✅ Email de confirmación enviado');
      } catch (emailError) {
        console.error('Error enviando confirmación:', emailError);
      }

      res.json({ message: 'Contraseña actualizada correctamente' });

    } catch (error) {
      console.error('Error reseteando contraseña:', error);
      res.status(500).json({ error: 'Error al actualizar contraseña' });
    }
  }

  // ============================================
  // CAMBIAR CONTRASEÑA (logueado)
  // ============================================
  async cambiarPassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { oldPassword, newPassword } = req.body;

      console.log('📡 Cambiando contraseña para ID:', req.admin.id);

      const admin = await prisma.administrador.findUnique({
        where: { id: req.admin.id }
      });

      const validPassword = await bcrypt.compare(oldPassword, admin.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Contraseña actual incorrecta' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.administrador.update({
        where: { id: req.admin.id },
        data: { password: hashedPassword }
      });

      console.log('✅ Contraseña cambiada');

      res.json({ message: 'Contraseña actualizada correctamente' });

    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
  }

  async perfil(req, res) {
    res.json({ admin: req.admin });
  }

  async logout(req, res) {
    try {
      await prisma.auditoria.create({
        data: {
          usuario: req.admin.usuario,
          accion: 'LOGOUT'
        }
      });
      res.json({ message: 'Sesión cerrada correctamente' });
    } catch (error) {
      console.error('Error en logout:', error);
      res.status(500).json({ error: 'Error al cerrar sesión' });
    }
  }
}

module.exports = new AuthController();