# VOD Platform - Cloud Architecture Project

## 🎬 Descripción
Plataforma de video bajo demanda con arquitectura cloud escalable usando AWS, Docker, Kubernetes y CI/CD.

## 🛠 Tecnologías
- **Cloud Provider:** AWS
- **Containerización:** Docker
- **Orquestación:** Kubernetes (minikube local / EKS)
- **IaC:** Terraform
- **CI/CD:** GitHub Actions
- **Frontend:** HTML/CSS/JS vanilla
- **Backend:** Node.js + Python
- **Base de datos:** PostgreSQL
- **Cache:** Redis
- **Monitoring:** Prometheus

## 🚀 Despliegue Rápido

### Desarrollo Local (5 minutos)
```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/vod-platform.git
cd vod-platform

# Levantar todos los servicios
docker-compose up -d

# Verificar funcionamiento
curl http://localhost:3000/health

# Acceder a la aplicación
open http://localhost:3000
```

### Producción Kubernetes
```bash
# Aplicar manifiestos
kubectl apply -f infrastructure/k8s/

# Verificar deployment
kubectl get pods -n vod-platform
```

## 📊 Arquitectura
- **Frontend:** React SPA servido por API Gateway
- **API Gateway:** Node.js con proxy a microservicios
- **Content Service:** Python Flask para gestión de contenido
- **Base de datos:** PostgreSQL + Redis cache
- **Monitoreo:** Prometheus + health checks
- **CI/CD:** GitHub Actions automatizado

## 🎯 Funcionalidades
- [x] Registro y autenticación de usuarios
- [x] Catálogo de contenido multimedia
- [x] Streaming básico de video
- [x] Auto-scaling con Kubernetes HPA
- [x] CI/CD automatizado
- [x] Monitoreo con Prometheus
- [x] Infraestructura como código (Terraform)

## 📋 Estructura del Proyecto
```
vod-platform/
├── README.md
├── docker-compose.yml
├── infrastructure/
│   ├── terraform/          # Infraestructura AWS
│   ├── k8s/               # Manifiestos Kubernetes
│   └── monitoring/        # Configuración Prometheus
├── services/
│   ├── api-gateway/       # Node.js API Gateway
│   └── content-service/   # Python Content Service
├── frontend/              # Frontend HTML/CSS/JS
├── .github/workflows/     # CI/CD Pipeline
└── docs/                  # Documentación técnica
```

## 🔍 Testing y Verificación
```bash
# Health checks
curl http://localhost:3000/health
curl http://localhost:5000/health

# API endpoints
curl http://localhost:3000/api/content/content

# Métricas Prometheus
curl http://localhost:3000/metrics
open http://localhost:9090  # Prometheus UI
```

## 📈 Monitoreo
- **Prometheus:** http://localhost:9090
- **API Gateway Metrics:** http://localhost:3000/metrics
- **Content Service Metrics:** http://localhost:5000/metrics
- **Application Health:** http://localhost:3000/health

## 🏗 Despliegue en AWS
```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

## 📚 Documentación
- [Arquitectura Técnica](docs/technical-report.md)
- [Diagrama de Arquitectura](docs/architecture-diagram.md)
- [Guía de Deployment](docs/deployment-guide.md)

## 👥 Contribución
1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia
Este proyecto es parte de un portafolio académico y está disponible bajo licencia MIT.

---
**Desarrollado como proyecto de arquitectura cloud para demostración de competencias DevOps**