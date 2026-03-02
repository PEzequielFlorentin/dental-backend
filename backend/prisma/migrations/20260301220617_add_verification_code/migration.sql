-- AlterTable
ALTER TABLE `reset_token` ADD COLUMN `code_expires_at` DATETIME(3) NULL,
    ADD COLUMN `verification_code` VARCHAR(6) NULL;

-- CreateTable
CREATE TABLE `configuracion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clave` VARCHAR(100) NOT NULL,
    `valor` TEXT NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `configuracion_clave_key`(`clave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `reset_token_verification_code_idx` ON `reset_token`(`verification_code`);
