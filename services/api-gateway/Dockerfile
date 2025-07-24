# Multi-stage build para optimizar imagen
FROM node:18-alpine AS builder

# Metadata
LABEL maintainer="tu-email@example.com"
LABEL description="API Gateway for VOD Platform"

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS runtime

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Instalar curl para health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copiar dependencias desde builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copiar código fuente
COPY --chown=nodejs:nodejs . .

# Crear directorio para archivos públicos
RUN mkdir -p /app/public && chown nodejs:nodejs /app/public

# Cambiar a usuario no-root
USER nodejs

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Comando de inicio
CMD ["node", "app.js"]