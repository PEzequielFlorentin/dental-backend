FROM node:22-slim

# Instala dependencias del sistema
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia archivos de dependencias
COPY backend/package*.json ./

# Instala dependencias de Node y muestra salida detallada
RUN npm install --verbose

# Copia el resto del código
COPY backend/ .

# Lista el contenido para debug (opcional)
RUN ls -la

# Ejecuta prisma generate con salida detallada
RUN npx prisma generate --verbose

EXPOSE 3000

CMD ["npm", "start"]