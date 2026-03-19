const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Función auxiliar para convertir Decimal a Number
const decimalToNumber = (decimalValue) => {
  if (!decimalValue) return 0;
  return parseFloat(decimalValue.toString());
};

// Mapeo de strings de tipo a IDs (SOLO 2 TIPOS)
const TIPO_TO_ID = {
  'ODONTOLOGO': 1,
  'CLINICA_DENTAL': 2
};

const ID_TO_TIPO = {
  1: 'ODONTOLOGO',
  2: 'CLINICA_DENTAL'
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
      
      // Convertir tipo string a ID si viene como string
      if (tipo && tipo !== 'TODOS') {
        if (TIPO_TO_ID[tipo]) {
          whereClause.id_tipo = TIPO_TO_ID[tipo];
        } else {
          // Si ya es número, usarlo directamente
          whereClause.id_tipo = parseInt(tipo);
        }
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
          tipo_cliente: true
        }
      });
      
      // Convertir id_tipo a string de tipo para el frontend
      const clientesFormateados = clientes.map(cliente => ({
        ...cliente,
        tipo: cliente.tipo_cliente ? ID_TO_TIPO[cliente.id_tipo] : 'ODONTOLOGO',
        tipoLabel: cliente.tipo_cliente?.descripcion || 'Odontólogo'
      }));
      
      res.json({
        success: true,
        data: clientesFormateados
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
        tipo = 'ODONTOLOGO', // Valor por defecto
        id_administrador = 1
      } = req.body;
      
      if (!nombre) {
        return res.status(400).json({
          success: false,
          message: 'Nombre es requerido'
        });
      }
      
      // Convertir tipo string a ID
      let id_tipo = null;
      if (tipo && TIPO_TO_ID[tipo]) {
        id_tipo = TIPO_TO_ID[tipo];
      } else {
        id_tipo = 1; // Por defecto Odontólogo
      }
      
      console.log('📝 Creando cliente con:', {
        nombre,
        telefono,
        celular,
        email,
        tipo,
        id_tipo,
        id_administrador
      });
      
      const cliente = await prisma.cliente.create({
        data: {
          nombre,
          telefono: telefono || null,
          celular: celular || null,
          email: email || null,
          id_tipo: id_tipo,
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
      
      // Devolver con formato amigable para el frontend
      const clienteFormateado = {
        ...cliente,
        tipo: ID_TO_TIPO[cliente.id_tipo] || 'ODONTOLOGO',
        tipoLabel: cliente.tipo_cliente?.descripcion || 'Odontólogo'
      };
      
      res.status(201).json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: clienteFormateado
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
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      
      // Formatear para el frontend
      const clienteFormateado = {
        ...cliente,
        tipo: ID_TO_TIPO[cliente.id_tipo] || 'ODONTOLOGO',
        tipoLabel: cliente.tipo_cliente?.descripcion || 'Odontólogo'
      };
      
      res.json({
        success: true,
        data: clienteFormateado
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
      
      // Convertir tipo string a ID si viene
      if (updateData.tipo) {
        updateData.id_tipo = TIPO_TO_ID[updateData.tipo] || 1; // Por defecto Odontólogo
        delete updateData.tipo; // Eliminar el campo tipo original
      }
      
      console.log('📝 Actualizando cliente:', updateData);
      
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
      
      const clienteFormateado = {
        ...cliente,
        tipo: ID_TO_TIPO[cliente.id_tipo] || 'ODONTOLOGO',
        tipoLabel: cliente.tipo_cliente?.descripcion || 'Odontólogo'
      };
      
      res.json({
        success: true,
        message: 'Cliente actualizado exitosamente',
        data: clienteFormateado
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
      
      const clientesFormateados = clientes.map(cliente => ({
        ...cliente,
        tipo: ID_TO_TIPO[cliente.id_tipo] || 'ODONTOLOGO',
        tipoLabel: cliente.tipo_cliente?.descripcion || 'Odontólogo'
      }));
      
      res.json({
        success: true,
        data: clientesFormateados
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

  // 8. Estadísticas por tipo (SOLO 2 TIPOS)
  async getStatsByTipo(req, res) {
    try {
      // GroupBy por id_tipo
      const groupStats = await prisma.cliente.groupBy({
        by: ['id_tipo'],
        _count: {
          id: true
        }
      });

      // Formatear resultados usando el mapeo de IDs a strings
      const stats = groupStats.map(item => ({
        tipo: ID_TO_TIPO[item.id_tipo] || 'ODONTOLOGO',
        count: item._count.id
      }));

      // Agregar tipos que no tienen clientes
      const tiposExistentes = ['ODONTOLOGO', 'CLINICA_DENTAL'];
      tiposExistentes.forEach(tipoStr => {
        const existe = stats.find(s => s.tipo === tipoStr);
        if (!existe) {
          stats.push({
            tipo: tipoStr,
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
          tipo: ID_TO_TIPO[cliente.id_tipo] || 'ODONTOLOGO',
          tipoLabel: cliente.tipo_cliente?.descripcion || 'Odontólogo',
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

  // 11. CLIENTES CON TOTALES
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
          tipo: ID_TO_TIPO[cliente.id_tipo] || 'ODONTOLOGO',
          tipoId: cliente.id_tipo,
          tipoLabel: cliente.tipo_cliente?.descripcion || 'Odontólogo',
          administradorId: cliente.id_administrador,
          totalPedidos,
          totalGastado,
          createdAt: cliente.created_at,
          updatedAt: cliente.updated_at
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