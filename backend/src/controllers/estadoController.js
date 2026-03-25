// backend/src/controllers/estadoController.js
const prisma = require('../config/prisma'); // ✅ Importar desde archivo central

const estadoController = {
  async getAllEstados(req, res) {
    try {
      const estados = await prisma.estado.findMany({
        orderBy: { descripcion: 'asc' }
      });
      
      res.json({ success: true, data: estados });
    } catch (error) {
      console.error('Error obteniendo estados:', error);
      res.status(500).json({ success: false, error: 'Error al obtener estados' });
    }
  },

  async getEstadoById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de estado inválido' 
        });
      }
      
      const estado = await prisma.estado.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!estado) {
        return res.status(404).json({ 
          success: false, 
          message: 'Estado no encontrado' 
        });
      }
      
      res.json({ success: true, data: estado });
    } catch (error) {
      console.error('Error obteniendo estado:', error);
      res.status(500).json({ success: false, error: 'Error al obtener estado' });
    }
  },

  async createEstado(req, res) {
    try {
      const { descripcion } = req.body;
      
      if (!descripcion || descripcion.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          message: 'La descripción es requerida' 
        });
      }
      
      // ✅ Verificar si ya existe un estado con la misma descripción (no eliminado)
      const existe = await prisma.estado.findFirst({
        where: {
          descripcion: {
            equals: descripcion.trim(),
            mode: 'insensitive'  // Case insensitive
          },
          fecha_delete: null
        }
      });
      
      if (existe) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ya existe un estado con esta descripción' 
        });
      }
      
      const estado = await prisma.estado.create({
        data: { 
          descripcion: descripcion.trim()
          // ✅ fecha_insert se setea automáticamente con @default(now())
        }
      });
      
      res.status(201).json({ 
        success: true, 
        message: 'Estado creado exitosamente',
        data: estado 
      });
    } catch (error) {
      console.error('Error creando estado:', error);
      
      if (error.code === 'P2002') {
        return res.status(400).json({ 
          success: false, 
          message: 'Ya existe un estado con esta descripción' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Error al crear estado',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async updateEstado(req, res) {
    try {
      const { id } = req.params;
      const { descripcion } = req.body;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de estado inválido' 
        });
      }
      
      if (!descripcion || descripcion.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          message: 'La descripción es requerida' 
        });
      }
      
      // ✅ Verificar que el estado existe
      const estadoExistente = await prisma.estado.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!estadoExistente) {
        return res.status(404).json({ 
          success: false, 
          message: 'Estado no encontrado' 
        });
      }
      
      // ✅ Verificar si ya existe otro estado con la misma descripción
      const duplicado = await prisma.estado.findFirst({
        where: {
          descripcion: {
            equals: descripcion.trim(),
            mode: 'insensitive'
          },
          fecha_delete: null,
          id: { not: parseInt(id) }
        }
      });
      
      if (duplicado) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ya existe otro estado con esta descripción' 
        });
      }
      
      const estado = await prisma.estado.update({
        where: { id: parseInt(id) },
        data: { 
          descripcion: descripcion.trim()
          // ✅ updatedAt no existe en este modelo, solo fecha_insert y fecha_delete
        }
      });
      
      res.json({ 
        success: true, 
        message: 'Estado actualizado exitosamente',
        data: estado 
      });
    } catch (error) {
      console.error('Error actualizando estado:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar estado',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async deleteEstado(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de estado inválido' 
        });
      }
      
      // ✅ Verificar que el estado existe
      const estado = await prisma.estado.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!estado) {
        return res.status(404).json({ 
          success: false, 
          message: 'Estado no encontrado' 
        });
      }
      
      // ✅ Verificar si el estado ya está eliminado
      if (estado.fecha_delete !== null) {
        return res.status(400).json({
          success: false,
          message: 'El estado ya está eliminado'
        });
      }
      
      // ✅ Verificar si el estado está en uso en detalle_pedidos
      const enUso = await prisma.detalle_pedidos.count({
        where: { 
          id_estado: parseInt(id),
          // Opcional: solo considerar pedidos no eliminados
          pedido: {
            fecha_delete: null
          }
        }
      });
      
      if (enUso > 0) {
        return res.status(400).json({
          success: false,
          message: `No se puede eliminar el estado porque está siendo usado en ${enUso} pedido(s)`
        });
      }
      
      // ✅ Soft delete: marcar fecha_delete con la fecha actual
      await prisma.estado.update({
        where: { id: parseInt(id) },
        data: { fecha_delete: new Date() }
      });
      
      res.json({ 
        success: true, 
        message: 'Estado eliminado exitosamente' 
      });
    } catch (error) {
      console.error('Error eliminando estado:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar estado',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  async getEstadosActivos(req, res) {
    try {
      const estados = await prisma.estado.findMany({
        where: {
          fecha_delete: null
        },
        orderBy: { descripcion: 'asc' }
      });
      
      res.json({ success: true, data: estados });
    } catch (error) {
      console.error('Error obteniendo estados activos:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener estados activos' 
      });
    }
  },
  
  // ✅ FUNCIÓN NUEVA: Obtener estados eliminados
  async getEstadosEliminados(req, res) {
    try {
      const estados = await prisma.estado.findMany({
        where: {
          fecha_delete: {
            not: null
          }
        },
        orderBy: { fecha_delete: 'desc' }
      });
      
      res.json({ success: true, data: estados });
    } catch (error) {
      console.error('Error obteniendo estados eliminados:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener estados eliminados' 
      });
    }
  },
  
  // ✅ FUNCIÓN NUEVA: Restaurar estado eliminado
  async restoreEstado(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de estado inválido' 
        });
      }
      
      const estado = await prisma.estado.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!estado) {
        return res.status(404).json({ 
          success: false, 
          message: 'Estado no encontrado' 
        });
      }
      
      if (estado.fecha_delete === null) {
        return res.status(400).json({
          success: false,
          message: 'El estado no está eliminado'
        });
      }
      
      const estadoRestaurado = await prisma.estado.update({
        where: { id: parseInt(id) },
        data: { fecha_delete: null }
      });
      
      res.json({ 
        success: true, 
        message: 'Estado restaurado exitosamente',
        data: estadoRestaurado
      });
    } catch (error) {
      console.error('Error restaurando estado:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al restaurar estado',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

module.exports = estadoController;