FROM node:18-alpine

WORKDIR /app

# Invalidate cache on every build
ARG BUILD_ID=unknown
RUN echo "Build ID: $BUILD_ID"

# Copiar package files
COPY package*.json ./

# Instalar dependencias (incluyendo dev para compilar TypeScript)
RUN npm install

# Copiar código
COPY . .

# Compilar TypeScript
RUN npm run build

# Crear directorio de logs
RUN mkdir -p logs

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Iniciar servidor
CMD ["node", "dist/app.js"]
