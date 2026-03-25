const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma'); // ✅ Importar desde archivo central

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const admin = await prisma.administrador.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        nombre: true,
        email: true,
        super_usuario: true,
        usuario: true,
        activo: true
      }
    });

    if (!admin) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // Verificar si el usuario está activo
    if (admin.activo === false) {
      return res.status(401).json({ error: 'Cuenta desactivada' });
    }

    req.admin = admin;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Error de autenticación' });
  }
};

const superAdminMiddleware = (req, res, next) => {
  if (!req.admin.super_usuario) {
    return res.status(403).json({ 
      error: 'Acceso denegado - Se requieren permisos de super administrador' 
    });
  }
  next();
};

module.exports = { authMiddleware, superAdminMiddleware };