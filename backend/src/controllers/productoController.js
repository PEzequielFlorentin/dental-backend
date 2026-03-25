// backend/src/controllers/productoController.js
const prisma = require('../config/prisma'); // ✅ Importar desde archivo central

const productoController = {
  // ========== OBTENER TODOS LOS PRODUCTOS ==========
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

  // ========== OBTENER PRODUCTO POR ID ==========
  async getProductoById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de producto inválido' 
        });
      }
      
      const producto = await prisma.producto.findUnique({
        where: { id: parseInt(id) },
        include: {
          administrador: {
            select: { id: true, nombre: true, usuario: true }
          }
        }
      });
      
      if (!producto) {
        return res.status(404).json({ 
          success: false, 
          message: 'Producto no encontrado' 
        });
      }
      
      res.json({ success: true, data: producto });
    } catch (error) {
      console.error('Error obteniendo producto:', error);
      res.status(500).json({ success: false, error: 'Error al obtener producto' });
    }
  },

  // ========== CREAR PRODUCTO ==========
  async createProducto(req, res) {
    try {
      const { tipo, id_administrador } = req.body;
      
      // ✅ Validaciones - valor ya no existe
      if (!tipo || tipo.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          message: 'El tipo de producto es requerido' 
        });
      }
      
      // ✅ Validar que el administrador existe (ahora NOT NULL)
      const adminId = id_administrador ? parseInt(id_administrador) : 1;
      
      const adminExiste = await prisma.administrador.findUnique({
        where: { id: adminId }
      });
      
      if (!adminExiste) {
        return res.status(400).json({
          success: false,
          message: 'Administrador no encontrado'
        });
      }
      
      // ✅ Verificar si ya existe un producto con el mismo tipo
      const productoExistente = await prisma.producto.findFirst({
        where: {
          tipo: {
            equals: tipo.trim(),
            mode: 'insensitive'
          }
        }
      });
      
      if (productoExistente) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un producto con este tipo'
        });
      }
      
      const producto = await prisma.producto.create({
        data: {
          tipo: tipo.trim(),
          id_administrador: adminId  // ✅ NOT NULL
        },
        include: {
          administrador: {
            select: { id: true, nombre: true, usuario: true }
          }
        }
      });
      
      res.status(201).json({ 
        success: true, 
        message: 'Producto creado exitosamente',
        data: producto 
      });
    } catch (error) {
      console.error('Error creando producto:', error);
      
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un producto con este tipo'
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Error al crear producto',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // ========== ACTUALIZAR PRODUCTO ==========
  async updateProducto(req, res) {
    try {
      const { id } = req.params;
      const { tipo, id_administrador } = req.body;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de producto inválido' 
        });
      }
      
      // ✅ Verificar que el producto existe
      const productoExistente = await prisma.producto.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!productoExistente) {
        return res.status(404).json({ 
          success: false, 
          message: 'Producto no encontrado' 
        });
      }
      
      // ✅ Construir data para actualizar
      const updateData = {};
      
      if (tipo !== undefined) {
        if (!tipo.trim()) {
          return res.status(400).json({
            success: false,
            message: 'El tipo de producto no puede estar vacío'
          });
        }
        
        // Verificar duplicado (excepto el mismo producto)
        const duplicado = await prisma.producto.findFirst({
          where: {
            tipo: {
              equals: tipo.trim(),
              mode: 'insensitive'
            },
            id: { not: parseInt(id) }
          }
        });
        
        if (duplicado) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe otro producto con este tipo'
          });
        }
        
        updateData.tipo = tipo.trim();
      }
      
      if (id_administrador !== undefined) {
        const adminId = parseInt(id_administrador);
        const adminExiste = await prisma.administrador.findUnique({
          where: { id: adminId }
        });
        
        if (!adminExiste) {
          return res.status(400).json({
            success: false,
            message: 'Administrador no encontrado'
          });
        }
        
        updateData.id_administrador = adminId;
      }
      
      const producto = await prisma.producto.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          administrador: {
            select: { id: true, nombre: true, usuario: true }
          }
        }
      });
      
      res.json({ 
        success: true, 
        message: 'Producto actualizado exitosamente',
        data: producto 
      });
    } catch (error) {
      console.error('Error actualizando producto:', error);
      
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar producto',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // ========== ELIMINAR PRODUCTO ==========
  async deleteProducto(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de producto inválido' 
        });
      }
      
      // ✅ Verificar si el producto existe
      const producto = await prisma.producto.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!producto) {
        return res.status(404).json({ 
          success: false, 
          message: 'Producto no encontrado' 
        });
      }
      
      // ✅ Verificar si el producto está en uso en detalle_pedidos
      const enUso = await prisma.detalle_pedidos.count({
        where: { id_producto: parseInt(id) }
      });
      
      if (enUso > 0) {
        return res.status(400).json({
          success: false,
          message: `No se puede eliminar el producto porque está siendo usado en ${enUso} detalle(s) de pedidos`
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
      res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar producto',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // ========== BUSCAR PRODUCTOS ==========
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
          tipo: { 
            contains: term.trim(), 
            mode: 'insensitive' 
          }
        },
        take: 10,
        include: {
          administrador: {
            select: { id: true, nombre: true, usuario: true }
          }
        },
        orderBy: { tipo: 'asc' }
      });
      
      res.json({ success: true, data: productos });
    } catch (error) {
      console.error('Error buscando productos:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al buscar productos' 
      });
    }
  },

  // ========== OBTENER PRODUCTOS ACTIVOS ==========
  async getProductosActivos(req, res) {
    try {
      // En el nuevo schema no hay campo "activo", todos los productos son activos
      // a menos que se implemente soft delete
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
      console.error('Error obteniendo productos activos:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener productos activos' 
      });
    }
  },

  // ========== FUNCIÓN NUEVA: OBTENER PRODUCTOS POR ADMINISTRADOR ==========
  async getProductosByAdmin(req, res) {
    try {
      const { adminId } = req.params;
      
      if (!adminId || isNaN(parseInt(adminId))) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de administrador inválido' 
        });
      }
      
      const productos = await prisma.producto.findMany({
        where: {
          id_administrador: parseInt(adminId)
        },
        include: {
          administrador: {
            select: { id: true, nombre: true, usuario: true }
          }
        },
        orderBy: { tipo: 'asc' }
      });
      
      res.json({ success: true, data: productos });
    } catch (error) {
      console.error('Error obteniendo productos por admin:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener productos por administrador' 
      });
    }
  }
};

module.exports = productoController;