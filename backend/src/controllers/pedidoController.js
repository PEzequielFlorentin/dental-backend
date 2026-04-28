const prisma = require('../config/prisma'); // ✅ Importar desde archivo central

// Función auxiliar para convertir Decimal a Number
const decimalToNumber = (decimalValue) => {
  if (!decimalValue) return 0;
  return parseFloat(decimalValue.toString());
};

const pedidoController = {
  // ============================================
  // 1. OBTENER TODOS LOS PEDIDOS (FILTRADO POR ADMIN)
  // ============================================
  async getAllPedidos(req, res) {
    try {
      const { page = 1, limit = 999999, clienteId, estadoId } = req.query;
      const skip = (page - 1) * limit;
      
      const where = {
        fecha_delete: null,
        cliente: {
          id_administrador: req.admin.id  // ✅ FILTRO: solo pedidos de clientes de este admin
        }
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
          fecha_delete: pedido.fecha_delete,
          descripcion: pedido.descripcion,
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
  // 2. OBTENER PEDIDO POR ID (CON VERIFICACIÓN DE ADMIN)
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
      
      console.log(`🔍 Buscando pedido ID: ${id} para admin: ${req.admin.id}`);

      const pedido = await prisma.pedidos.findFirst({
        where: { 
          id: parseInt(id),
          fecha_delete: null,
          cliente: {
            id_administrador: req.admin.id  // ✅ VERIFICA que el cliente pertenece al admin
          }
        },
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
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o no tienes permisos para verlo'
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
  // 3. CREAR NUEVO PEDIDO (CON VERIFICACIÓN DE ADMIN)
  // ============================================
  async createPedido(req, res) {
    try {
      const {
        id_cliente,
        fecha_entrega,
        descripcion,
        detalles,
        pagos = []
      } = req.body;
      
      console.log('📝 Datos recibidos para pedido:', req.body);
      console.log('📝 Admin logueado:', req.admin.id);
      
      if (!id_cliente || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cliente y al menos un detalle son requeridos'
        });
      }
      
      // ✅ Verificar que el cliente pertenece al admin logueado
      const cliente = await prisma.cliente.findFirst({
        where: { 
          id: parseInt(id_cliente),
          id_administrador: req.admin.id  // ✅ FILTRO
        }
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado o no tienes permisos para crear pedidos para este cliente'
        });
      }
      
      // ✅ Usar el admin logueado
      const adminId = req.admin.id;
      
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
        
        if (detalle.id_estado) {
          const estado = await prisma.estado.findUnique({
            where: { id: parseInt(detalle.id_estado) }
          });
          if (!estado) {
            return res.status(404).json({
              success: false,
              message: `Estado con ID ${detalle.id_estado} no encontrado`
            });
          }
        }
      }
      
      const resultado = await prisma.$transaction(async (prisma) => {
        const pedido = await prisma.pedidos.create({
          data: {
            id_cliente: parseInt(id_cliente),
            id_administrador: adminId,  // ✅ Asigna el admin logueado
            fecha_pedido: new Date(),
            fecha_entrega: fecha_entrega ? new Date(fecha_entrega) : null,
            descripcion: descripcion || null,
            fecha_delete: null
          },
          include: {
            cliente: true,
            administrador: true
          }
        });
        
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
        
        let pagosCreados = [];
        if (pagos && pagos.length > 0) {
          const pagoPrincipal = await prisma.pago.create({
            data: {
              valor: pagos.reduce((sum, p) => sum + parseFloat(p.valor), 0),
              id_administrador: adminId  // ✅ Asigna el admin logueado
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
  // 4. AGREGAR DETALLE A PEDIDO (CON VERIFICACIÓN)
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
      
      // ✅ Verificar que el pedido pertenece a un cliente del admin
      const pedido = await prisma.pedidos.findFirst({
        where: { 
          id: parseInt(id),
          fecha_delete: null,
          cliente: {
            id_administrador: req.admin.id
          }
        }
      });
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o no tienes permisos'
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
      
      if (detalle.id_estado) {
        const estado = await prisma.estado.findUnique({
          where: { id: parseInt(detalle.id_estado) }
        });
        if (!estado) {
          return res.status(404).json({
            success: false,
            message: 'Estado no encontrado'
          });
        }
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
  // 5. ACTUALIZAR ESTADO DE UN DETALLE (CON VERIFICACIÓN)
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
      
      // ✅ Verificar que el pedido pertenece a un cliente del admin
      const pedido = await prisma.pedidos.findFirst({
        where: { 
          id: parseInt(pedidoId),
          cliente: {
            id_administrador: req.admin.id
          }
        }
      });
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o no tienes permisos'
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
      
      const detalleExistente = await prisma.detalle_pedidos.findFirst({
        where: { 
          id: parseInt(detalleId),
          id_pedido: parseInt(pedidoId)
        }
      });
      
      if (!detalleExistente) {
        return res.status(404).json({
          success: false,
          message: 'Detalle de pedido no encontrado'
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
  // 6. AGREGAR PAGO A PEDIDO (CON VERIFICACIÓN)
  // ============================================
  async agregarPago(req, res) {
    try {
      const { id } = req.params;
      const { valor, fecha_pago } = req.body;
      
      if (!valor || parseFloat(valor) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valor del pago es requerido y debe ser mayor a 0'
        });
      }
      
      // ✅ Verificar que el pedido pertenece a un cliente del admin
      const pedido = await prisma.pedidos.findFirst({
        where: { 
          id: parseInt(id),
          fecha_delete: null,
          cliente: {
            id_administrador: req.admin.id
          }
        },
        include: {
          detalle_pedidos: true,
          detalle_pago: true
        }
      });
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o no tienes permisos'
        });
      }
      
      let totalPedido = 0;
      pedido.detalle_pedidos.forEach(detalle => {
        totalPedido += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
      });
      
      let totalPagadoActual = 0;
      pedido.detalle_pago.forEach(detallePago => {
        totalPagadoActual += decimalToNumber(detallePago.valor);
      });
      
      const valorNumber = parseFloat(valor);
      const saldoPendiente = totalPedido - totalPagadoActual;
      
      if (valorNumber > saldoPendiente) {
        return res.status(400).json({
          success: false,
          message: `El valor excede el saldo pendiente ($${saldoPendiente.toFixed(2)})`
        });
      }
      
      const resultado = await prisma.$transaction(async (prisma) => {
        const pago = await prisma.pago.create({
          data: {
            valor: valorNumber,
            id_administrador: req.admin.id  // ✅ Asigna el admin logueado
          }
        });
        
        const detallePago = await prisma.detalle_pago.create({
          data: {
            id_pago: pago.id,
            id_pedido: parseInt(id),
            valor: valorNumber,
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
  // 7. ELIMINAR PEDIDO (SOFT DELETE CON VERIFICACIÓN)
  // ============================================
  async deletePedido(req, res) {
    try {
      const { id } = req.params;
      
      // ✅ Verificar que el pedido pertenece a un cliente del admin
      const pedido = await prisma.pedidos.findFirst({
        where: { 
          id: parseInt(id),
          cliente: {
            id_administrador: req.admin.id
          }
        }
      });
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o no tienes permisos para eliminarlo'
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
  // 8. OBTENER PEDIDOS POR CLIENTE (CON VERIFICACIÓN)
  // ============================================
  async getPedidosByCliente(req, res) {
    try {
      const { clienteId } = req.params;
      const { withDetails = false } = req.query;
      
      // ✅ Verificar que el cliente pertenece al admin
      const cliente = await prisma.cliente.findFirst({
        where: {
          id: parseInt(clienteId),
          id_administrador: req.admin.id
        }
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado o no tienes permisos'
        });
      }
      
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
          descripcion: pedido.descripcion,
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
  // 9. OBTENER ESTADÍSTICAS (FILTRADO POR ADMIN)
  // ============================================
  async getEstadisticas(req, res) {
    try {
      const totalPedidos = await prisma.pedidos.count({
        where: { 
          fecha_delete: null,
          cliente: {
            id_administrador: req.admin.id  // ✅ FILTRO
          }
        }
      });
      
      const detalles = await prisma.detalle_pedidos.findMany({
        where: {
          pedido: {
            fecha_delete: null,
            cliente: {
              id_administrador: req.admin.id  // ✅ FILTRO
            }
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
            fecha_delete: null,
            cliente: {
              id_administrador: req.admin.id  // ✅ FILTRO
            }
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
          id_administrador: req.admin.id,  // ✅ FILTRO
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
                fecha_delete: null,
                cliente: {
                  id_administrador: req.admin.id  // ✅ FILTRO
                }
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
  // 10. OBTENER PEDIDOS POR FECHA (FILTRADO POR ADMIN)
  // ============================================
  async getPedidosPorFecha(req, res) {
    try {
      const { fecha } = req.query;
      console.log('📡 getPedidosPorFecha - Con estado');
      
      if (!fecha) {
        const pedidos = await prisma.pedidos.findMany({
          where: {
            fecha_delete: null,
            fecha_entrega: { not: undefined },
            cliente: {
              id_administrador: req.admin.id  // ✅ FILTRO
            }
          },
          take: 50,
          select: {
            id: true,
            fecha_entrega: true,
            descripcion: true,
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
              select: {
                estado: {
                  select: {
                    id: true,
                    descripcion: true
                  }
                }
              },
              take: 1
            }
          },
          orderBy: { fecha_entrega: 'asc' }
        });
        
        const pedidosFormateados = pedidos.map(pedido => {
          const estado = pedido.detalle_pedidos[0]?.estado?.descripcion || 'pendiente';
          const estadoId = pedido.detalle_pedidos[0]?.estado?.id || 1;
          
          return {
            id: pedido.id,
            fecha_entrega: pedido.fecha_entrega,
            descripcion: pedido.descripcion,
            cliente: pedido.cliente,
            estado: estado,
            estadoId: estadoId
          };
        });
        
        return res.json({
          success: true,
          data: pedidosFormateados,
          total: pedidosFormateados.length
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
          },
          cliente: {
            id_administrador: req.admin.id  // ✅ FILTRO
          }
        },
        select: {
          id: true,
          fecha_entrega: true,
          descripcion: true,
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
            select: {
              estado: {
                select: {
                  id: true,
                  descripcion: true
                }
              }
            },
            take: 1
          }
        },
        orderBy: { fecha_entrega: 'asc' }
      });
      
      const pedidosFormateados = pedidos.map(pedido => {
        const estado = pedido.detalle_pedidos[0]?.estado?.descripcion || 'pendiente';
        const estadoId = pedido.detalle_pedidos[0]?.estado?.id || 1;
        
        return {
          id: pedido.id,
          fecha_entrega: pedido.fecha_entrega,
          descripcion: pedido.descripcion,
          cliente: pedido.cliente,
          estado: estado,
          estadoId: estadoId
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
        error: error.message
      });
    }
  },

  // ============================================
  // 11. OBTENER AGENDA COMPLETA (FILTRADO POR ADMIN)
  // ============================================
  async getAgenda(req, res) {
    try {
      const { fecha_inicio, fecha_fin, limit = 50 } = req.query;
      
      let whereClause = {
        fecha_delete: null,
        fecha_entrega: { not: null },
        cliente: {
          id_administrador: req.admin.id  // ✅ FILTRO
        }
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
          descripcion: pedido.descripcion,
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
  // 12. BUSCAR PEDIDOS (FILTRADO POR ADMIN)
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

      console.log(`🔍 Buscando pedidos con término: "${term}" para admin: ${req.admin.id}`);
      
      const pedidos = await prisma.pedidos.findMany({
        where: {
          fecha_delete: null,
          cliente: {
            id_administrador: req.admin.id  // ✅ FILTRO
          },
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
          descripcion: pedido.descripcion,
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
  // 13. ACTUALIZAR DESCRIPCIÓN DE PEDIDO (CON VERIFICACIÓN)
  // ============================================
  async updatePedidoDescripcion(req, res) {
    try {
      const { id } = req.params;
      const { descripcion } = req.body;
      
      // ✅ Verificar que el pedido pertenece a un cliente del admin
      const pedido = await prisma.pedidos.findFirst({
        where: { 
          id: parseInt(id),
          fecha_delete: null,
          cliente: {
            id_administrador: req.admin.id
          }
        }
      });
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o no tienes permisos'
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
  // 14. ACTUALIZAR ESTADO DEL PEDIDO (CON VERIFICACIÓN)
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
      
      const estado = await prisma.estado.findUnique({
        where: { id: parseInt(id_estado) }
      });
      
      if (!estado) {
        return res.status(404).json({
          success: false,
          message: 'Estado no encontrado'
        });
      }
      
      // ✅ Verificar que el pedido pertenece a un cliente del admin
      const pedido = await prisma.pedidos.findFirst({
        where: { 
          id: parseInt(id),
          fecha_delete: null,
          cliente: {
            id_administrador: req.admin.id
          }
        },
        include: {
          cliente: true,
          detalle_pedidos: true
        }
      });
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o no tienes permisos'
        });
      }
      
      if (pedido.detalle_pedidos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El pedido no tiene detalles para actualizar estado'
        });
      }
      
      await prisma.detalle_pedidos.updateMany({
        where: { id_pedido: parseInt(id) },
        data: { id_estado: parseInt(id_estado) }
      });
      
      const pedidoActualizado = await prisma.pedidos.findUnique({
        where: { id: parseInt(id) },
        include: {
          cliente: true,
          detalle_pedidos: {
            include: {
              estado: true,
              producto: true
            }
          },
          detalle_pago: {
            include: {
              pago: true
            }
          }
        }
      });
      
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