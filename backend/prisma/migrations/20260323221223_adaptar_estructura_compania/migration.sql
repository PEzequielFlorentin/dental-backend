-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('ODONTOLOGO', 'CLINICA_DENTAL', 'OTRO');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "administrador" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "usuario" VARCHAR(50) NOT NULL,
    "super_usuario" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT NOT NULL,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "two_factor_backup_codes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "refreshToken" TEXT,
    "resetPasswordToken" TEXT,
    "resetPasswordExpiry" TIMESTAMP(3),

    CONSTRAINT "administrador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_cliente" (
    "id" SERIAL NOT NULL,
    "descripcion" VARCHAR(50) NOT NULL,
    "fecha_insert" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "fecha_delete" TIMESTAMP(3),

    CONSTRAINT "tipo_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "id_administrador" INTEGER NOT NULL,
    "celular" VARCHAR(20),
    "id_tipo" INTEGER,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otro_gasto" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_administrador" INTEGER NOT NULL,

    CONSTRAINT "otro_gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(100) NOT NULL,
    "id_administrador" INTEGER NOT NULL,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "fecha_pedido" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_entrega" TIMESTAMP NOT NULL,
    "fecha_delete" TIMESTAMP,
    "id_administrador" INTEGER NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estado" (
    "id" SERIAL NOT NULL,
    "descripcion" VARCHAR(50) NOT NULL,
    "fecha_insert" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_delete" TIMESTAMP,

    CONSTRAINT "estado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalle_pedidos" (
    "id" SERIAL NOT NULL,
    "id_pedido" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "paciente" VARCHAR(100) NOT NULL,
    "id_estado" INTEGER NOT NULL,

    CONSTRAINT "detalle_pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago" (
    "id" SERIAL NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "id_administrador" INTEGER NOT NULL,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalle_pago" (
    "id" SERIAL NOT NULL,
    "id_pago" INTEGER NOT NULL,
    "id_pedido" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "fecha_pago" TIMESTAMP NOT NULL,

    CONSTRAINT "detalle_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" SERIAL NOT NULL,
    "usuario" VARCHAR(50) NOT NULL,
    "fecha_accion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accion" VARCHAR(100) NOT NULL,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "administrador_email_key" ON "administrador"("email");

-- CreateIndex
CREATE UNIQUE INDEX "administrador_usuario_key" ON "administrador"("usuario");

-- CreateIndex
CREATE INDEX "administrador_email_idx" ON "administrador"("email");

-- CreateIndex
CREATE INDEX "administrador_usuario_idx" ON "administrador"("usuario");

-- CreateIndex
CREATE INDEX "administrador_activo_idx" ON "administrador"("activo");

-- CreateIndex
CREATE INDEX "cliente_id_idx" ON "cliente"("id");

-- CreateIndex
CREATE INDEX "cliente_id_administrador_idx" ON "cliente"("id_administrador");

-- CreateIndex
CREATE INDEX "cliente_nombre_idx" ON "cliente"("nombre");

-- CreateIndex
CREATE INDEX "cliente_telefono_idx" ON "cliente"("telefono");

-- CreateIndex
CREATE INDEX "cliente_id_tipo_idx" ON "cliente"("id_tipo");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_email_key" ON "cliente"("email");

-- CreateIndex
CREATE INDEX "otro_gasto_id_idx" ON "otro_gasto"("id");

-- CreateIndex
CREATE INDEX "otro_gasto_tipo_idx" ON "otro_gasto"("tipo");

-- CreateIndex
CREATE INDEX "otro_gasto_fecha_idx" ON "otro_gasto"("fecha");

-- CreateIndex
CREATE INDEX "otro_gasto_id_administrador_idx" ON "otro_gasto"("id_administrador");

-- CreateIndex
CREATE INDEX "producto_id_idx" ON "producto"("id");

-- CreateIndex
CREATE INDEX "producto_id_administrador_idx" ON "producto"("id_administrador");

-- CreateIndex
CREATE INDEX "producto_tipo_idx" ON "producto"("tipo");

-- CreateIndex
CREATE INDEX "pedidos_id_idx" ON "pedidos"("id");

-- CreateIndex
CREATE INDEX "pedidos_id_cliente_idx" ON "pedidos"("id_cliente");

-- CreateIndex
CREATE INDEX "pedidos_id_administrador_idx" ON "pedidos"("id_administrador");

-- CreateIndex
CREATE INDEX "pedidos_fecha_pedido_idx" ON "pedidos"("fecha_pedido");

-- CreateIndex
CREATE INDEX "pedidos_fecha_entrega_idx" ON "pedidos"("fecha_entrega");

-- CreateIndex
CREATE INDEX "pedidos_fecha_delete_idx" ON "pedidos"("fecha_delete");

-- CreateIndex
CREATE INDEX "estado_id_idx" ON "estado"("id");

-- CreateIndex
CREATE INDEX "estado_fecha_delete_idx" ON "estado"("fecha_delete");

-- CreateIndex
CREATE UNIQUE INDEX "estado_descripcion_key" ON "estado"("descripcion");

-- CreateIndex
CREATE INDEX "detalle_pedidos_id_idx" ON "detalle_pedidos"("id");

-- CreateIndex
CREATE INDEX "detalle_pedidos_id_pedido_idx" ON "detalle_pedidos"("id_pedido");

-- CreateIndex
CREATE INDEX "detalle_pedidos_id_producto_idx" ON "detalle_pedidos"("id_producto");

-- CreateIndex
CREATE INDEX "detalle_pedidos_id_estado_idx" ON "detalle_pedidos"("id_estado");

-- CreateIndex
CREATE INDEX "pago_id_idx" ON "pago"("id");

-- CreateIndex
CREATE INDEX "pago_id_administrador_idx" ON "pago"("id_administrador");

-- CreateIndex
CREATE INDEX "detalle_pago_id_idx" ON "detalle_pago"("id");

-- CreateIndex
CREATE INDEX "detalle_pago_id_pago_idx" ON "detalle_pago"("id_pago");

-- CreateIndex
CREATE INDEX "detalle_pago_id_pedido_idx" ON "detalle_pago"("id_pedido");

-- CreateIndex
CREATE INDEX "detalle_pago_fecha_pago_idx" ON "detalle_pago"("fecha_pago");

-- CreateIndex
CREATE INDEX "auditoria_fecha_accion_idx" ON "auditoria"("fecha_accion");

-- CreateIndex
CREATE INDEX "auditoria_usuario_idx" ON "auditoria"("usuario");

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_id_administrador_fkey" FOREIGN KEY ("id_administrador") REFERENCES "administrador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_id_tipo_fkey" FOREIGN KEY ("id_tipo") REFERENCES "tipo_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otro_gasto" ADD CONSTRAINT "otro_gasto_id_administrador_fkey" FOREIGN KEY ("id_administrador") REFERENCES "administrador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_id_administrador_fkey" FOREIGN KEY ("id_administrador") REFERENCES "administrador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_id_administrador_fkey" FOREIGN KEY ("id_administrador") REFERENCES "administrador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_pedidos" ADD CONSTRAINT "detalle_pedidos_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_pedidos" ADD CONSTRAINT "detalle_pedidos_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_pedidos" ADD CONSTRAINT "detalle_pedidos_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_id_administrador_fkey" FOREIGN KEY ("id_administrador") REFERENCES "administrador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_pago" ADD CONSTRAINT "detalle_pago_id_pago_fkey" FOREIGN KEY ("id_pago") REFERENCES "pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_pago" ADD CONSTRAINT "detalle_pago_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
