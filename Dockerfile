FROM node:22-slim

# Instala dependencias del sistema
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia archivos de dependencias
COPY backend/package*.json ./

# Instala dependencias y fuerza permisos
RUN npm install --unsafe-perm

# Copia el resto del código
COPY backend/ .

# Da permisos de ejecución a todos los binarios de node_modules
RUN chmod -R +x node_modules/.bin

# Verifica que prisma tenga permisos
RUN ls -la node_modules/.bin/prisma

# Ejecuta prisma generate con ruta completa
RUN node_modules/.bin/prisma generate --schema=prisma/schema.prisma

EXPOSE 3000

CMD ["npm", "start"]