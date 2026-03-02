const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Función auxiliar para convertir Decimal a Number
const decimalToNumber = (decimalValue) => {
  if (!decimalValue) return 0;
  return parseFloat(decimalValue.toString());
};

const pedidoController = {
  // ============================================
  // 1. OBTENER TODOS LOS PEDIDOS
  // ============================================
  async getAllPedidos(req, res) {
    try {
      const { page = 1, limit = 20, clienteId, estadoId } = req.query;
      const skip = (page - 1) * limit;
      
      const where = {
        fecha_delete: null
      };
      
      if (clienteId) where.id_cliente = parseInt(clienteId);
      if (estadoId) {
        where.detalle_pedidos = {
          some: {
            id_estado: parseInt(estadoId)
          }
        };
      }
      
      const [pedidos, total] = await Promise.all([
        prisma.pedidos.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          orderBy: { fecha_pedido: 'desc' },
          include: {
            cliente: {
              select: {
                id: true,
                nombre: true,
                telefono: true,
                email: true
              }
            },
            administrador: {
              select: {
                id: true,
                nombre: true,
                usuario: true
              }
            },
            detalle_pedidos: {
              include: {
                producto: true,
                estado: true
              }
            },
            detalle_pago: {
              include: {
                pago: true
              }
            }
          }
        }),
        prisma.pedidos.count({ where })
      ]);
      
      const pedidosFormateados = pedidos.map(pedido => {
        let totalPedido = 0;
        let totalPagado = 0;
        
        pedido.detalle_pedidos.forEach(detalle => {
          totalPedido += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
        });
        
        pedido.detalle_pago.forEach(detallePago => {
          totalPagado += decimalToNumber(detallePago.valor);
        });
        
        let estadoGeneral = 'pendiente';
        if (pedido.detalle_pedidos.length > 0) {
          const estados = pedido.detalle_pedidos.map(d => d.estado?.descripcion);
          if (estados.every(e => e === 'completado' || e === 'entregado')) estadoGeneral = 'entregado';
          else if (estados.some(e => e === 'en_proceso')) estadoGeneral = 'en_proceso';
        }
        
        return {
          id: pedido.id,
          id_cliente: pedido.id_cliente,
          cliente: pedido.cliente,
          administrador: pedido.administrador,
          fecha_pedido: pedido.fecha_pedido,
          fecha_entrega: pedido.fecha_entrega,
          fecha_delete: pedido.fecha_delete,
          descripcion: pedido.descripcion, // ✅ NUEVO CAMPO
          detalles: pedido.detalle_pedidos,
          pagos: pedido.detalle_pago,
          total: totalPedido,
          totalPagado: totalPagado,
          saldoPendiente: totalPedido - totalPagado,
          estado: estadoGeneral,
          pacientes: [...new Set(pedido.detalle_pedidos.map(d => d.paciente).filter(Boolean))]
        };
      });
      
      res.json({
        success: true,
        data: pedidosFormateados,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error obteniendo pedidos:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener pedidos',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // ============================================
  // 2. OBTENER PEDIDO POR ID
  // ============================================
  async getPedidoById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de pedido inválido'
        });
      }
      
      console.log(`🔍 Buscando pedido ID: ${id}`);

      const pedido = await prisma.pedidos.findUnique({
        where: { id: parseInt(id) },
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              telefono: true,
              email: true,
              celular: true
            }
          },
          administrador: {
            select: {
              id: true,
              nombre: true,
              usuario: true
            }
          },
          detalle_pedidos: {
            include: {
              producto: true,
              estado: true
            },
            orderBy: { id: 'asc' }
          },
          detalle_pago: {
            include: {
              pago: true
            },
            orderBy: { fecha_pago: 'desc' }
          }
        }
      });
      
      if (!pedido || pedido.fecha_delete) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o eliminado'
        });
      }
      
      let totalPedido = 0;
      let totalPagado = 0;
      
      pedido.detalle_pedidos.forEach(detalle => {
        totalPedido += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
      });
      
      pedido.detalle_pago.forEach(detallePago => {
        totalPagado += decimalToNumber(detallePago.valor);
      });
      
      const pedidoFormateado = {
        ...pedido,
        total: totalPedido,
        totalPagado: totalPagado,
        saldoPendiente: totalPedido - totalPagado,
        pacientes: [...new Set(pedido.detalle_pedidos.map(d => d.paciente).filter(Boolean))]
      };
      
      res.json({
        success: true,
        data: pedidoFormateado
      });
    } catch (error) {
      console.error('Error obteniendo pedido:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener pedido'
      });
    }
  },

  // ============================================
  // 3. CREAR NUEVO PEDIDO (CON DESCRIPCIÓN)
  // ============================================
  async createPedido(req, res) {
    try {
      const {
        id_cliente,
        id_administrador = 1,
        fecha_entrega,
        descripcion, // ✅ NUEVO CAMPO
        detalles,
        pagos = []
      } = req.body;
      
      console.log('📝 Datos recibidos para pedido:', req.body);
      
      if (!id_cliente || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cliente y al menos un detalle son requeridos'
        });
      }
      
      const cliente = await prisma.cliente.findUnique({
        where: { id: parseInt(id_cliente) }
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }
      
      for (const detalle of detalles) {
        const producto = await prisma.producto.findUnique({
          where: { id: parseInt(detalle.id_producto) }
        });
        
        if (!producto) {
          return res.status(404).json({
            success: false,
            message: `Producto con ID ${detalle.id_producto} no encontrado`
          });
        }
      }
      
      const resultado = await prisma.$transaction(async (prisma) => {
        // Crear el pedido principal CON DESCRIPCIÓN
        const pedido = await prisma.pedidos.create({
          data: {
            id_cliente: parseInt(id_cliente),
            id_administrador: parseInt(id_administrador),
            fecha_pedido: new Date(),
            fecha_entrega: fecha_entrega ? new Date(fecha_entrega) : null,
            descripcion: descripcion || null, // ✅ GUARDAR DESCRIPCIÓN
            fecha_delete: null
          },
          include: {
            cliente: true,
            administrador: true
          }
        });
        
        // Crear detalles del pedido
        const detallesCreados = await Promise.all(
          detalles.map(detalle => 
            prisma.detalle_pedidos.create({
              data: {
                id_pedido: pedido.id,
                id_producto: parseInt(detalle.id_producto),
                cantidad: parseInt(detalle.cantidad) || 1,
                precio_unitario: parseFloat(detalle.precio_unitario),
                paciente: detalle.paciente || null,
                id_estado: detalle.id_estado ? parseInt(detalle.id_estado) : 1
              },
              include: {
                producto: true,
                estado: true
              }
            })
          )
        );
        
        // Crear pagos si existen
        let pagosCreados = [];
        if (pagos && pagos.length > 0) {
          const pagoPrincipal = await prisma.pago.create({
            data: {
              valor: pagos.reduce((sum, p) => sum + parseFloat(p.valor), 0),
              id_administrador: parseInt(id_administrador)
            }
          });
          
          pagosCreados = await Promise.all(
            pagos.map(pago =>
              prisma.detalle_pago.create({
                data: {
                  id_pago: pagoPrincipal.id,
                  id_pedido: pedido.id,
                  valor: parseFloat(pago.valor),
                  fecha_pago: pago.fecha_pago ? new Date(pago.fecha_pago) : new Date()
                },
                include: {
                  pago: true
                }
              })
            )
          );
        }
        
        return {
          pedido,
          detalles: detallesCreados,
          pagos: pagosCreados
        };
      });
      
      console.log('✅ Pedido creado exitosamente:', resultado.pedido.id);
      
      const total = resultado.detalles.reduce((sum, detalle) => 
        sum + (decimalToNumber(detalle.precio_unitario) * detalle.cantidad), 0);
      
      const totalPagado = resultado.pagos.reduce((sum, detallePago) => 
        sum + decimalToNumber(detallePago.valor), 0);
      
      res.status(201).json({
        success: true,
        message: 'Pedido creado exitosamente',
        data: {
          ...resultado.pedido,
          detalles: resultado.detalles,
          pagos: resultado.pagos,
          total: total,
          totalPagado: totalPagado,
          saldoPendiente: total - totalPagado
        }
      });
      
    } catch (error) {
      console.error('❌ Error creando pedido:', error);
      
      if (error.code === 'P2003') {
        return res.status(404).json({
          success: false,
          message: 'Cliente, producto o administrador no encontrado'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Error al crear pedido',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // ============================================
  // 4. AGREGAR DETALLE A PEDIDO
  // ============================================
  async agregarDetallePedido(req, res) {
    try {
      const { id } = req.params;
      const detalle = req.body;
      
      if (!detalle.id_producto || !detalle.cantidad || !detalle.precio_unitario) {
        return res.status(400).json({
          success: false,
          message: 'Producto, cantidad y precio son requeridos'
        });
      }
      
      const pedido = await prisma.pedidos.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!pedido || pedido.fecha_delete) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }
      
      const producto = await prisma.producto.findUnique({
        where: { id: parseInt(detalle.id_producto) }
      });
      
      if (!producto) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      const detalleCreado = await prisma.detalle_pedidos.create({
        data: {
          id_pedido: parseInt(id),
          id_producto: parseInt(detalle.id_producto),
          cantidad: parseInt(detalle.cantidad),
          precio_unitario: parseFloat(detalle.precio_unitario),
          paciente: detalle.paciente || null,
          id_estado: detalle.id_estado ? parseInt(detalle.id_estado) : 1
        },
        include: {
          producto: true,
          estado: true
        }
      });
      
      res.status(201).json({
        success: true,
        message: 'Detalle agregado al pedido',
        data: detalleCreado
      });
      
    } catch (error) {
      console.error('Error agregando detalle:', error);
      res.status(500).json({
        success: false,
        error: 'Error al agregar detalle'
      });
    }
  },

  // ============================================
  // 5. ACTUALIZAR ESTADO DE UN DETALLE
  // ============================================
  async updateEstadoDetalle(req, res) {
    try {
      const { pedidoId, detalleId } = req.params;
      const { id_estado } = req.body;
      
      if (!id_estado) {
        return res.status(400).json({
          success: false,
          message: 'ID de estado es requerido'
        });
      }
      
      const estado = await prisma.estado.findUnique({
        where: { id: parseInt(id_estado) }
      });
      
      if (!estado) {
        return res.status(404).json({
          success: false,
          message: 'Estado no encontrado'
        });
      }
      
      const detalle = await prisma.detalle_pedidos.update({
        where: { 
          id: parseInt(detalleId),
          id_pedido: parseInt(pedidoId)
        },
        data: { 
          id_estado: parseInt(id_estado)
        },
        include: {
          estado: true,
          producto: true
        }
      });
      
      res.json({
        success: true,
        message: 'Estado actualizado',
        data: detalle
      });
    } catch (error) {
      console.error('Error actualizando estado:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar estado'
      });
    }
  },

  // ============================================
  // 6. AGREGAR PAGO A PEDIDO
  // ============================================
  async agregarPago(req, res) {
    try {
      const { id } = req.params;
      const { valor, fecha_pago, id_administrador = 1 } = req.body;
      
      if (!valor) {
        return res.status(400).json({
          success: false,
          message: 'Valor del pago es requerido'
        });
      }
      
      const pedido = await prisma.pedidos.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!pedido || pedido.fecha_delete) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }
      
      const resultado = await prisma.$transaction(async (prisma) => {
        const pago = await prisma.pago.create({
          data: {
            valor: parseFloat(valor),
            id_administrador: parseInt(id_administrador)
          }
        });
        
        const detallePago = await prisma.detalle_pago.create({
          data: {
            id_pago: pago.id,
            id_pedido: parseInt(id),
            valor: parseFloat(valor),
            fecha_pago: fecha_pago ? new Date(fecha_pago) : new Date()
          },
          include: {
            pago: true,
            pedido: {
              include: {
                cliente: true
              }
            }
          }
        });
        
        return detallePago;
      });
      
      res.status(201).json({
        success: true,
        message: 'Pago registrado exitosamente',
        data: resultado
      });
      
    } catch (error) {
      console.error('Error agregando pago:', error);
      res.status(500).json({
        success: false,
        error: 'Error al registrar pago'
      });
    }
  },

  // ============================================
  // 7. ELIMINAR PEDIDO (SOFT DELETE)
  // ============================================
  async deletePedido(req, res) {
    try {
      const { id } = req.params;
      
      const pedido = await prisma.pedidos.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }
      
      await prisma.pedidos.update({
        where: { id: parseInt(id) },
        data: { fecha_delete: new Date() }
      });
      
      res.json({
        success: true,
        message: 'Pedido eliminado exitosamente'
      });
      
    } catch (error) {
      console.error('Error eliminando pedido:', error);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar pedido'
      });
    }
  },

  // ============================================
  // 8. OBTENER PEDIDOS POR CLIENTE
  // ============================================
  async getPedidosByCliente(req, res) {
    try {
      const { clienteId } = req.params;
      const { withDetails = false } = req.query;
      
      const includeDetails = withDetails === 'true' || withDetails === true;
      
      const pedidos = await prisma.pedidos.findMany({
        where: { 
          id_cliente: parseInt(clienteId),
          fecha_delete: null
        },
        orderBy: { fecha_pedido: 'desc' },
        include: {
          administrador: {
            select: {
              id: true,
              nombre: true
            }
          },
          detalle_pedidos: includeDetails ? {
            include: {
              producto: true,
              estado: true
            }
          } : false,
          detalle_pago: includeDetails ? {
            include: {
              pago: true
            }
          } : false
        }
      });
      
      const pedidosConTotales = pedidos.map(pedido => {
        let total = 0;
        let totalPagado = 0;
        
        if (includeDetails) {
          pedido.detalle_pedidos?.forEach(detalle => {
            total += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
          });
          
          pedido.detalle_pago?.forEach(detallePago => {
            totalPagado += decimalToNumber(detallePago.valor);
          });
        }
        
        return {
          ...pedido,
          descripcion: pedido.descripcion, // ✅ NUEVO CAMPO
          total: total,
          totalPagado: totalPagado,
          saldoPendiente: total - totalPagado,
          pacientes: [...new Set(pedido.detalle_pedidos?.map(d => d.paciente).filter(Boolean) || [])]
        };
      });
      
      res.json({
        success: true,
        data: pedidosConTotales
      });
    } catch (error) {
      console.error('Error obteniendo pedidos por cliente:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener pedidos'
      });
    }
  },

  // ============================================
  // 9. OBTENER ESTADÍSTICAS
  // ============================================
  async getEstadisticas(req, res) {
    try {
      const totalPedidos = await prisma.pedidos.count({
        where: { fecha_delete: null }
      });
      
      const detalles = await prisma.detalle_pedidos.findMany({
        where: {
          pedido: {
            fecha_delete: null
          }
        },
        select: {
          cantidad: true,
          precio_unitario: true
        }
      });
      
      const ventasTotales = detalles.reduce((sum, detalle) => {
        return sum + (decimalToNumber(detalle.precio_unitario) * detalle.cantidad);
      }, 0);
      
      const pagos = await prisma.detalle_pago.findMany({
        where: {
          pedido: {
            fecha_delete: null
          }
        },
        select: {
          valor: true
        }
      });
      
      const totalPagado = pagos.reduce((sum, pago) => {
        return sum + decimalToNumber(pago.valor);
      }, 0);
      
      const clientesConPedidos = await prisma.cliente.count({
        where: {
          pedidos: {
            some: {
              fecha_delete: null
            }
          }
        }
      });
      
      const estados = await prisma.estado.findMany({
        include: {
          detalle_pedidos: {
            where: {
              pedido: {
                fecha_delete: null
              }
            }
          }
        }
      });
      
      const pedidosPorEstado = estados.map(estado => ({
        estado: estado.descripcion,
        count: estado.detalle_pedidos.length
      }));
      
      res.json({
        success: true,
        data: {
          totalPedidos,
          ventasTotales,
          totalPagado,
          saldoPendiente: ventasTotales - totalPagado,
          clientesConPedidos,
          pedidosPorEstado,
          promedioPorPedido: totalPedidos > 0 ? (ventasTotales / totalPedidos).toFixed(2) : 0
        }
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estadísticas'
      });
    }
  },

  // ============================================
  // 10. OBTENER PEDIDOS POR FECHA
  // ============================================
  async getPedidosPorFecha(req, res) {
    try {
      const { fecha } = req.query;
      
      if (!fecha) {
        const pedidos = await prisma.pedidos.findMany({
          where: {
            fecha_delete: null,
            fecha_entrega: { not: null }
          },
          orderBy: { fecha_entrega: 'asc' },
          include: {
            cliente: {
              select: {
                id: true,
                nombre: true,
                telefono: true,
                email: true,
                celular: true
              }
            },
            detalle_pedidos: {
              include: { producto: true, estado: true }
            },
            detalle_pago: {
              include: { pago: true }
            }
          }
        });
        
        const pedidosFormateados = pedidos.map(pedido => {
          let totalPedido = 0;
          let totalPagado = 0;
          
          pedido.detalle_pedidos.forEach(detalle => {
            totalPedido += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
          });
          
          pedido.detalle_pago.forEach(detallePago => {
            totalPagado += decimalToNumber(detallePago.valor);
          });
          
          let estadoGeneral = 'pendiente';
          if (pedido.detalle_pedidos.length > 0) {
            const estados = pedido.detalle_pedidos.map(d => d.estado?.descripcion?.toLowerCase());
            if (estados.every(e => e === 'completado' || e === 'entregado')) estadoGeneral = 'entregado';
            else if (estados.some(e => e === 'en_proceso')) estadoGeneral = 'en_proceso';
          }
          
          return {
            id: pedido.id,
            id_cliente: pedido.id_cliente,
            fecha_pedido: pedido.fecha_pedido,
            fecha_entrega: pedido.fecha_entrega,
            descripcion: pedido.descripcion, // ✅ NUEVO CAMPO
            cliente: pedido.cliente,
            administrador: pedido.administrador,
            detalles: pedido.detalle_pedidos,
            pagos: pedido.detalle_pago,
            total: totalPedido,
            totalPagado: totalPagado,
            saldoPendiente: totalPedido - totalPagado,
            estado: estadoGeneral,
            pacientes: [...new Set(pedido.detalle_pedidos.map(d => d.paciente).filter(Boolean))]
          };
        });
        
        return res.json({
          success: true,
          data: pedidosFormateados,
          total: pedidosFormateados.length,
          mensaje: 'Mostrando todos los pedidos con fecha de entrega'
        });
      }
      
      const fechaInicio = new Date(fecha);
      fechaInicio.setHours(0, 0, 0, 0);
      
      const fechaFin = new Date(fecha);
      fechaFin.setHours(23, 59, 59, 999);
      
      const pedidos = await prisma.pedidos.findMany({
        where: {
          fecha_delete: null,
          fecha_entrega: {
            gte: fechaInicio,
            lte: fechaFin
          }
        },
        include: {
          cliente: true,
          detalle_pedidos: { include: { producto: true, estado: true } },
          detalle_pago: { include: { pago: true } }
        }
      });
      
      const pedidosFormateados = pedidos.map(pedido => {
        let total = 0;
        pedido.detalle_pedidos.forEach(detalle => {
          total += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
        });
        
        return {
          id: pedido.id,
          fecha_entrega: pedido.fecha_entrega,
          descripcion: pedido.descripcion, // ✅ NUEVO CAMPO
          cliente: pedido.cliente,
          total: total,
          detalles_count: pedido.detalle_pedidos.length
        };
      });
      
      res.json({
        success: true,
        data: pedidosFormateados,
        fecha: fecha,
        total: pedidosFormateados.length
      });
      
    } catch (error) {
      console.error('❌ ERROR:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener pedidos',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // ============================================
  // 11. OBTENER AGENDA COMPLETA
  // ============================================
  async getAgenda(req, res) {
    try {
      const { fecha_inicio, fecha_fin, limit = 50 } = req.query;
      
      let whereClause = {
        fecha_delete: null,
        fecha_entrega: { not: null }
      };
      
      if (fecha_inicio && fecha_fin) {
        const inicio = new Date(fecha_inicio);
        inicio.setHours(0, 0, 0, 0);
        
        const fin = new Date(fecha_fin);
        fin.setHours(23, 59, 59, 999);
        
        whereClause.fecha_entrega = {
          gte: inicio,
          lte: fin
        };
      } else {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        const treintaDias = new Date();
        treintaDias.setDate(treintaDias.getDate() + 30);
        treintaDias.setHours(23, 59, 59, 999);
        
        whereClause.fecha_entrega = {
          gte: hoy,
          lte: treintaDias
        };
      }
      
      const pedidos = await prisma.pedidos.findMany({
        where: whereClause,
        orderBy: { fecha_entrega: 'asc' },
        take: parseInt(limit),
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              telefono: true
            }
          },
          detalle_pedidos: {
            include: {
              producto: true,
              estado: true
            }
          }
        }
      });
      
      const agenda = {};
      
      pedidos.forEach(pedido => {
        if (!pedido.fecha_entrega) return;
        
        const fechaKey = pedido.fecha_entrega.toISOString().split('T')[0];
        
        if (!agenda[fechaKey]) {
          agenda[fechaKey] = [];
        }
        
        const total = pedido.detalle_pedidos.reduce((sum, detalle) => {
          return sum + (decimalToNumber(detalle.precio_unitario) * detalle.cantidad);
        }, 0);
        
        agenda[fechaKey].push({
          id: pedido.id,
          cliente: pedido.cliente?.nombre || 'Cliente',
          descripcion: pedido.descripcion, // ✅ NUEVO CAMPO
          total: total,
          productos: pedido.detalle_pedidos.length,
          estado: pedido.detalle_pedidos.some(d => d.id_estado !== 4) ? 'pendiente' : 'completado'
        });
      });
      
      res.json({
        success: true,
        data: agenda,
        total_pedidos: pedidos.length
      });
      
    } catch (error) {
      console.error('Error obteniendo agenda:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener agenda'
      });
    }
  },

  // ============================================
  // 12. BUSCAR PEDIDOS - VERSIÓN CORREGIDA PARA MYSQL
  // ============================================
  async searchPedidos(req, res) {
    try {
      const { term } = req.query;
      
      if (!term || term.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Término debe tener al menos 2 caracteres'
        });
      }

      console.log(`🔍 Buscando pedidos con término: "${term}"`);
      
      const pedidos = await prisma.pedidos.findMany({
        where: {
          fecha_delete: null,
          OR: [
            ...(!isNaN(parseInt(term)) ? [{ id: parseInt(term) }] : []),
            { cliente: { nombre: { contains: term } } },
            { cliente: { telefono: { contains: term } } },
            { cliente: { celular: { contains: term } } },
            { cliente: { email: { contains: term } } },
            { 
              detalle_pedidos: { 
                some: { 
                  paciente: { contains: term } 
                } 
              } 
            },
            // ✅ BUSCAR POR DESCRIPCIÓN
            { 
              descripcion: { 
                contains: term 
              } 
            }
          ]
        },
        include: {
          cliente: true,
          administrador: {
            select: {
              id: true,
              nombre: true
            }
          },
          detalle_pedidos: {
            include: {
              producto: true,
              estado: true
            },
            take: 5
          },
          detalle_pago: {
            include: {
              pago: true
            },
            take: 3
          }
        },
        take: 20,
        orderBy: { fecha_pedido: 'desc' }
      });

      const pedidosFormateados = pedidos.map(pedido => {
        let total = 0;
        let totalPagado = 0;
        
        pedido.detalle_pedidos?.forEach(d => {
          total += decimalToNumber(d.precio_unitario) * d.cantidad;
        });
        
        pedido.detalle_pago?.forEach(p => {
          totalPagado += decimalToNumber(p.valor);
        });
        
        let estadoGeneral = 'pendiente';
        if (pedido.detalle_pedidos?.length > 0) {
          const estados = pedido.detalle_pedidos.map(d => d.estado?.descripcion?.toLowerCase());
          if (estados.every(e => e === 'completado' || e === 'entregado')) estadoGeneral = 'entregado';
          else if (estados.some(e => e === 'en_proceso')) estadoGeneral = 'en_proceso';
        }
        
        return {
          id: pedido.id,
          id_cliente: pedido.id_cliente,
          cliente: pedido.cliente,
          administrador: pedido.administrador,
          fecha_pedido: pedido.fecha_pedido,
          fecha_entrega: pedido.fecha_entrega,
          descripcion: pedido.descripcion, // ✅ NUEVO CAMPO
          detalles: pedido.detalle_pedidos,
          pagos: pedido.detalle_pago,
          total,
          totalPagado,
          saldoPendiente: total - totalPagado,
          estado: estadoGeneral,
          pacientes: [...new Set(pedido.detalle_pedidos?.map(d => d.paciente).filter(Boolean) || [])]
        };
      });

      res.json({
        success: true,
        data: pedidosFormateados,
        total: pedidosFormateados.length,
        termino: term
      });
    } catch (error) {
      console.error('❌ Error buscando pedidos:', error);
      res.status(500).json({
        success: false,
        error: 'Error al buscar pedidos'
      });
    }
  },

  // ============================================
  // 13. ACTUALIZAR DESCRIPCIÓN DE PEDIDO (NUEVO)
  // ============================================
  async updatePedidoDescripcion(req, res) {
    try {
      const { id } = req.params;
      const { descripcion } = req.body;
      
      const pedido = await prisma.pedidos.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!pedido || pedido.fecha_delete) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }
      
      const pedidoActualizado = await prisma.pedidos.update({
        where: { id: parseInt(id) },
        data: { 
          descripcion: descripcion || null 
        }
      });
      
      res.json({
        success: true,
        message: 'Descripción actualizada exitosamente',
        data: pedidoActualizado
      });
      
    } catch (error) {
      console.error('Error actualizando descripción:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar descripción'
      });
    }
  },
  // ============================================
// 14. ACTUALIZAR ESTADO DEL PEDIDO (NUEVO)
// ============================================
async updateEstadoPedido(req, res) {
  try {
    const { id } = req.params;
    const { id_estado } = req.body;
    
    if (!id_estado) {
      return res.status(400).json({
        success: false,
        message: 'ID de estado es requerido'
      });
    }
    
    // Verificar que el estado existe
    const estado = await prisma.estado.findUnique({
      where: { id: parseInt(id_estado) }
    });
    
    if (!estado) {
      return res.status(404).json({
        success: false,
        message: 'Estado no encontrado'
      });
    }
    
    const pedido = await prisma.pedidos.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!pedido || pedido.fecha_delete) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }
    
    // Aquí actualizamos el estado del pedido
    // Nota: En tu modelo actual no hay un campo id_estado en pedidos
    // Por lo que necesitamos actualizar TODOS los detalles del pedido
    // o agregar un campo estado al pedido. Te recomiendo actualizar los detalles.
    
    // Opción A: Actualizar todos los detalles del pedido al mismo estado
    await prisma.detalle_pedidos.updateMany({
      where: { id_pedido: parseInt(id) },
      data: { id_estado: parseInt(id_estado) }
    });
    
    // Opción B: Si prefieres tener un estado general del pedido,
    // necesitas modificar tu modelo primero. Por ahora usaremos Opción A.
    
    // Obtener el pedido actualizado
    const pedidoActualizado = await prisma.pedidos.findUnique({
      where: { id: parseInt(id) },
      include: {
        cliente: true,
        detalle_pedidos: {
          include: {
            estado: true
          }
        },
        detalle_pago: true
      }
    });
    
    // Calcular totales
    let total = 0;
    let totalPagado = 0;
    
    pedidoActualizado.detalle_pedidos.forEach(detalle => {
      total += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
    });
    
    pedidoActualizado.detalle_pago.forEach(pago => {
      totalPagado += decimalToNumber(pago.valor);
    });
    
    const estadoGeneral = pedidoActualizado.detalle_pedidos[0]?.estado?.descripcion || 'pendiente';
    
    res.json({
      success: true,
      message: 'Estado del pedido actualizado exitosamente',
      data: {
        ...pedidoActualizado,
        total,
        totalPagado,
        saldoPendiente: total - totalPagado,
        estado: estadoGeneral
      }
    });
    
  } catch (error) {
    console.error('❌ Error actualizando estado del pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar estado del pedido',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
};

module.exports = pedidoController;