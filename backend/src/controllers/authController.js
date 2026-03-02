const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const emailService = require('../utils/emailService');

const prisma = new PrismaClient();

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
      const ipAddress = req.ip || req.connection.remoteAddress;

      console.log('📡 Login attempt:', email);

      const admin = await prisma.administrador.findFirst({
        where: { email }
      });

      if (!admin) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Verificar bloqueo
      if (admin.locked_until && admin.locked_until > new Date()) {
        const waitTime = Math.ceil((admin.locked_until - new Date()) / 60000);
        return res.status(401).json({ 
          error: `Cuenta bloqueada. Intenta en ${waitTime} minutos` 
        });
      }

      // Verificar contraseña
      const validPassword = await bcrypt.compare(password, admin.password);
      if (!validPassword) {
        // Incrementar intentos fallidos
        const newAttempts = (admin.login_attempts || 0) + 1;
        let lockedUntil = null;

        if (newAttempts >= 5) {
          lockedUntil = new Date(Date.now() + 30 * 60000); // 30 minutos
        }

        await prisma.administrador.update({
          where: { id: admin.id },
          data: {
            login_attempts: newAttempts,
            locked_until: lockedUntil
          }
        });

        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Login exitoso - resetear intentos
      await prisma.administrador.update({
        where: { id: admin.id },
        data: {
          last_login: new Date(),
          login_attempts: 0,
          locked_until: null
        }
      });

      // Generar token JWT
      const token = jwt.sign(
        { 
          id: admin.id, 
          email: admin.email, 
          rol: admin.rol,
          nombre: admin.nombre 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Registrar auditoría
      await prisma.auditoria.create({
        data: {
          id_administrador: admin.id,
          usuario: admin.usuario,
          accion: 'LOGIN',
          ip_address: ipAddress,
          detalles: 'Inicio de sesión exitoso'
        }
      });

      console.log('✅ Login exitoso para:', admin.email);

      res.json({
        token,
        admin: {
          id: admin.id,
          nombre: admin.nombre,
          email: admin.email,
          rol: admin.rol
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
      const ipAddress = req.ip || req.connection.remoteAddress;

      console.log('📡 Solicitando código para:', email);

      const admin = await prisma.administrador.findFirst({
        where: { email }
      });

      // ✅ VERIFICAR SI EL EMAIL EXISTE
      if (!admin) {
        console.log('❌ Email no encontrado en BD:', email);
        return res.status(404).json({ 
          success: false,
          error: 'Email no encontrado en el sistema' 
        });
      }

      // Eliminar códigos anteriores no usados
      await prisma.reset_token.deleteMany({
        where: {
          id_administrador: admin.id,
          used_at: null,
          expires_at: { lt: new Date() }
        }
      });

      // Generar código de 6 dígitos
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const codeExpiresAt = new Date(Date.now() + 10 * 60000); // 10 minutos

      // Generar token único (para el segundo paso)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiresAt = new Date(Date.now() + 60 * 60000); // 1 hora

      // Guardar código y token
      await prisma.reset_token.create({
        data: {
          id_administrador: admin.id,
          token: resetToken,
          verification_code: verificationCode,
          code_expires_at: codeExpiresAt,
          expires_at: tokenExpiresAt,
          ip_address: ipAddress
        }
      });

      console.log('✅ Código generado para:', email, 'Código:', verificationCode);

      // Enviar código por email
      try {
        await emailService.sendVerificationCode(email, verificationCode);
        console.log('✅ Email enviado a:', email);
        
        res.json({ 
          success: true,
          message: 'Código enviado correctamente a tu email' 
        });
        
      } catch (emailError) {
        console.error('❌ Error enviando email:', emailError);
        
        // Si falla el email, igual devolvemos éxito pero registramos el error
        res.json({ 
          success: true,
          message: 'Código generado (falló el envío de email, contacta al administrador)' 
        });
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
      const { email, code } = req.body;

      console.log('📡 Verificando código para:', email, 'Código:', code);

      if (!email || !code) {
        return res.status(400).json({ error: 'Email y código son requeridos' });
      }

      const admin = await prisma.administrador.findFirst({
        where: { email }
      });

      if (!admin) {
        console.log('❌ Email no encontrado:', email);
        return res.status(400).json({ error: 'Código inválido' });
      }

      // Buscar token válido con el código
      const resetToken = await prisma.reset_token.findFirst({
        where: {
          id_administrador: admin.id,
          verification_code: code,
          code_expires_at: { gt: new Date() },
          used_at: null
        }
      });

      if (!resetToken) {
        console.log('❌ Código inválido o expirado para:', email);
        return res.status(400).json({ error: 'Código inválido o expirado' });
      }

      console.log('✅ Código válido para:', email);

      // Código válido - devolver token para el siguiente paso
      res.json({ 
        success: true, 
        token: resetToken.token,
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
      const ipAddress = req.ip || req.connection.remoteAddress;

      console.log('📡 Reseteando contraseña con token');

      const resetToken = await prisma.reset_token.findFirst({
        where: {
          token,
          expires_at: { gt: new Date() },
          used_at: null
        },
        include: {
          administrador: true
        }
      });

      if (!resetToken) {
        console.log('❌ Token inválido o expirado');
        return res.status(400).json({ error: 'Token inválido o expirado' });
      }

      console.log('✅ Token válido para:', resetToken.administrador.email);

      // Hashear nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Actualizar contraseña
      await prisma.administrador.update({
        where: { id: resetToken.id_administrador },
        data: {
          password: hashedPassword,
          reset_password_token: null,
          reset_password_expires: null,
          login_attempts: 0,
          locked_until: null
        }
      });

      // Marcar token como usado
      await prisma.reset_token.update({
        where: { id: resetToken.id },
        data: { 
          used_at: new Date(),
          verification_code: null,
          code_expires_at: null
        }
      });

      console.log('✅ Contraseña actualizada para:', resetToken.administrador.email);

      // Enviar email de confirmación (opcional, no bloquear si falla)
      try {
        await emailService.sendPasswordChangedEmail(resetToken.administrador.email);
        console.log('✅ Email de confirmación enviado');
      } catch (emailError) {
        console.error('❌ Error enviando email de confirmación:', emailError);
      }

      // Registrar auditoría
      await prisma.auditoria.create({
        data: {
          id_administrador: resetToken.id_administrador,
          usuario: resetToken.administrador.usuario,
          accion: 'PASSWORD_RESET',
          ip_address: ipAddress,
          detalles: 'Contraseña restablecida con código de verificación'
        }
      });

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
      const ipAddress = req.ip || req.connection.remoteAddress;

      console.log('📡 Cambiando contraseña para usuario ID:', req.admin.id);

      const admin = await prisma.administrador.findUnique({
        where: { id: req.admin.id }
      });

      const validPassword = await bcrypt.compare(oldPassword, admin.password);
      if (!validPassword) {
        console.log('❌ Contraseña actual incorrecta');
        return res.status(400).json({ error: 'Contraseña actual incorrecta' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.administrador.update({
        where: { id: req.admin.id },
        data: { password: hashedPassword }
      });

      console.log('✅ Contraseña cambiada exitosamente');

      await prisma.auditoria.create({
        data: {
          id_administrador: req.admin.id,
          usuario: admin.usuario,
          accion: 'PASSWORD_CHANGE',
          ip_address: ipAddress,
          detalles: 'Contraseña cambiada voluntariamente'
        }
      });

      res.json({ message: 'Contraseña actualizada correctamente' });

    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
  }

  // ============================================
  // PERFIL
  // ============================================
  async perfil(req, res) {
    res.json({ admin: req.admin });
  }

  // ============================================
  // LOGOUT (cliente-side, solo para auditoría)
  // ============================================
  async logout(req, res) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;

      await prisma.auditoria.create({
        data: {
          id_administrador: req.admin.id,
          usuario: req.admin.usuario,
          accion: 'LOGOUT',
          ip_address: ipAddress,
          detalles: 'Cierre de sesión'
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