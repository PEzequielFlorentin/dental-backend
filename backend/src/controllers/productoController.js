// backend/src/controllers/productoController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const productoController = {
  async getAllProductos(req, res) {
    try {
      const productos = await prisma.producto.findMany({
        include: {
          administrador: {
            select: { id: true, nombre: true, usuario: true }
          }
        },
        orderBy: { tipo: 'asc' }
      });
      
      res.json({ success: true, data: productos });
    } catch (error) {
      console.error('Error obteniendo productos:', error);
      res.status(500).json({ success: false, error: 'Error al obtener productos' });
    }
  },

  async getProductoById(req, res) {
    try {
      const { id } = req.params;
      const producto = await prisma.producto.findUnique({
        where: { id: parseInt(id) },
        include: {
          administrador: true
        }
      });
      
      if (!producto) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado' });
      }
      
      res.json({ success: true, data: producto });
    } catch (error) {
      console.error('Error obteniendo producto:', error);
      res.status(500).json({ success: false, error: 'Error al obtener producto' });
    }
  },

  async createProducto(req, res) {
    try {
      const { tipo, valor, id_administrador } = req.body;
      
      if (!tipo || !valor) {
        return res.status(400).json({ 
          success: false, 
          message: 'Tipo y valor son requeridos' 
        });
      }
      
      const producto = await prisma.producto.create({
        data: {
          tipo,
          valor: parseFloat(valor),
          id_administrador: id_administrador ? parseInt(id_administrador) : null
        },
        include: {
          administrador: true
        }
      });
      
      res.status(201).json({ 
        success: true, 
        message: 'Producto creado exitosamente',
        data: producto 
      });
    } catch (error) {
      console.error('Error creando producto:', error);
      res.status(500).json({ success: false, error: 'Error al crear producto' });
    }
  },

  async updateProducto(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const producto = await prisma.producto.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          administrador: true
        }
      });
      
      res.json({ 
        success: true, 
        message: 'Producto actualizado exitosamente',
        data: producto 
      });
    } catch (error) {
      console.error('Error actualizando producto:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar producto' });
    }
  },

  async deleteProducto(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el producto está en uso
      const enUso = await prisma.detalle_pedidos.count({
        where: { id_producto: parseInt(id) }
      });
      
      if (enUso > 0) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar el producto porque está en uso en pedidos'
        });
      }
      
      await prisma.producto.delete({
        where: { id: parseInt(id) }
      });
      
      res.json({ 
        success: true, 
        message: 'Producto eliminado exitosamente' 
      });
    } catch (error) {
      console.error('Error eliminando producto:', error);
      res.status(500).json({ success: false, error: 'Error al eliminar producto' });
    }
  },

  async searchProductos(req, res) {
    try {
      const { term } = req.params;
      
      if (!term || term.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Término debe tener al menos 2 caracteres'
        });
      }
      
      const productos = await prisma.producto.findMany({
        where: {
          tipo: { contains: term, mode: 'insensitive' }
        },
        take: 10,
        orderBy: { tipo: 'asc' }
      });
      
      res.json({ success: true, data: productos });
    } catch (error) {
      console.error('Error buscando productos:', error);
      res.status(500).json({ success: false, error: 'Error al buscar productos' });
    }
  },

  async getProductosActivos(req, res) {
    try {
      const productos = await prisma.producto.findMany({
        where: {
          // Aquí podrías agregar un campo "activo" si lo necesitas
        },
        orderBy: { tipo: 'asc' }
      });
      
      res.json({ success: true, data: productos });
    } catch (error) {
      console.error('Error obteniendo productos activos:', error);
      res.status(500).json({ success: false, error: 'Error al obtener productos activos' });
    }
  }
};

module.exports = productoController;