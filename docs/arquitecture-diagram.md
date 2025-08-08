# docs/architecture-diagram.md

# Arquitectura de la Plataforma VOD

## Diagrama de Arquitectura

```mermaid
graph TB
    subgraph "Cliente"
        WEB[Web Browser]
        MOBILE[Mobile App]
    end

    subgraph "GitHub Actions CI/CD"
        GH[GitHub Repository]
        ACTIONS[GitHub Actions]
        REGISTRY[Container Registry]
    end

    subgraph "Kubernetes Cluster / Docker Compose"
        subgraph "Frontend Layer"
            LB[Load Balancer]
        end
        
        subgraph "API Layer"
            GW[API Gateway]
            GW2[API Gateway Replica]
        end
        
        subgraph "Service Layer"
            CS[Content Service]
            CS2[Content Service Replica]
        end
        
        subgraph "Data Layer"
            PG[(PostgreSQL)]
            REDIS[(Redis Cache)]
        end
        
        subgraph "Monitoring"
            PROM[Prometheus]
            GRAFANA[Grafana]
        end
    end

    subgraph "AWS Cloud (Opcional)"
        S3[S3 Bucket]
        CF[CloudFront CDN]
        VPC[VPC Network]
    end

    %% Client connections
    WEB --> LB
    MOBILE --> LB

    %% Load balancing
    LB --> GW
    LB --> GW2

    %% Service communication
    GW --> CS
    GW2 --> CS2
    CS --> PG
    CS --> REDIS
    CS2 --> PG
    CS2 --> REDIS

    %% Storage
    CS --> S3
    CS2 --> S3
    S3 --> CF

    %% Monitoring
    GW -.-> PROM
    CS -.-> PROM
    PROM --> GRAFANA

    %% CI/CD
    GH --> ACTIONS
    ACTIONS --> REGISTRY
    REGISTRY --> GW
    REGISTRY --> CS

    %% Auto-scaling indicators
    GW -.->|HPA| GW2
    CS -.->|HPA| CS2