FROM node:18-alpine

WORKDIR /app

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
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3002/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Iniciar servidor
CMD ["node", "dist/index.js"]
