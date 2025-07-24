# Multi-stage build para optimizar imagen
FROM python:3.11-slim AS builder

# Variables de build
ARG BUILD_DATE
ARG VERSION=1.0.0

# Metadata
LABEL maintainer="tu-email@example.com" \
      description="Content Service for VOD Platform" \
      version=${VERSION} \
      build-date=${BUILD_DATE}

# Instalar dependencias del sistema necesarias para compilar
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar requirements y instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Production stage
FROM python:3.11-slim AS runtime

# Instalar dependencias runtime
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Crear usuario no-root para seguridad
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copiar dependencias Python instaladas
COPY --from=builder /root/.local /home/appuser/.local

# Copiar código fuente
COPY --chown=appuser:appuser . .

# Cambiar a usuario no-root
USER appuser

# Actualizar PATH para incluir binarios de usuario
ENV PATH=/home/appuser/.local/bin:$PATH

# Variables de entorno
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py
ENV FLASK_ENV=production

# Exponer puerto
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Comando de inicio con Gunicorn para producción
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "2", "--timeout", "60", "--keep-alive", "5", "--max-requests", "1000", "--preload", "app:app"]