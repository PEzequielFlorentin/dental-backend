// backend/src/controllers/estadoController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
      const estado = await prisma.estado.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!estado) {
        return res.status(404).json({ success: false, message: 'Estado no encontrado' });
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
      
      if (!descripcion) {
        return res.status(400).json({ 
          success: false, 
          message: 'Descripción es requerida' 
        });
      }
      
      const estado = await prisma.estado.create({
        data: { descripcion }
      });
      
      res.status(201).json({ 
        success: true, 
        message: 'Estado creado exitosamente',
        data: estado 
      });
    } catch (error) {
      console.error('Error creando estado:', error);
      res.status(500).json({ success: false, error: 'Error al crear estado' });
    }
  },

  async updateEstado(req, res) {
    try {
      const { id } = req.params;
      const { descripcion } = req.body;
      
      const estado = await prisma.estado.update({
        where: { id: parseInt(id) },
        data: { descripcion }
      });
      
      res.json({ 
        success: true, 
        message: 'Estado actualizado exitosamente',
        data: estado 
      });
    } catch (error) {
      console.error('Error actualizando estado:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar estado' });
    }
  },

  async deleteEstado(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el estado está en uso
      const enUso = await prisma.detalle_pedidos.count({
        where: { id_estado: parseInt(id) }
      });
      
      if (enUso > 0) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar el estado porque está en uso en pedidos'
        });
      }
      
      // Soft delete: marcar fecha_delete
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
      res.status(500).json({ success: false, error: 'Error al eliminar estado' });
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
      res.status(500).json({ success: false, error: 'Error al obtener estados activos' });
    }
  }
};

module.exports = estadoController;