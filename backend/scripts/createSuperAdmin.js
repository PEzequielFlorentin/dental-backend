const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    console.log('🔍 Verificando si ya existe un super admin...');

    // Verificar si ya existe un admin con ese email o usuario
    const existingAdmin = await prisma.administrador.findFirst({
      where: {
        OR: [
          { email: 'admin@dental.com' },
          { usuario: 'superadmin' }
        ]
      }
    });

    if (existingAdmin) {
      console.log('⚠️ Ya existe un super admin:');
      console.log('   ID:', existingAdmin.id);
      console.log('   Nombre:', existingAdmin.nombre);
      console.log('   Email:', existingAdmin.email);
      console.log('   Usuario:', existingAdmin.usuario);
      console.log('   Rol:', existingAdmin.rol);
      
      // Actualizar contraseña por si acaso
      const password = await bcrypt.hash('Admin123!', 10);
      await prisma.administrador.update({
        where: { id: existingAdmin.id },
        data: { password: password }
      });
      
      console.log('✅ Contraseña actualizada a: Admin123!');
      console.log('');
      console.log('🔐 Puedes hacer login con:');
      console.log('   Email: admin@dental.com');
      console.log('   Contraseña: Admin123!');
      return;
    }

    // Si no existe, crear uno nuevo
    console.log('🆕 Creando nuevo super admin...');
    
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    
    const newAdmin = await prisma.administrador.create({
      data: {
        nombre: 'Super Administrador',
        email: 'admin@dental.com',
        usuario: 'superadmin',
        password: hashedPassword,
        rol: 'SUPER_ADMIN',
        super_usuario: true
      }
    });

    console.log('✅ Super admin creado exitosamente:');
    console.log('   ID:', newAdmin.id);
    console.log('   Nombre:', newAdmin.nombre);
    console.log('   Email:', newAdmin.email);
    console.log('   Usuario:', newAdmin.usuario);
    console.log('   Rol:', newAdmin.rol);
    console.log('   Contraseña: Admin123!');
    console.log('');
    console.log('⚠️  IMPORTANTE: Cambia esta contraseña después del primer ingreso');
    console.log('🔐 Puedes hacer login con:');
    console.log('   Email: admin@dental.com');
    console.log('   Contraseña: Admin123!');

  } catch (error) {
    console.error('❌ Error al crear super admin:');
    console.error('   Mensaje:', error.message);
    
    if (error.code === 'P2002') {
      console.log('📝 Sugerencia: Ya existe un registro con ese email o usuario');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la función
createSuperAdmin();