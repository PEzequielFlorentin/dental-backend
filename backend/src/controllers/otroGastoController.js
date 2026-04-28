// backend/src/controllers/otroGastoController.js
const prisma = require('../config/prisma');

// DEBUG: Ver qué modelos están disponibles
console.log('🔍 MODELOS DISPONIBLES EN PRISMA:');
const modelos = Object.keys(prisma).filter(key => !key.startsWith('_') && !key.startsWith('$'));
console.log(modelos);

// Verificar si el modelo existe con diferentes nombres
console.log('🔍 ¿Existe "otroGasto"?', !!prisma.otroGasto);
console.log('🔍 ¿Existe "otro_gasto"?', !!prisma.otro_gasto);
console.log('🔍 ¿Existe "otroGasto"?', !!prisma['otroGasto']);
console.log('🔍 ¿Existe "otro_gasto"?', !!prisma['otro_gasto']);

const otroGastoController = {
  async getAllOtrosGastos(req, res) {
    try {
      console.log('📡 getAllOtrosGastos llamado para admin:', req.admin.id);
      
      // Intentar con diferentes nombres
      let gastos = [];
      
      if (prisma.otroGasto) {
        console.log('✅ Usando prisma.otroGasto');
        gastos = await prisma.otroGasto.findMany({
          where: { 
            id_administrador: req.admin.id  // ✅ FILTRO: solo gastos de este admin
          }
        });
      } else if (prisma.otro_gasto) {
        console.log('✅ Usando prisma.otro_gasto');
        gastos = await prisma.otro_gasto.findMany({
          where: { 
            id_administrador: req.admin.id  // ✅ FILTRO: solo gastos de este admin
          }
        });
      } else {
        console.error('❌ Modelo no encontrado');
        return res.status(500).json({
          success: false,
          error: 'Modelo otro_gasto no encontrado en Prisma',
          modelosDisponibles: modelos
        });
      }
      
      res.json({
        success: true,
        data: gastos,
      });
    } catch (error) {
      console.error('❌ Error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getEstadisticasOtrosGastos(req, res) {
    try {
      let totalGastos, cantidadGastos, gastosPorTipo, ultimosGastos;
      
      if (prisma.otroGasto) {
        totalGastos = await prisma.otroGasto.aggregate({ 
          where: { id_administrador: req.admin.id },  // ✅ FILTRO
          _sum: { monto: true } 
        });
        cantidadGastos = await prisma.otroGasto.count({
          where: { id_administrador: req.admin.id }  // ✅ FILTRO
        });
        gastosPorTipo = await prisma.otroGasto.groupBy({ 
          by: ['tipo'], 
          where: { id_administrador: req.admin.id },  // ✅ FILTRO
          _sum: { monto: true }, 
          _count: { id: true } 
        });
        ultimosGastos = await prisma.otroGasto.findMany({ 
          where: { id_administrador: req.admin.id },  // ✅ FILTRO
          take: 5, 
          orderBy: { fecha: 'desc' }, 
          include: { administrador: { select: { nombre: true } } } 
        });
      } else if (prisma.otro_gasto) {
        totalGastos = await prisma.otro_gasto.aggregate({ 
          where: { id_administrador: req.admin.id },  // ✅ FILTRO
          _sum: { monto: true } 
        });
        cantidadGastos = await prisma.otro_gasto.count({
          where: { id_administrador: req.admin.id }  // ✅ FILTRO
        });
        gastosPorTipo = await prisma.otro_gasto.groupBy({ 
          by: ['tipo'], 
          where: { id_administrador: req.admin.id },  // ✅ FILTRO
          _sum: { monto: true }, 
          _count: { id: true } 
        });
        ultimosGastos = await prisma.otro_gasto.findMany({ 
          where: { id_administrador: req.admin.id },  // ✅ FILTRO
          take: 5, 
          orderBy: { fecha: 'desc' }, 
          include: { administrador: { select: { nombre: true } } } 
        });
      } else {
        return res.status(500).json({ success: false, error: 'Modelo no encontrado' });
      }
      
      res.json({
        success: true,
        data: {
          total: totalGastos._sum.monto || 0,
          cantidad: cantidadGastos,
          porTipo: gastosPorTipo,
          ultimos: ultimosGastos,
        },
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async createOtroGasto(req, res) {
    try {
      const { tipo, descripcion, monto, fecha } = req.body;
      
      if (!tipo || !descripcion || !monto) {
        return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
      }
      
      let gasto;
      
      if (prisma.otroGasto) {
        gasto = await prisma.otroGasto.create({
          data: { 
            tipo, 
            descripcion, 
            monto: parseFloat(monto), 
            fecha: fecha ? new Date(fecha) : new Date(), 
            id_administrador: req.admin.id  // ✅ ASIGNA EL ADMIN LOGUEADO
          },
          include: { administrador: { select: { nombre: true, usuario: true } } }
        });
      } else if (prisma.otro_gasto) {
        gasto = await prisma.otro_gasto.create({
          data: { 
            tipo, 
            descripcion, 
            monto: parseFloat(monto), 
            fecha: fecha ? new Date(fecha) : new Date(), 
            id_administrador: req.admin.id  // ✅ ASIGNA EL ADMIN LOGUEADO
          },
          include: { administrador: { select: { nombre: true, usuario: true } } }
        });
      } else {
        return res.status(500).json({ success: false, error: 'Modelo no encontrado' });
      }
      
      res.status(201).json({ success: true, message: 'Gasto registrado exitosamente', data: gasto });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async updateOtroGasto(req, res) {
    try {
      const { id } = req.params;
      const { tipo, descripcion, monto, fecha } = req.body;
      
      // ✅ Primero verificar que el gasto pertenece a este admin
      let gastoExistente;
      
      if (prisma.otroGasto) {
        gastoExistente = await prisma.otroGasto.findFirst({
          where: { 
            id: parseInt(id),
            id_administrador: req.admin.id
          }
        });
      } else if (prisma.otro_gasto) {
        gastoExistente = await prisma.otro_gasto.findFirst({
          where: { 
            id: parseInt(id),
            id_administrador: req.admin.id
          }
        });
      }
      
      if (!gastoExistente) {
        return res.status(404).json({ 
          success: false, 
          message: 'Gasto no encontrado o no tienes permisos para modificarlo' 
        });
      }
      
      let gasto;
      
      if (prisma.otroGasto) {
        gasto = await prisma.otroGasto.update({
          where: { id: parseInt(id) },
          data: { 
            tipo: tipo || undefined, 
            descripcion: descripcion || undefined, 
            monto: monto ? parseFloat(monto) : undefined, 
            fecha: fecha ? new Date(fecha) : undefined 
          },
          include: { administrador: { select: { nombre: true, usuario: true } } }
        });
      } else if (prisma.otro_gasto) {
        gasto = await prisma.otro_gasto.update({
          where: { id: parseInt(id) },
          data: { 
            tipo: tipo || undefined, 
            descripcion: descripcion || undefined, 
            monto: monto ? parseFloat(monto) : undefined, 
            fecha: fecha ? new Date(fecha) : undefined 
          },
          include: { administrador: { select: { nombre: true, usuario: true } } }
        });
      } else {
        return res.status(500).json({ success: false, error: 'Modelo no encontrado' });
      }
      
      res.json({ success: true, message: 'Gasto actualizado', data: gasto });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async deleteOtroGasto(req, res) {
    try {
      const { id } = req.params;
      
      // ✅ Primero verificar que el gasto pertenece a este admin
      let gastoExistente;
      
      if (prisma.otroGasto) {
        gastoExistente = await prisma.otroGasto.findFirst({
          where: { 
            id: parseInt(id),
            id_administrador: req.admin.id
          }
        });
      } else if (prisma.otro_gasto) {
        gastoExistente = await prisma.otro_gasto.findFirst({
          where: { 
            id: parseInt(id),
            id_administrador: req.admin.id
          }
        });
      }
      
      if (!gastoExistente) {
        return res.status(404).json({ 
          success: false, 
          message: 'Gasto no encontrado o no tienes permisos para eliminarlo' 
        });
      }
      
      if (prisma.otroGasto) {
        await prisma.otroGasto.delete({ where: { id: parseInt(id) } });
      } else if (prisma.otro_gasto) {
        await prisma.otro_gasto.delete({ where: { id: parseInt(id) } });
      } else {
        return res.status(500).json({ success: false, error: 'Modelo no encontrado' });
      }
      
      res.json({ success: true, message: 'Gasto eliminado' });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

module.exports = otroGastoController;