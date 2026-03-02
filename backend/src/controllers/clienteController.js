const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Función auxiliar para convertir Decimal a Number
const decimalToNumber = (decimalValue) => {
  if (!decimalValue) return 0;
  return parseFloat(decimalValue.toString());
};

const clienteController = {
  // ========== FUNCIONES BÁSICAS ==========
  
  // 0. Obtener todos los clientes (SIN PARÁMETROS)
  async getClientes(req, res) {
    try {
      const clientes = await prisma.cliente.findMany({
        orderBy: { nombre: 'asc' }
      });
      
      res.json({
        success: true,
        data: clientes
      });
    } catch (error) {
      console.error('Error obteniendo clientes:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener clientes'
      });
    }
  },

  // 1. Obtener todos los clientes (con filtros)
  async getAllClientes(req, res) {
    try {
      const { tipo, withAdmin = false } = req.query;
      
      const whereClause = {};
      
      // ✅ CORREGIDO: Usar id_tipo en lugar de tipo
      if (tipo && tipo !== 'TODOS') {
        whereClause.id_tipo = parseInt(tipo);
      }
      
      const clientes = await prisma.cliente.findMany({
        where: whereClause,
        orderBy: { id: 'desc' },
        include: {
          administrador: withAdmin === 'true' ? {
            select: {
              id: true,
              nombre: true,
              usuario: true
            }
          } : false,
          tipo_cliente: true // ✅ Incluir tipo_cliente
        }
      });
      
      res.json({
        success: true,
        data: clientes
      });
    } catch (error) {
      console.error('Error obteniendo clientes:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener clientes'
      });
    }
  },

  // 2. Crear nuevo cliente
  async createCliente(req, res) {
    try {
      const { 
        nombre, 
        telefono, 
        celular, 
        email,
        id_tipo, // ✅ CORREGIDO: usar id_tipo en lugar de tipo
        id_administrador = 1
      } = req.body;
      
      if (!nombre) {
        return res.status(400).json({
          success: false,
          message: 'Nombre es requerido'
        });
      }
      
      const cliente = await prisma.cliente.create({
        data: {
          nombre,
          telefono: telefono || null,
          celular: celular || null,
          email: email || null,
          id_tipo: id_tipo ? parseInt(id_tipo) : null,
          id_administrador: id_administrador ? parseInt(id_administrador) : null
        },
        include: {
          administrador: {
            select: {
              id: true,
              nombre: true,
              usuario: true
            }
          },
          tipo_cliente: true
        }
      });
      
      res.status(201).json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: cliente
      });
    } catch (error) {
      console.error('Error creando cliente:', error.message);
      
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'El email ya está registrado'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  },

  // 3. Obtener cliente por ID
  async getClienteById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de cliente inválido'
        });
      }
      
      const { withPedidos = false, withAdmin = false } = req.query;
      
      const cliente = await prisma.cliente.findUnique({
        where: { id: parseInt(id) },
        include: {
          administrador: withAdmin === 'true' ? {
            select: {
              id: true,
              nombre: true,
              usuario: true
            }
          } : false,
          tipo_cliente: true,
          pedidos: withPedidos === 'true' ? {
            include: {
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
            },
            orderBy: { fecha_pedido: 'desc' }
          } : false
        }
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }
      
      res.json({
        success: true,
        data: cliente
      });
    } catch (error) {
      console.error('Error obteniendo cliente:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener cliente'
      });
    }
  },

  // 4. Actualizar cliente
  async updateCliente(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de cliente inválido'
        });
      }
      
      const updateData = req.body;
      
      if (updateData.id_administrador) {
        updateData.id_administrador = parseInt(updateData.id_administrador);
      }
      if (updateData.id_tipo) {
        updateData.id_tipo = parseInt(updateData.id_tipo);
      }
      
      const cliente = await prisma.cliente.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          administrador: {
            select: {
              id: true,
              nombre: true,
              usuario: true
            }
          },
          tipo_cliente: true
        }
      });
      
      res.json({
        success: true,
        message: 'Cliente actualizado exitosamente',
        data: cliente
      });
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Error al actualizar cliente'
      });
    }
  },

  // 5. Eliminar cliente
  async deleteCliente(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de cliente inválido'
        });
      }
      
      await prisma.cliente.delete({
        where: { id: parseInt(id) }
      });
      
      res.json({
        success: true,
        message: 'Cliente eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error eliminando cliente:', error);
      
      if (error.code === 'P2003') {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar el cliente porque tiene pedidos asociados'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Error al eliminar cliente'
      });
    }
  },

  // 6. Buscar clientes
  async searchClientes(req, res) {
    try {
      const { term } = req.query;
      
      if (!term || term.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Término debe tener al menos 2 caracteres'
        });
      }
      
      const clientes = await prisma.cliente.findMany({
        where: {
          OR: [
            { nombre: { contains: term } },
            { email: { contains: term } },
            { telefono: { contains: term } },
            { celular: { contains: term } }
          ]
        },
        take: 10,
        include: {
          administrador: {
            select: {
              id: true,
              nombre: true
            }
          },
          tipo_cliente: true
        },
        orderBy: { nombre: 'asc' }
      });
      
      res.json({
        success: true,
        data: clientes
      });
    } catch (error) {
      console.error('Error buscando clientes:', error);
      res.status(500).json({
        success: false,
        error: 'Error al buscar clientes'
      });
    }
  },

  // 7. Health Check
  async healthCheck(req, res) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const totalClientes = await prisma.cliente.count();
      
      res.json({
        success: true,
        message: 'API de Clientes funcionando',
        timestamp: new Date().toISOString(),
        database: 'Conectado',
        totalClientes: totalClientes,
        version: '1.0.0'
      });
    } catch (error) {
      console.error('Error en health check:', error);
      res.status(500).json({
        success: false,
        message: 'Error en la API',
        error: error.message
      });
    }
  },

  // 8. Estadísticas por tipo (CORREGIDO)
  async getStatsByTipo(req, res) {
    try {
      // Obtener todos los tipos primero
      const tipos = await prisma.tipo_cliente.findMany();
      
      // Crear un mapa de id -> descripción
      const tipoMap = {};
      tipos.forEach(t => {
        tipoMap[t.id] = t.descripcion;
      });

      // GroupBy por id_tipo
      const groupStats = await prisma.cliente.groupBy({
        by: ['id_tipo'],
        _count: {
          id: true
        }
      });

      // Formatear resultados
      const stats = groupStats.map(item => ({
        tipo: item.id_tipo ? tipoMap[item.id_tipo] || 'Desconocido' : 'Sin tipo',
        count: item._count.id
      }));

      // Agregar tipos que no tienen clientes
      tipos.forEach(tipo => {
        const existe = stats.find(s => s.tipo === tipo.descripcion);
        if (!existe) {
          stats.push({
            tipo: tipo.descripcion,
            count: 0
          });
        }
      });

      const total = stats.reduce((sum, stat) => sum + stat.count, 0);
      
      const statsFormatted = stats.map(stat => ({
        tipo: stat.tipo,
        count: stat.count,
        porcentaje: total > 0 ? ((stat.count / total) * 100).toFixed(1) : '0.0'
      }));
      
      statsFormatted.push({
        tipo: 'TOTAL',
        count: total,
        porcentaje: '100.0'
      });
      
      res.json({
        success: true,
        data: statsFormatted
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas por tipo:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estadísticas por tipo'
      });
    }
  },

  // 9. Clientes con balance
  async getClientesConBalance(req, res) {
    try {
      const clientes = await prisma.cliente.findMany({
        include: {
          administrador: {
            select: {
              id: true,
              nombre: true
            }
          },
          tipo_cliente: true,
          pedidos: {
            where: {
              fecha_delete: null
            },
            include: {
              detalle_pedidos: {
                include: {
                  producto: true
                }
              },
              detalle_pago: {
                include: {
                  pago: true
                }
              }
            }
          }
        },
        orderBy: { nombre: 'asc' }
      });
      
      const clientesConBalance = clientes.map(cliente => {
        let totalFacturado = 0;
        let totalPagado = 0;
        
        cliente.pedidos.forEach(pedido => {
          pedido.detalle_pedidos.forEach(detalle => {
            totalFacturado += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
          });
          
          pedido.detalle_pago.forEach(detallePago => {
            totalPagado += decimalToNumber(detallePago.valor);
          });
        });
        
        const pendiente = totalFacturado - totalPagado;
        
        let estado = 'al_dia';
        if (pendiente > 0 && pendiente < totalFacturado) estado = 'parcial';
        if (pendiente >= totalFacturado * 0.5) estado = 'impago';
        
        return {
          id: cliente.id,
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          celular: cliente.celular,
          email: cliente.email,
          tipo: cliente.tipo_cliente?.descripcion || 'Sin tipo',
          administrador: cliente.administrador,
          balance: {
            total: totalFacturado,
            pagado: totalPagado,
            pendiente: pendiente,
            porcentajePagado: totalFacturado > 0 ? ((totalPagado / totalFacturado) * 100).toFixed(2) : '100.00',
            estado: estado
          },
          pedidosCount: cliente.pedidos.length
        };
      });
      
      res.json({
        success: true,
        data: clientesConBalance
      });
    } catch (error) {
      console.error('Error obteniendo balance de clientes:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener balance'
      });
    }
  },

  // 10. Estadísticas generales
  async getEstadisticas(req, res) {
    try {
      const totalClientes = await prisma.cliente.count();
      
      const clientesConPedidos = await prisma.cliente.count({
        where: {
          pedidos: {
            some: {
              fecha_delete: null
            }
          }
        }
      });
      
      // Calcular saldos pendientes
      const clientesConPedidosData = await prisma.cliente.findMany({
        where: {
          pedidos: {
            some: {
              fecha_delete: null
            }
          }
        },
        include: {
          pedidos: {
            where: {
              fecha_delete: null
            },
            include: {
              detalle_pedidos: true,
              detalle_pago: true
            }
          }
        }
      });
      
      let totalSaldoPendiente = 0;
      let clientesAlDia = 0;
      let clientesConMora = 0;
      
      clientesConPedidosData.forEach(cliente => {
        let totalFacturado = 0;
        let totalPagado = 0;
        
        cliente.pedidos.forEach(pedido => {
          pedido.detalle_pedidos.forEach(detalle => {
            totalFacturado += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
          });
          
          pedido.detalle_pago.forEach(detallePago => {
            totalPagado += decimalToNumber(detallePago.valor);
          });
        });
        
        const pendiente = totalFacturado - totalPagado;
        totalSaldoPendiente += pendiente;
        
        if (pendiente === 0) clientesAlDia++;
        if (pendiente > 0) clientesConMora++;
      });
      
      res.json({
        success: true,
        data: {
          totalClientes,
          totalConPedidos: clientesConPedidos,
          totalSaldoPendiente,
          clientesAlDia,
          clientesConMora
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

  // 11. NUEVO: CLIENTES CON TOTALES (CORREGIDO)
  async getClientesConTotales(req, res) {
    try {
      console.log('📊 Obteniendo clientes con totales...');
      
      const clientes = await prisma.cliente.findMany({
        include: {
          pedidos: {
            where: {
              fecha_delete: null
            },
            include: {
              detalle_pedidos: true
            }
          },
          tipo_cliente: true
        },
        orderBy: { nombre: 'asc' }
      });

      const resultado = clientes.map(cliente => {
        const totalPedidos = cliente.pedidos.length;
        const totalGastado = cliente.pedidos.reduce((sum, pedido) => {
          const totalPedido = pedido.detalle_pedidos.reduce((sub, detalle) => 
            sub + (decimalToNumber(detalle.precio_unitario) * detalle.cantidad), 0);
          return sum + totalPedido;
        }, 0);

        return {
          id: cliente.id,
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          celular: cliente.celular,
          email: cliente.email,
          tipo: cliente.tipo_cliente?.descripcion || 'Sin tipo',
          tipoId: cliente.id_tipo,
          administradorId: cliente.id_administrador,
          totalPedidos,
          totalGastado
        };
      });

      res.json({
        success: true,
        data: resultado
      });
    } catch (error) {
      console.error('❌ Error obteniendo clientes con totales:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener clientes con totales',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

module.exports = clienteController;