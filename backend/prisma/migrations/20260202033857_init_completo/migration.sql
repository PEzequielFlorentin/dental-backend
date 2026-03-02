/*
  Warnings:

  - You are about to drop the column `cantidad` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `clienteId` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `descripcion` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `estado` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `fechaEntrega` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `fechaPedido` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `observaciones` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `paciente` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `pagado` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `precioTotal` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `precioUnitario` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `tipoTrabajo` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `pedidos` table. All the data in the column will be lost.
  - You are about to drop the `clientes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pacientes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pagos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usuarios` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `fecha_pedido` to the `pedidos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_cliente` to the `pedidos` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `pacientes` DROP FOREIGN KEY `pacientes_clienteId_fkey`;

-- DropForeignKey
ALTER TABLE `pagos` DROP FOREIGN KEY `pagos_clienteId_fkey`;

-- DropForeignKey
ALTER TABLE `pagos` DROP FOREIGN KEY `pagos_pedidoId_fkey`;

-- DropForeignKey
ALTER TABLE `pedidos` DROP FOREIGN KEY `pedidos_ibfk_1`;

-- DropIndex
DROP INDEX `idx_cliente` ON `pedidos`;

-- DropIndex
DROP INDEX `idx_estado` ON `pedidos`;

-- DropIndex
DROP INDEX `idx_fecha` ON `pedidos`;

-- AlterTable
ALTER TABLE `pedidos` DROP COLUMN `cantidad`,
    DROP COLUMN `clienteId`,
    DROP COLUMN `createdAt`,
    DROP COLUMN `descripcion`,
    DROP COLUMN `estado`,
    DROP COLUMN `fechaEntrega`,
    DROP COLUMN `fechaPedido`,
    DROP COLUMN `observaciones`,
    DROP COLUMN `paciente`,
    DROP COLUMN `pagado`,
    DROP COLUMN `precioTotal`,
    DROP COLUMN `precioUnitario`,
    DROP COLUMN `tipoTrabajo`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `fecha_delete` DATE NULL,
    ADD COLUMN `fecha_entrega` DATE NULL,
    ADD COLUMN `fecha_pedido` DATE NOT NULL,
    ADD COLUMN `id_administrador` INTEGER NULL,
    ADD COLUMN `id_cliente` INTEGER NOT NULL;

-- DropTable
DROP TABLE `clientes`;

-- DropTable
DROP TABLE `pacientes`;

-- DropTable
DROP TABLE `pagos`;

-- DropTable
DROP TABLE `usuarios`;

-- CreateTable
CREATE TABLE `administrador` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `telefono` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `usuario` VARCHAR(50) NOT NULL,
    `super_usuario` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `telefono` VARCHAR(20) NULL,
    `celular` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `id_administrador` INTEGER NULL,
    `tipo` ENUM('ODONTOLOGO', 'CLINICA_DENTAL', 'PARTICULAR', 'LABORATORIO', 'OTRO') NOT NULL DEFAULT 'ODONTOLOGO',

    INDEX `idx_cliente`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `producto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(50) NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `id_administrador` INTEGER NULL,

    INDEX `idx_producto`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `descripcion` VARCHAR(50) NOT NULL,
    `fecha_insert` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_delete` DATETIME(3) NULL,

    INDEX `idx_estado`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `detalle_pedidos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pedido` INTEGER NOT NULL,
    `id_producto` INTEGER NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `precio_unitario` DECIMAL(10, 2) NOT NULL,
    `paciente` VARCHAR(100) NULL,
    `id_estado` INTEGER NULL,

    INDEX `idx_detalle_pedidos`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pago` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `valor` DECIMAL(10, 2) NOT NULL,
    `id_administrador` INTEGER NULL,

    INDEX `idx_pago`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `detalle_pago` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pago` INTEGER NOT NULL,
    `id_pedido` INTEGER NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `fecha_pago` DATE NOT NULL,

    INDEX `idx_detalle_pago`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auditoria` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `usuario` VARCHAR(50) NOT NULL,
    `fecha_accion` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `accion` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_pedidos` ON `pedidos`(`id`);

-- AddForeignKey
ALTER TABLE `cliente` ADD CONSTRAINT `cliente_id_administrador_fkey` FOREIGN KEY (`id_administrador`) REFERENCES `administrador`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `producto` ADD CONSTRAINT `producto_id_administrador_fkey` FOREIGN KEY (`id_administrador`) REFERENCES `administrador`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidos` ADD CONSTRAINT `pedidos_id_cliente_fkey` FOREIGN KEY (`id_cliente`) REFERENCES `cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidos` ADD CONSTRAINT `pedidos_id_administrador_fkey` FOREIGN KEY (`id_administrador`) REFERENCES `administrador`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalle_pedidos` ADD CONSTRAINT `detalle_pedidos_id_pedido_fkey` FOREIGN KEY (`id_pedido`) REFERENCES `pedidos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalle_pedidos` ADD CONSTRAINT `detalle_pedidos_id_producto_fkey` FOREIGN KEY (`id_producto`) REFERENCES `producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalle_pedidos` ADD CONSTRAINT `detalle_pedidos_id_estado_fkey` FOREIGN KEY (`id_estado`) REFERENCES `estado`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pago` ADD CONSTRAINT `pago_id_administrador_fkey` FOREIGN KEY (`id_administrador`) REFERENCES `administrador`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalle_pago` ADD CONSTRAINT `detalle_pago_id_pago_fkey` FOREIGN KEY (`id_pago`) REFERENCES `pago`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detalle_pago` ADD CONSTRAINT `detalle_pago_id_pedido_fkey` FOREIGN KEY (`id_pedido`) REFERENCES `pedidos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
