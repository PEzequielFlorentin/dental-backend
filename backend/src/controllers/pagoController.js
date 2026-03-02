const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Función auxiliar para convertir Decimal a Number
const decimalToNumber = (decimalValue) => {
  if (!decimalValue) return 0;
  return parseFloat(decimalValue.toString());
};

const pagoController = {
  // ========== REGISTRAR NUEVO PAGO (Nuevo schema) ==========
  async registrarPago(req, res) {
    try {
      const { 
        id_pedido, 
        valor, 
        id_administrador, 
        fecha_pago = new Date(),
        referencia,
        descripcion 
      } = req.body;
      
      console.log('💰 Registrando pago:', { id_pedido, valor });
      
      // Validaciones básicas
      const valorNumber = parseFloat(valor);
      if (!valor || valorNumber <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El valor debe ser mayor a 0'
        });
      }
      
      if (!id_pedido) {
        return res.status(400).json({
          success: false,
          message: 'Debe especificar el pedido (id_pedido)'
        });
      }
      
      // Verificar que el pedido existe
      const pedido = await prisma.pedidos.findUnique({
        where: { id: parseInt(id_pedido) },
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true
            }
          },
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
      });
      
      if (!pedido || pedido.fecha_delete) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o eliminado'
        });
      }
      
      // Calcular total del pedido y total pagado
      let totalPedido = 0;
      pedido.detalle_pedidos.forEach(detalle => {
        totalPedido += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
      });
      
      let totalPagadoAnterior = 0;
      pedido.detalle_pago.forEach(detallePago => {
        totalPagadoAnterior += decimalToNumber(detallePago.valor);
      });
      
      // Verificar que el monto no exceda el saldo pendiente
      const saldoPendiente = totalPedido - totalPagadoAnterior;
      if (valorNumber > saldoPendiente) {
        return res.status(400).json({
          success: false,
          message: `El valor excede el saldo pendiente del pedido ($${saldoPendiente.toFixed(2)})`
        });
      }
      
      // Crear pago con transacción
      const resultado = await prisma.$transaction(async (tx) => {
        // 1. Crear pago principal en tabla "pago"
        const pago = await tx.pago.create({
          data: {
            valor: valorNumber,
            id_administrador: id_administrador ? parseInt(id_administrador) : null
          }
        });
        
        console.log('✅ Pago principal creado ID:', pago.id);
        
        // 2. Crear detalle en tabla "detalle_pago"
        const detallePago = await tx.detalle_pago.create({
          data: {
            id_pago: pago.id,
            id_pedido: parseInt(id_pedido),
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
        
        console.log('✅ Detalle de pago creado');
        
        return {
          pago,
          detallePago
        };
      });
      
      // Obtener el pedido actualizado con el nuevo pago
      const pedidoActualizado = await prisma.pedidos.findUnique({
        where: { id: parseInt(id_pedido) },
        include: {
          cliente: true,
          detalle_pago: {
            include: {
              pago: true
            }
          },
          detalle_pedidos: {
            include: {
              producto: true
            }
          }
        }
      });
      
      // Calcular nuevo balance
      let nuevoTotalPedido = 0;
      pedidoActualizado.detalle_pedidos.forEach(detalle => {
        nuevoTotalPedido += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
      });
      
      let nuevoTotalPagado = 0;
      pedidoActualizado.detalle_pago.forEach(detallePago => {
        nuevoTotalPagado += decimalToNumber(detallePago.valor);
      });
      
      const nuevoSaldoPendiente = nuevoTotalPedido - nuevoTotalPagado;
      
      res.status(201).json({
        success: true,
        message: 'Pago registrado exitosamente',
        data: {
          pago: resultado.pago,
          detallePago: resultado.detallePago,
          pedido: {
            id: pedidoActualizado.id,
            cliente: pedidoActualizado.cliente,
            total: nuevoTotalPedido,
            totalPagado: nuevoTotalPagado,
            saldoPendiente: nuevoSaldoPendiente,
            porcentajePagado: nuevoTotalPedido > 0 ? ((nuevoTotalPagado / nuevoTotalPedido) * 100).toFixed(2) : '0.00'
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Error registrando pago:', error.message);
      console.error('❌ Código:', error.code);
      
      // Errores específicos
      if (error.code === 'P2003') {
        return res.status(404).json({
          success: false,
          message: 'Pedido o administrador no encontrado'
        });
      }
      
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Registro no encontrado'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Error al registrar pago',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // ========== OBTENER PAGOS POR CLIENTE (Nuevo schema) ==========
  async getPagosByCliente(req, res) {
    try {
      const { clienteId } = req.params;
      const { page = 1, limit = 20, fechaInicio, fechaFin } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Construir where para pedidos del cliente
      const wherePedidos = { 
        id_cliente: parseInt(clienteId),
        fecha_delete: null
      };
      
      // Obtener pedidos del cliente
      const pedidos = await prisma.pedidos.findMany({
        where: wherePedidos,
        select: {
          id: true
        }
      });
      
      if (pedidos.length === 0) {
        return res.json({
          success: true,
          data: [],
          totalMonto: 0,
          pagination: {
            page: 1,
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }
      
      const pedidoIds = pedidos.map(p => p.id);
      
      // Construir where para detalle_pago
      let whereDetallePago = {
        id_pedido: { in: pedidoIds }
      };
      
      // Filtrar por fecha si se especifica
      if (fechaInicio || fechaFin) {
        whereDetallePago.fecha_pago = {};
        if (fechaInicio) whereDetallePago.fecha_pago.gte = new Date(fechaInicio);
        if (fechaFin) whereDetallePago.fecha_pago.lte = new Date(fechaFin);
      }
      
      // Obtener detalles de pago
      const [detallesPago, total] = await Promise.all([
        prisma.detalle_pago.findMany({
          where: whereDetallePago,
          skip,
          take: parseInt(limit),
          orderBy: { fecha_pago: 'desc' },
          include: {
            pago: true,
            pedido: {
              include: {
                cliente: true,
                detalle_pedidos: {
                  include: {
                    producto: true
                  }
                }
              }
            }
          }
        }),
        prisma.detalle_pago.count({ where: whereDetallePago })
      ]);
      
      // Calcular totales y formatear respuesta
      const totalMonto = detallesPago.reduce((sum, detalle) => sum + decimalToNumber(detalle.valor), 0);
      
      const pagosFormateados = detallesPago.map(detalle => {
        // Calcular total del pedido relacionado
        let totalPedido = 0;
        detalle.pedido.detalle_pedidos.forEach(dp => {
          totalPedido += decimalToNumber(dp.precio_unitario) * dp.cantidad;
        });
        
        // Calcular total pagado del pedido
        let totalPagadoPedido = decimalToNumber(detalle.valor);
        
        return {
          id: detalle.id,
          monto: decimalToNumber(detalle.valor),
          fecha: detalle.fecha_pago,
          pagoId: detalle.id_pago,
          pago: detalle.pago,
          pedido: {
            id: detalle.pedido.id,
            cliente: detalle.pedido.cliente,
            totalPedido: totalPedido,
            totalPagado: totalPagadoPedido,
            saldoPendiente: totalPedido - totalPagadoPedido,
            detalles: detalle.pedido.detalle_pedidos.map(dp => ({
              producto: dp.producto,
              cantidad: dp.cantidad,
              precioUnitario: decimalToNumber(dp.precio_unitario),
              paciente: dp.paciente
            }))
          }
        };
      });
      
      res.json({
        success: true,
        data: pagosFormateados,
        totalMonto: totalMonto.toFixed(2),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
      
    } catch (error) {
      console.error('Error obteniendo pagos por cliente:', error.message);
      res.status(500).json({
        success: false,
        error: 'Error al obtener pagos'
      });
    }
  },

  // ========== OBTENER PAGOS POR PEDIDO (Nuevo schema) ==========
  async getPagosByPedido(req, res) {
    try {
      const { pedidoId } = req.params;
      
      // Obtener pedido con detalles y pagos
      const pedido = await prisma.pedidos.findUnique({
        where: { id: parseInt(pedidoId) },
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
            },
            orderBy: { fecha_pago: 'desc' }
          },
          cliente: true
        }
      });
      
      if (!pedido || pedido.fecha_delete) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }
      
      // Calcular total del pedido
      const totalPedido = pedido.detalle_pedidos.reduce((sum, detalle) => {
        return sum + (decimalToNumber(detalle.precio_unitario) * detalle.cantidad);
      }, 0);
      
      // Calcular total pagado
      const totalPagado = pedido.detalle_pago.reduce((sum, detallePago) => {
        return sum + decimalToNumber(detallePago.valor);
      }, 0);
      
      // Formatear pagos
      const pagosFormateados = pedido.detalle_pago.map(detallePago => ({
        id: detallePago.id,
        pagoId: detallePago.id_pago,
        valor: decimalToNumber(detallePago.valor),
        fecha: detallePago.fecha_pago,
        pago: detallePago.pago
      }));
      
      res.json({
        success: true,
        data: pagosFormateados,
        resumen: {
          pedidoId: pedido.id,
          cliente: pedido.cliente,
          totalPedido: totalPedido.toFixed(2),
          totalPagado: totalPagado.toFixed(2),
          saldoPendiente: (totalPedido - totalPagado).toFixed(2),
          cantidadPagos: pagosFormateados.length,
          porcentajePagado: totalPedido > 0 ? ((totalPagado / totalPedido) * 100).toFixed(2) : '0.00',
          detallesPedido: pedido.detalle_pedidos.map(d => ({
            producto: d.producto,
            cantidad: d.cantidad,
            precioUnitario: decimalToNumber(d.precio_unitario),
            total: decimalToNumber(d.precio_unitario) * d.cantidad,
            paciente: d.paciente,
            estado: d.estado
          }))
        }
      });
      
    } catch (error) {
      console.error('Error obteniendo pagos por pedido:', error.message);
      res.status(500).json({
        success: false,
        error: 'Error al obtener pagos del pedido'
      });
    }
  },

  // ========== ELIMINAR PAGO (Nuevo schema) ==========
  async eliminarPago(req, res) {
    try {
      const { id } = req.params; // ID del detalle_pago
      
      console.log('🗑️ Eliminando detalle de pago ID:', id);
      
      // 1. Obtener detalle_pago con datos relacionados
      const detallePago = await prisma.detalle_pago.findUnique({
        where: { id: parseInt(id) },
        include: {
          pago: true,
          pedido: {
            include: {
              cliente: true
            }
          }
        }
      });
      
      if (!detallePago) {
        return res.status(404).json({
          success: false,
          message: 'Pago no encontrado'
        });
      }
      
      const valorPago = decimalToNumber(detallePago.valor);
      
      // Usar transacción para mantener consistencia
      await prisma.$transaction(async (tx) => {
        // 1. Eliminar detalle_pago
        await tx.detalle_pago.delete({
          where: { id: parseInt(id) }
        });
        
        console.log('✅ Detalle de pago eliminado');
        
        // 2. Verificar si el pago principal tiene más detalles
        const otrosDetalles = await tx.detalle_pago.findMany({
          where: {
            id_pago: detallePago.id_pago,
            id: { not: parseInt(id) }
          }
        });
        
        // 3. Si no hay más detalles, eliminar el pago principal
        if (otrosDetalles.length === 0) {
          await tx.pago.delete({
            where: { id: detallePago.id_pago }
          });
          console.log('✅ Pago principal eliminado (no tenía más detalles)');
        } else {
          // 4. Si hay más detalles, actualizar el valor total del pago
          const nuevoValorPago = otrosDetalles.reduce((sum, detalle) => 
            sum + decimalToNumber(detalle.valor), 0
          );
          
          await tx.pago.update({
            where: { id: detallePago.id_pago },
            data: { valor: nuevoValorPago }
          });
          
          console.log('✅ Pago principal actualizado, nuevo valor:', nuevoValorPago);
        }
      });
      
      console.log('✅ Pago eliminado exitosamente');
      
      res.json({
        success: true,
        message: 'Pago eliminado exitosamente'
      });
      
    } catch (error) {
      console.error('❌ Error eliminando pago:', error.message);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar pago',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // ========== BALANCE GENERAL (PARA PANTALLA PRINCIPAL) - Nuevo schema ==========
  async getBalanceGeneral(req, res) {
    try {
      const { id_administrador, orderBy = 'nombre', estado = 'todos' } = req.query;
      
      console.log('💰 Generando balance general (nuevo schema)');
      
      // Construir filtros para clientes
      const whereCliente = {};
      if (id_administrador) {
        whereCliente.id_administrador = parseInt(id_administrador);
      }
      
      // Obtener todos los clientes
      const clientes = await prisma.cliente.findMany({
        where: whereCliente,
        orderBy: { [orderBy]: 'asc' },
        include: {
          administrador: true,
          pedidos: {
            where: {
              fecha_delete: null
            },
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
            }
          }
        }
      });
      
      // Formatear clientes con balance
      const clientesConBalance = clientes.map(cliente => {
        let totalFacturado = 0;
        let totalPagado = 0;
        
        // Calcular totales de todos los pedidos del cliente
        cliente.pedidos.forEach(pedido => {
          // Facturación por detalle_pedidos
          pedido.detalle_pedidos.forEach(detalle => {
            totalFacturado += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
          });
          
          // Pagos por detalle_pago
          pedido.detalle_pago.forEach(detallePago => {
            totalPagado += decimalToNumber(detallePago.valor);
          });
        });
        
        const pendiente = totalFacturado - totalPagado;
        
        // Determinar estado financiero
        let estadoFinanciero = 'al_dia';
        if (pendiente > 0) {
          if (pendiente === totalFacturado) {
            estadoFinanciero = 'impago';
          } else {
            estadoFinanciero = 'parcial';
          }
        }
        
        // Calcular porcentaje pagado
        const porcentajePagado = totalFacturado > 0 ? ((totalPagado / totalFacturado) * 100).toFixed(1) : '0.0';
        
        // Obtener pedidos pendientes
        const pedidosPendientes = cliente.pedidos.flatMap(pedido => {
          let totalPedido = 0;
          pedido.detalle_pedidos.forEach(detalle => {
            totalPedido += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
          });
          
          let totalPagadoPedido = 0;
          pedido.detalle_pago.forEach(detallePago => {
            totalPagadoPedido += decimalToNumber(detallePago.valor);
          });
          
          if (totalPagadoPedido < totalPedido) {
            return [{
              id: pedido.id,
              paciente: pedido.detalle_pedidos[0]?.paciente || 'Sin paciente',
              trabajo: pedido.detalle_pedidos.map(d => d.producto?.tipo).join(', ') || 'Sin trabajo',
              total: totalPedido,
              estado: pedido.detalle_pedidos[0]?.estado?.descripcion || 'pendiente',
              fechaEntrega: pedido.fecha_entrega
            }];
          }
          return [];
        });
        
        return {
          id: cliente.id,
          nombreCompleto: cliente.nombre,
          tipo: 'cliente', // En el nuevo schema no hay tipo odontologo/clinica
          contacto: {
            telefono: cliente.telefono,
            email: cliente.email,
            celular: cliente.celular
          },
          administrador: cliente.administrador,
          finanzas: {
            total: totalFacturado,
            pagado: totalPagado,
            pendiente: pendiente,
            porcentajePagado,
            estado: estadoFinanciero
          },
          pedidosPendientes: {
            total: pedidosPendientes.length,
            lista: pedidosPendientes.slice(0, 3) // Mostrar solo primeros 3
          }
        };
      });
      
      // Filtrar por estado si es necesario
      let clientesFiltrados = clientesConBalance;
      if (estado !== 'todos') {
        clientesFiltrados = clientesConBalance.filter(cliente => 
          cliente.finanzas.estado === estado
        );
      }
      
      // Calcular totales generales
      const totales = clientesFiltrados.reduce(
        (acc, cliente) => {
          acc.totalGeneral += cliente.finanzas.total;
          acc.totalPagado += cliente.finanzas.pagado;
          acc.totalPendiente += cliente.finanzas.pendiente;
          acc.totalClientes += 1;
          return acc;
        },
        { totalGeneral: 0, totalPagado: 0, totalPendiente: 0, totalClientes: 0 }
      );
      
      // Estadísticas
      const estadisticas = {
        clientesConDeuda: clientesFiltrados.filter(c => c.finanzas.pendiente > 0).length,
        clientesAlDia: clientesFiltrados.filter(c => c.finanzas.pendiente === 0).length,
        promedioDeuda: totales.totalPendiente / (clientesFiltrados.length || 1)
      };
      
      // Buscar mayor deudor
      const clientesConDeuda = clientesFiltrados.filter(c => c.finanzas.pendiente > 0);
      if (clientesConDeuda.length > 0) {
        clientesConDeuda.sort((a, b) => b.finanzas.pendiente - a.finanzas.pendiente);
        estadisticas.mayorDeudor = {
          nombre: clientesConDeuda[0].nombreCompleto,
          deuda: clientesConDeuda[0].finanzas.pendiente
        };
      }
      
      console.log('✅ Balance generado (nuevo schema):', {
        totalClientes: totales.totalClientes,
        totalPendiente: totales.totalPendiente
      });
      
      res.json({
        success: true,
        data: {
          clientes: clientesFiltrados,
          totales,
          estadisticas,
          fechaGeneracion: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo balance general:', error.message);
      console.error('❌ Stack:', error.stack);
      
      res.status(500).json({
        success: false,
        error: 'Error al obtener balance general',
        details: error.message
      });
    }
  },

  // ========== BALANCE DETALLADO POR CLIENTE (Nuevo schema) ==========
  async getBalanceCliente(req, res) {
    try {
      const { clienteId } = req.params;
      
      console.log('📊 Obteniendo balance para cliente ID:', clienteId);
      
      // Obtener cliente con todos sus datos
      const cliente = await prisma.cliente.findUnique({
        where: { id: parseInt(clienteId) },
        include: {
          administrador: true,
          pedidos: {
            where: {
              fecha_delete: null
            },
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
          }
        }
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }
      
      // Calcular estadísticas
      let totalFacturado = 0;
      let totalPagado = 0;
      
      cliente.pedidos.forEach(pedido => {
        // Facturación por detalle_pedidos
        pedido.detalle_pedidos.forEach(detalle => {
          totalFacturado += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
        });
        
        // Pagos por detalle_pago
        pedido.detalle_pago.forEach(detallePago => {
          totalPagado += decimalToNumber(detallePago.valor);
        });
      });
      
      const totalPendiente = totalFacturado - totalPagado;
      
      // Pagos por método (agrupados de detalle_pago)
      const pagosPorMetodo = {};
      cliente.pedidos.forEach(pedido => {
        pedido.detalle_pago.forEach(detallePago => {
          // En el nuevo schema no hay método en pago, podemos usar referencia o dejar genérico
          const metodo = 'pago';
          pagosPorMetodo[metodo] = (pagosPorMetodo[metodo] || 0) + decimalToNumber(detallePago.valor);
        });
      });
      
      // Últimos pagos formateados
      const ultimosPagos = [];
      cliente.pedidos.forEach(pedido => {
        pedido.detalle_pago.forEach(detallePago => {
          ultimosPagos.push({
            id: detallePago.id,
            fecha: detallePago.fecha_pago,
            monto: decimalToNumber(detallePago.valor),
            metodoPago: 'pago', // Genérico en nuevo schema
            pagoId: detallePago.id_pago,
            pedido: {
              id: pedido.id
            }
          });
        });
      });
      
      // Ordenar por fecha y tomar los últimos 10
      ultimosPagos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      const ultimosPagosLimitados = ultimosPagos.slice(0, 10);
      
      // Últimos pedidos formateados
      const ultimosPedidos = cliente.pedidos.slice(0, 10).map(pedido => {
        let totalPedido = 0;
        let totalPagadoPedido = 0;
        
        pedido.detalle_pedidos.forEach(detalle => {
          totalPedido += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
        });
        
        pedido.detalle_pago.forEach(detallePago => {
          totalPagadoPedido += decimalToNumber(detallePago.valor);
        });
        
        const estadoGeneral = pedido.detalle_pedidos.length > 0 
          ? pedido.detalle_pedidos[0]?.estado?.descripcion || 'pendiente'
          : 'pendiente';
          
        return {
          id: pedido.id,
          paciente: pedido.detalle_pedidos[0]?.paciente || 'Sin paciente',
          trabajos: pedido.detalle_pedidos.map(d => d.producto?.tipo).join(', ') || 'Sin trabajo',
          total: totalPedido,
          estado: estadoGeneral,
          pagado: totalPagadoPedido >= totalPedido,
          totalPagado: totalPagadoPedido,
          fecha_pedido: pedido.fecha_pedido,
          fecha_entrega: pedido.fecha_entrega
        };
      });
      
      console.log('✅ Balance cliente generado:', {
        cliente: cliente.nombre,
        totalPedidos: cliente.pedidos.length
      });
      
      res.json({
        success: true,
        data: {
          cliente: {
            id: cliente.id,
            nombreCompleto: cliente.nombre,
            administrador: cliente.administrador,
            contacto: {
              telefono: cliente.telefono,
              celular: cliente.celular,
              email: cliente.email
            }
          },
          resumen: {
            totalPedidos: cliente.pedidos.length,
            totalFacturado,
            totalPagado,
            totalPendiente,
            porcentajePagado: totalFacturado > 0 ? ((totalPagado / totalFacturado) * 100).toFixed(2) : '0.00',
            pagosPorMetodo
          },
          ultimosPagos: ultimosPagosLimitados,
          ultimosPedidos
        }
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo balance cliente:', error.message);
      res.status(500).json({
        success: false,
        error: 'Error al obtener balance del cliente'
      });
    }
  },

  // ========== RESUMEN FINANCIERO (Nuevo schema) ==========
  async getResumenFinanciero(req, res) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      // Si no se especifican fechas, usar el último mes
      let inicio, fin;
      if (fechaInicio && fechaFin) {
        inicio = new Date(fechaInicio);
        fin = new Date(fechaFin);
      } else {
        const hoy = new Date();
        fin = new Date();
        inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate());
      }
      
      console.log('📈 Generando resumen financiero (nuevo schema):', { inicio, fin });
      
      // Obtener detalles de pago del período
      const detallesPago = await prisma.detalle_pago.findMany({
        where: {
          fecha_pago: {
            gte: inicio,
            lte: fin
          }
        },
        include: {
          pago: true,
          pedido: {
            include: {
              cliente: true,
              detalle_pedidos: {
                include: {
                  producto: true
                }
              }
            }
          }
        },
        orderBy: { fecha_pago: 'desc' }
      });
      
      // Obtener pedidos del período
      const pedidos = await prisma.pedidos.findMany({
        where: {
          fecha_pedido: {
            gte: inicio,
            lte: fin
          },
          fecha_delete: null
        },
        include: {
          cliente: true,
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
      });
      
      // Calcular totales
      const totalRecaudado = detallesPago.reduce((sum, detalle) => 
        sum + decimalToNumber(detalle.valor), 0
      );
      
      const totalFacturado = pedidos.reduce((sum, pedido) => {
        const totalPedido = pedido.detalle_pedidos.reduce((sumDet, detalle) => 
          sumDet + (decimalToNumber(detalle.precio_unitario) * detalle.cantidad), 0
        );
        return sum + totalPedido;
      }, 0);
      
      // Agrupar por día para gráfico
      const pagosPorDia = {};
      detallesPago.forEach(detalle => {
        const fecha = detalle.fecha_pago.toISOString().split('T')[0];
        pagosPorDia[fecha] = (pagosPorDia[fecha] || 0) + decimalToNumber(detalle.valor);
      });
      
      // Top 10 clientes que más pagaron
      const pagosPorCliente = {};
      detallesPago.forEach(detalle => {
        const clienteId = detalle.pedido.cliente.id;
        if (!pagosPorCliente[clienteId]) {
          pagosPorCliente[clienteId] = {
            id: clienteId,
            nombre: detalle.pedido.cliente.nombre,
            total: 0
          };
        }
        pagosPorCliente[clienteId].total += decimalToNumber(detalle.valor);
      });
      
      const topClientes = Object.values(pagosPorCliente)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
      
      // Pedidos completados vs pendientes
      const pedidosCompletados = pedidos.filter(pedido => {
        let totalPedido = 0;
        let totalPagado = 0;
        
        pedido.detalle_pedidos.forEach(detalle => {
          totalPedido += decimalToNumber(detalle.precio_unitario) * detalle.cantidad;
        });
        
        pedido.detalle_pago.forEach(detallePago => {
          totalPagado += decimalToNumber(detallePago.valor);
        });
        
        return totalPagado >= totalPedido;
      });
      
      console.log('✅ Resumen financiero generado:', {
        totalRecaudado,
        totalPagos: detallesPago.length
      });
      
      res.json({
        success: true,
        data: {
          periodo: {
            inicio: inicio.toISOString(),
            fin: fin.toISOString(),
            dias: Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24))
          },
          ingresos: {
            totalRecaudado,
            totalFacturado,
            diferencia: totalFacturado - totalRecaudado,
            promedioDiario: totalRecaudado / (Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) || 1)
          },
          volumen: {
            totalPagos: detallesPago.length,
            totalPedidos: pedidos.length,
            pedidosCompletados: pedidosCompletados.length,
            pedidosPendientes: pedidos.length - pedidosCompletados.length
          },
          distribucion: {
            topClientes,
            pagosPorDia: Object.entries(pagosPorDia).map(([fecha, monto]) => ({ fecha, monto }))
          },
          detalles: {
            pagosRecientes: detallesPago.slice(0, 10).map(d => ({
              id: d.id,
              fecha: d.fecha_pago,
              monto: decimalToNumber(d.valor),
              cliente: d.pedido.cliente.nombre,
              pagoId: d.id_pago
            })),
            pedidosRecientes: pedidos.slice(0, 10).map(p => {
              const totalPedido = p.detalle_pedidos.reduce((sum, detalle) => 
                sum + (decimalToNumber(detalle.precio_unitario) * detalle.cantidad), 0
              );
              
              const totalPagado = p.detalle_pago.reduce((sum, detallePago) => 
                sum + decimalToNumber(detallePago.valor), 0
              );
              
              return {
                id: p.id,
                fecha: p.fecha_pedido,
                total: totalPedido,
                pagado: totalPagado,
                cliente: p.cliente.nombre,
                trabajos: p.detalle_pedidos.map(d => d.producto?.tipo).join(', ')
              };
            })
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo resumen financiero:', error.message);
      res.status(500).json({
        success: false,
        error: 'Error al obtener resumen financiero'
      });
    }
  }
};

module.exports = pagoController;