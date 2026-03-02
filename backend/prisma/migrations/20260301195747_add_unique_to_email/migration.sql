/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `administrador` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `administrador_email_key` ON `administrador`(`email`);
