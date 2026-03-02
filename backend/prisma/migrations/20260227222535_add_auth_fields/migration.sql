/*
  Warnings:

  - You are about to drop the column `tipo` on the `cliente` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[usuario]` on the table `administrador` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reset_password_token]` on the table `administrador` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `password` to the `administrador` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `administrador` table without a default value. This is not possible if the table is not empty.
  - Made the column `fecha_accion` on table `auditoria` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `administrador` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `last_login` DATETIME(3) NULL,
    ADD COLUMN `locked_until` DATETIME(3) NULL,
    ADD COLUMN `login_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `password` VARCHAR(255) NOT NULL,
    ADD COLUMN `reset_password_expires` DATETIME(3) NULL,
    ADD COLUMN `reset_password_token` VARCHAR(255) NULL,
    ADD COLUMN `rol` VARCHAR(191) NOT NULL DEFAULT 'ADMIN',
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `auditoria` ADD COLUMN `detalles` TEXT NULL,
    ADD COLUMN `id_administrador` INTEGER NULL,
    ADD COLUMN `ip_address` VARCHAR(45) NULL,
    MODIFY `fecha_accion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `cliente` DROP COLUMN `tipo`,
    ADD COLUMN `id_tipo` INTEGER NULL;

-- AlterTable
ALTER TABLE `pedidos` ADD COLUMN `descripcion` VARCHAR(500) NULL;

-- CreateTable
CREATE TABLE `tipo_cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `descripcion` VARCHAR(50) NOT NULL,
    `fecha_insert` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_delete` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reset_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_administrador` INTEGER NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL DEFAULT 'RESET_PASSWORD',
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip_address` VARCHAR(45) NULL,

    UNIQUE INDEX `reset_token_token_key`(`token`),
    INDEX `reset_token_token_idx`(`token`),
    INDEX `reset_token_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `administrador_usuario_key` ON `administrador`(`usuario`);

-- CreateIndex
CREATE UNIQUE INDEX `administrador_reset_password_token_key` ON `administrador`(`reset_password_token`);

-- CreateIndex
CREATE INDEX `administrador_email_idx` ON `administrador`(`email`);

-- CreateIndex
CREATE INDEX `administrador_usuario_idx` ON `administrador`(`usuario`);

-- CreateIndex
CREATE INDEX `auditoria_fecha_accion_idx` ON `auditoria`(`fecha_accion`);

-- AddForeignKey
ALTER TABLE `cliente` ADD CONSTRAINT `cliente_id_tipo_fkey` FOREIGN KEY (`id_tipo`) REFERENCES `tipo_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_id_administrador_fkey` FOREIGN KEY (`id_administrador`) REFERENCES `administrador`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reset_token` ADD CONSTRAINT `reset_token_id_administrador_fkey` FOREIGN KEY (`id_administrador`) REFERENCES `administrador`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `cliente` RENAME INDEX `idx_cliente` TO `cliente_id_idx`;

-- RenameIndex
ALTER TABLE `detalle_pago` RENAME INDEX `idx_detalle_pago` TO `detalle_pago_id_idx`;

-- RenameIndex
ALTER TABLE `detalle_pedidos` RENAME INDEX `idx_detalle_pedidos` TO `detalle_pedidos_id_idx`;

-- RenameIndex
ALTER TABLE `estado` RENAME INDEX `idx_estado` TO `estado_id_idx`;

-- RenameIndex
ALTER TABLE `pago` RENAME INDEX `idx_pago` TO `pago_id_idx`;

-- RenameIndex
ALTER TABLE `pedidos` RENAME INDEX `idx_pedidos` TO `pedidos_id_idx`;

-- RenameIndex
ALTER TABLE `producto` RENAME INDEX `idx_producto` TO `producto_id_idx`;
