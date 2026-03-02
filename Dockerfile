# Usa la imagen oficial de Node.js versión 22 (la que usa Render)
FROM node:22-slim

# Instala herramientas necesarias para Prisma (como openssl)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de definición de paquetes
COPY backend/package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto del código de la aplicación (backend)
COPY backend/ .

# Genera el cliente de Prisma (esto se ejecutará en el entorno controlado de Docker)
RUN npx prisma generate

# Expone el puerto que usará la aplicación (Render usará la variable de entorno PORT)
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["npm", "start"]