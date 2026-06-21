const prisma = require('../config/prisma');

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

// ✅ MAPEO DE TIPOS PARA LA BASE DE DATOS
// La base de datos solo acepta: 'carga', 'uso', 'ajuste'
const MAP_TIPO_TO_DB = {
  'ABONO': 'carga',
  'DESCUENTO': 'uso',
  'carga': 'carga',
  'uso': 'uso',
  'ajuste': 'ajuste'
};

// ✅ MAPEO INVERSO PARA RESPUESTAS
const MAP_TIPO_FROM_DB = {
  'carga': 'ABONO',
  'uso': 'DESCUENTO',
  'ajuste': 'AJUSTE'
};

const clienteController = {
  // ========== FUNCIONES BÁSICAS ==========
  
  // 0. Obtener todos los clientes (SIN PARÁMETROS) - FILTRADO POR ADMIN
  async getClientes(req, res) {
    try {
      const clientes = await prisma.cliente.findMany({
        where: { 
          id_administrador: req.admin.id
        },
        include: {
          tipo_cliente: true
        },
        orderBy: { nombre: 'asc' }
      });
      
      const clientesFormateados = clientes.map(cliente => ({
        ...cliente,
        saldo_a_favor: decimalToNumber(cliente.saldo_a_favor),
        tipo: ID_TO_TIPO[cliente.id_tipo] || 'ODONTOLOGO',
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

  // 1. Obtener todos los clientes (con filtros) - FILTRADO POR ADMIN
  async getAllClientes(req, res) {
    try {
      const { tipo, withAdmin = false } = req.query;
      
      const whereClause = {
        id_administrador: req.admin.id
      };
      
      if (tipo && tipo !== 'TODOS') {
        if (TIPO_TO_ID[tipo]) {
          whereClause.id_tipo = TIPO_TO_ID[tipo];
        } else {
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
      
      const clientesFormateados = clientes.map(cliente => ({
        ...cliente,
        saldo_a_favor: decimalToNumber(cliente.saldo_a_favor),
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

  // 2. Crear cliente
  async createCliente(req, res) {
    try {
      const { 
        nombre, 
        telefono, 
        celular, 
        email,
        tipo,
      } = req.body;
      
      if (!nombre || !telefono || !email) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, teléfono y email son requeridos'
        });
      }
      
      let tipoId = 1;
      if (tipo === 'CLINICA_DENTAL') {
        tipoId = 2;
      }
      
      console.log('📝 Creando cliente para admin:', req.admin.id, req.admin.nombre);
      
      const cliente = await prisma.cliente.create({
        data: {
          nombre,
          telefono,
          celular: celular || null,
          email,
          saldo_a_favor: 0,
          tipo_cliente: {
            connect: { id: tipoId }
          },
          administrador: {
            connect: { id: req.admin.id }
          }
        }
      });
      
      res.status(201).json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: {
          ...cliente,
          saldo_a_favor: decimalToNumber(cliente.saldo_a_favor)
        }
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

  // 3. Obtener cliente por ID - VERIFICA QUE SEA DE ESTE ADMIN
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
      
      const cliente = await prisma.cliente.findFirst({
        where: { 
          id: parseInt(id),
          id_administrador: req.admin.id
        },
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
          } : false,
          movimiento_saldo: {
            orderBy: { fecha_insert: 'desc' },
            take: 10
          }
        }
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado o no tienes permisos para verlo'
        });
      }
      
      const clienteFormateado = {
        ...cliente,
        saldo_a_favor: decimalToNumber(cliente.saldo_a_favor),
        tipo: ID_TO_TIPO[cliente.id_tipo] || 'ODONTOLOGO',
        tipoLabel: cliente.tipo_cliente?.descripcion || 'Odontólogo',
        movimientos_saldo: cliente.movimiento_saldo?.map(m => ({
          ...m,
          monto: decimalToNumber(m.monto),
          saldo_anterior: decimalToNumber(m.saldo_anterior),
          saldo_posterior: decimalToNumber(m.saldo_posterior),
          tipo_original: MAP_TIPO_FROM_DB[m.tipo] || m.tipo // ✅ MAPEAR EL TIPO A SU ORIGINAL
        })) || []
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

  // 4. Actualizar cliente - VERIFICA QUE SEA DE ESTE ADMIN
  async updateCliente(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de cliente inválido'
        });
      }
      
      const clienteExistente = await prisma.cliente.findFirst({
        where: {
          id: parseInt(id),
          id_administrador: req.admin.id
        }
      });
      
      if (!clienteExistente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado o no tienes permisos para modificarlo'
        });
      }
      
      const updateData = { ...req.body };
      
      delete updateData.id_administrador;
      delete updateData.saldo_a_favor;
      
      if (updateData.tipo) {
        updateData.id_tipo = TIPO_TO_ID[updateData.tipo] || 1;
        delete updateData.tipo;
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
        saldo_a_favor: decimalToNumber(cliente.saldo_a_favor),
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

  // 5. Eliminar cliente - VERIFICA QUE SEA DE ESTE ADMIN
  async deleteCliente(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de cliente inválido'
        });
      }
      
      const clienteExistente = await prisma.cliente.findFirst({
        where: {
          id: parseInt(id),
          id_administrador: req.admin.id
        }
      });
      
      if (!clienteExistente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado o no tienes permisos para eliminarlo'
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

  // 6. Buscar clientes - FILTRADO POR ADMIN
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
          id_administrador: req.admin.id,
          OR: [
            { nombre: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
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
        saldo_a_favor: decimalToNumber(cliente.saldo_a_favor),
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
      const totalClientes = await prisma.cliente.count({
        where: { id_administrador: req.admin.id }
      });
      
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

  // 8. Estadísticas por tipo
  async getStatsByTipo(req, res) {
    try {
      const groupStats = await prisma.cliente.groupBy({
        by: ['id_tipo'],
        where: {
          id_administrador: req.admin.id
        },
        _count: {
          id: true
        }
      });

      const stats = groupStats.map(item => ({
        tipo: ID_TO_TIPO[item.id_tipo] || 'ODONTOLOGO',
        count: item._count.id
      }));

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
        where: {
          id_administrador: req.admin.id
        },
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
          saldo_a_favor: decimalToNumber(cliente.saldo_a_favor),
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
      const totalClientes = await prisma.cliente.count({
        where: { id_administrador: req.admin.id }
      });
      
      const clientesConPedidos = await prisma.cliente.count({
        where: { 
          id_administrador: req.admin.id,
          pedidos: {
            some: {
              fecha_delete: null
            }
          }
        }
      });
      
      const clientesConPedidosData = await prisma.cliente.findMany({
        where: {
          id_administrador: req.admin.id,
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
      let totalSaldoAFavor = 0;
      let clientesAlDia = 0;
      let clientesConMora = 0;
      
      clientesConPedidosData.forEach(cliente => {
        let totalFacturado = 0;
        let totalPagado = 0;
        const saldoAFavor = decimalToNumber(cliente.saldo_a_favor);
        
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
        totalSaldoAFavor += saldoAFavor;
        
        if (pendiente === 0) clientesAlDia++;
        if (pendiente > 0) clientesConMora++;
      });
      
      res.json({
        success: true,
        data: {
          totalClientes,
          totalConPedidos: clientesConPedidos,
          totalSaldoPendiente,
          totalSaldoAFavor,
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
      console.log('📊 Obteniendo clientes con totales para admin:', req.admin.id);
      
      const clientes = await prisma.cliente.findMany({
        where: {
          id_administrador: req.admin.id
        },
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
          saldo_a_favor: decimalToNumber(cliente.saldo_a_favor),
          tipo: ID_TO_TIPO[cliente.id_tipo] || 'ODONTOLOGO',
          id_tipo: cliente.id_tipo,
          tipoLabel: cliente.tipo_cliente?.descripcion || 'Odontólogo',
          id_administrador: cliente.id_administrador,
          totalPedidos,
          totalGastado,
          createdAt: cliente.createdAt,
          updatedAt: cliente.updatedAt
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
  },

  // ========== NUEVAS FUNCIONES PARA SALDO A FAVOR ==========

  // ✅ 12. Actualizar saldo del cliente - CORREGIDO
  async actualizarSaldoCliente(req, res) {
    try {
      // Obtener id_cliente de params o body
      const id_cliente = req.params.id ? parseInt(req.params.id) : req.body.id_cliente;
      const { monto, tipo, descripcion, id_pedido } = req.body;
      
      console.log('📥 Recibido:', { id_cliente, monto, tipo, descripcion, id_pedido });
      
      if (!id_cliente || isNaN(id_cliente)) {
        return res.status(400).json({
          success: false,
          message: 'ID de cliente inválido'
        });
      }
      
      if (!monto || !tipo) {
        return res.status(400).json({
          success: false,
          message: 'monto y tipo son requeridos'
        });
      }
      
      const montoNum = parseFloat(monto);
      if (isNaN(montoNum) || montoNum <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El monto debe ser un número positivo'
        });
      }
      
      // ✅ MAPEAR EL TIPO A LOS VALORES QUE ESPERA LA BASE DE DATOS
      // La base de datos solo acepta: 'carga', 'uso', 'ajuste'
      let tipoDB = '';
      let tipoOriginal = '';
      
      // Determinar el tipo original
      const tipoUpper = tipo.toUpperCase();
      if (tipoUpper === 'ABONO' || tipoUpper === 'CARGA') {
        tipoDB = 'carga';
        tipoOriginal = 'ABONO';
      } else if (tipoUpper === 'DESCUENTO' || tipoUpper === 'USO') {
        tipoDB = 'uso';
        tipoOriginal = 'DESCUENTO';
      } else if (tipoUpper === 'AJUSTE') {
        tipoDB = 'ajuste';
        tipoOriginal = 'AJUSTE';
      } else {
        // Si el tipo ya está en minúsculas (carga, uso, ajuste)
        const tipoLower = tipo.toLowerCase();
        if (['carga', 'uso', 'ajuste'].includes(tipoLower)) {
          tipoDB = tipoLower;
          tipoOriginal = MAP_TIPO_FROM_DB[tipoLower] || tipoLower;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Tipo inválido. Debe ser ABONO, DESCUENTO, carga, uso o ajuste'
          });
        }
      }
      
      // Obtener cliente actual
      const cliente = await prisma.cliente.findFirst({
        where: {
          id: id_cliente,
          id_administrador: req.admin.id
        }
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado o no tienes permisos'
        });
      }
      
      const saldoActual = decimalToNumber(cliente.saldo_a_favor);
      let nuevoSaldo;
      let mensajeMovimiento = '';
      
      // ✅ Lógica de negocio según el tipo original
      if (tipoOriginal === 'ABONO' || tipoDB === 'carga') {
        nuevoSaldo = saldoActual + montoNum;
        mensajeMovimiento = 'Abono';
      } else if (tipoOriginal === 'DESCUENTO' || tipoDB === 'uso') {
        nuevoSaldo = Math.max(0, saldoActual - montoNum);
        mensajeMovimiento = 'Descuento';
      } else {
        // Ajuste: puede ser sumar o restar según el caso
        nuevoSaldo = saldoActual + montoNum;
        mensajeMovimiento = 'Ajuste';
      }
      
      console.log(`💰 Saldo actual: $${saldoActual}, Nuevo saldo: $${nuevoSaldo}`);
      
      // Usar transacción para actualizar saldo y registrar movimiento
      const [clienteActualizado, movimiento] = await prisma.$transaction([
        prisma.cliente.update({
          where: { id: id_cliente },
          data: { saldo_a_favor: nuevoSaldo }
        }),
        prisma.movimiento_saldo.create({
          data: {
            id_cliente: id_cliente,
            tipo: tipoDB, // ✅ 'carga', 'uso' o 'ajuste' - lo que espera la BD
            monto: montoNum,
            saldo_anterior: saldoActual,
            saldo_posterior: nuevoSaldo,
            descripcion: descripcion || `${mensajeMovimiento} de saldo`,
            id_pedido: id_pedido || null,
            id_administrador: req.admin.id
          }
        })
      ]);
      
      res.json({
        success: true,
        message: `Saldo ${mensajeMovimiento.toLowerCase()} correctamente`,
        data: {
          saldo_anterior: saldoActual,
          saldo_nuevo: nuevoSaldo,
          movimiento: tipoOriginal,
          monto_aplicado: montoNum,
          cliente: {
            id: clienteActualizado.id,
            nombre: clienteActualizado.nombre,
            saldo_a_favor: decimalToNumber(clienteActualizado.saldo_a_favor)
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Error actualizando saldo:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar el saldo del cliente',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // 13. Obtener saldo actual del cliente
  async getSaldoCliente(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de cliente inválido'
        });
      }
      
      const cliente = await prisma.cliente.findFirst({
        where: {
          id: parseInt(id),
          id_administrador: req.admin.id
        },
        include: {
          movimiento_saldo: {
            orderBy: { fecha_insert: 'desc' },
            take: 10
          }
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
        data: {
          saldo_a_favor: decimalToNumber(cliente.saldo_a_favor),
          ultimos_movimientos: cliente.movimiento_saldo.map(m => ({
            ...m,
            monto: decimalToNumber(m.monto),
            saldo_anterior: decimalToNumber(m.saldo_anterior),
            saldo_posterior: decimalToNumber(m.saldo_posterior),
            tipo_original: MAP_TIPO_FROM_DB[m.tipo] || m.tipo // ✅ MAPEAR EL TIPO
          }))
        }
      });
    } catch (error) {
      console.error('Error obteniendo saldo:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener el saldo del cliente'
      });
    }
  },

  // 14. Obtener historial completo de movimientos de saldo
  async getHistorialSaldo(req, res) {
    try {
      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de cliente inválido'
        });
      }
      
      // Verificar que el cliente pertenece al admin
      const cliente = await prisma.cliente.findFirst({
        where: {
          id: parseInt(id),
          id_administrador: req.admin.id
        },
        select: { id: true, nombre: true }
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }
      
      const movimientos = await prisma.movimiento_saldo.findMany({
        where: { id_cliente: parseInt(id) },
        orderBy: { fecha_insert: 'desc' },
        skip: parseInt(offset),
        take: parseInt(limit),
        include: {
          administrador: {
            select: { id: true, nombre: true }
          },
          pedidos: {
            select: { id: true, fecha_pedido: true }
          }
        }
      });
      
      const total = await prisma.movimiento_saldo.count({
        where: { id_cliente: parseInt(id) }
      });
      
      res.json({
        success: true,
        data: {
          cliente: {
            id: cliente.id,
            nombre: cliente.nombre
          },
          movimientos: movimientos.map(m => ({
            ...m,
            monto: decimalToNumber(m.monto),
            saldo_anterior: decimalToNumber(m.saldo_anterior),
            saldo_posterior: decimalToNumber(m.saldo_posterior),
            tipo_original: MAP_TIPO_FROM_DB[m.tipo] || m.tipo // ✅ MAPEAR EL TIPO
          })),
          total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      console.error('Error obteniendo historial de saldo:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener el historial de saldo'
      });
    }
  }
};

module.exports = clienteController;