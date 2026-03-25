const prisma = require('./src/config/prisma');

async function test() {
  try {
    // Usando raw SQL para evitar el problema de Prisma
    const pedidos = await prisma.$queryRaw`
      SELECT * FROM pedidos 
      WHERE fecha_delete IS NULL 
        AND fecha_entrega IS NOT NULL 
      LIMIT 5
    `;
    console.log('✅ Éxito! Pedidos encontrados:', pedidos.length);
    if (pedidos.length > 0) {
      console.log('📦 Primer pedido:', pedidos[0]);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Detalles:', error);
  }
}

test();