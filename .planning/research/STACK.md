# Stack Research: Docker Compose Monorepo Containerization

**Domain:** Full-stack monorepo containerization (React + FastAPI + PostgreSQL)
**Researched:** 2026-04-12
**Confidence:** HIGH

## Executive Summary

This project has a basic backend Docker setup but lacks frontend containerization and a unified monorepo orchestration strategy. For first-phase Docker Compose containerization, we need:

1. **Frontend Dockerfile** with multi-stage build (build stage + Nginx runtime)
2. **Root-level docker-compose.yml** to orchestrate all services
3. **Docker-specific environment handling** via `.env.docker`
4. **Health checks and dependency ordering** between services

The existing backend setup is functional but lacks production hardening. We'll keep it simple for Phase 1 while establishing patterns that scale.

---

## Recommended Stack

### Core Containerization Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Docker** | 24.x+ | Container runtime | Standard; required for Compose |
| **Docker Compose** | 2.x+ | Multi-container orchestration | Native YAML orchestration; version 2 replaces standalone `docker-compose` |
| **PostgreSQL** | 16-alpine | Database | Already configured; Alpine variant saves ~40% image size |
| **Nginx** | 1.25-alpine | Frontend reverse proxy | Tiny footprint, handles SPA routing, serves static assets |

### Backend Docker

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Python** | 3.11-slim | Runtime base | Well-tested with FastAPI; slim variant ~150MB vs ~900MB for full |
| **Uvicorn** | (via requirements) | ASGI server | Native FastAPI partner; `--reload` for dev |
| **Gunicorn** | 21.2+ | (Optional for prod) Process manager | Better than raw uvicorn for production with multiple workers |

### Frontend Docker

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Node.js** | 20-alpine | Build and runtime | LTS; Alpine for small images |
| **Nginx** | alpine | Production serve | 10MB vs 100MB+ for Node serving static |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **.dockerignore** | Exclude build artifacts | Prevents node_modules bloat, __pycache__, etc. |
| **docker-compose.dev.yml** | Overlays for dev mode | Hot reload, debug ports, verbose logs |
| **docker-compose.prod.yml** | Overlays for prod | Optimized builds, no source mounts |

---

## What's Already There vs What's Needed

### Existing (Backend Only)

```
backend/
├── Dockerfile           # Basic single-stage build
├── docker-compose.yml  # Backend + Postgres only
└── requirements.txt    # Has all needed deps
```

### Missing (Phase 1 Addition)

| File | Location | Purpose |
|------|----------|---------|
| `frontend/Dockerfile` | frontend/ | Multi-stage build for React |
| `docker-compose.yml` | root | Monorepo orchestration |
| `.dockerignore` | both dirs | Exclude unnecessary files |
| `.env.example` | root | Template for required env vars |

### What's NOT Needed (Yet)

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Kubernetes manifests** | Overkill for Phase 1; adds complexity | Docker Compose scaling |
| **Separate docker-compose files per service** | Premature abstraction | Single file with service blocks |
| **Gunicorn for FastAPI** | Adds complexity; uvicorn workers sufficient for MVP | Single uvicorn worker |
| **Watchtower / auto-update** | Phase 2 concern | Manual rebuilds |
| **Multi-stage frontend with build caching** | Phase 2 optimization | Simple multi-stage for now |

---

## Installation & Setup

### 1. Root-level docker-compose.yml

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    container_name: gpstracker_postgres
    environment:
      POSTGRES_USER: ${DB_USER:-odoo_auditor}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-change_me}
      POSTGRES_DB: ${DB_NAME:-odoo_auditor}
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-odoo_auditor}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - gpstracker

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: gpstracker_backend
    environment:
      DATABASE_URL: postgresql+psycopg2://${DB_USER:-odoo_auditor}:${DB_PASSWORD:-change_me}@postgres:5432/${DB_NAME:-odoo_auditor}
      FERNET_KEY: ${FERNET_KEY}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      JWT_ALGORITHM: HS256
      JWT_EXPIRATION_HOURS: 24
      APP_ENV: ${APP_ENV:-development}
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - gpstracker
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: gpstracker_frontend
    environment:
      - VITE_API_URL=http://localhost:8000
    ports:
      - "5173:80"
    depends_on:
      - backend
    networks:
      - gpstracker

networks:
  gpstracker:
    driver: bridge

volumes:
  postgres_data:
```

### 2. Frontend Dockerfile (Multi-stage)

```dockerfile
# frontend/Dockerfile

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm ci

COPY . .

# Build the React app
RUN npm run build

# Stage 2: Production serve
FROM nginx:1.25-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 3. Frontend Nginx Config (SPA Routing)

```nginx
# frontend/nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Serve static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback - all routes to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (optional - enables same-origin setup)
    location /api {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Backend Dockerfile (Production-ready)

```dockerfile
# backend/Dockerfile

# Stage 1: Builder
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/usr/local

# Copy application code
COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser alembic ./alembic

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 5. Environment Template

```bash
# .env.example
# Copy to .env and fill in values

# Database
DB_USER=odoo_auditor
DB_PASSWORD=change_me_in_production
DB_NAME=odoo_auditor
DB_PORT=5432

# Security (generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
FERNET_KEY=your_fernet_key_here

# JWT (generate with: python -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET_KEY=your_jwt_secret_here

# App
APP_ENV=development
```

### 6. .dockerignore Files

```gitignore
# backend/.dockerignore
__pycache__
*.pyc
*.pyo
*.pyd
.Python
*.so
*.egg
*.egg-info
dist
build
.pytest_cache
.mypy_cache
.coverage
htmlcov
.venv
venv
.env
.env.*
.git
.gitignore
.dockerignore
Dockerfile
docker-compose*.yml
tests
*.md
README*
```

```gitignore
# frontend/.dockerignore
node_modules
dist
.git
.gitignore
.dockerignore
Dockerfile
*.md
.env
.env.*
coverage
*.log
```

---

## Quick Start Commands

```bash
# Development (from root)
docker compose up --build

# Development with logs
docker compose up --build -d && docker compose logs -f

# Stop all services
docker compose down

# Stop and remove volumes (reset database)
docker compose down -v

# Rebuild without cache
docker compose build --no-cache

# Run migrations
docker compose exec backend alembic upgrade head
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Single docker-compose.yml** | Multiple compose files per environment | Only when different teams deploy different services |
| **Nginx for frontend** | Node serving static | Only if you need SSR (not this project) |
| **python:3.11-slim** | python:3.11-alpine | Alpine can have compatibility issues with some Python packages (cryptography, psycopg) |
| **Uvicorn workers=1** | Gunicorn + uvicorn workers | Upgrade to Gunicorn when you need process management, graceful reloads, or multiple workers |

---

## Stack Patterns by Variant

**If you only need backend + database:**
- Use existing `backend/docker-compose.yml`
- Add frontend later when ready

**If you need hot reload in development:**
- Mount source directories as volumes (already in compose)
- Use `npm run dev` for frontend (Vite HMR)
- Use `--reload` flag for backend (already configured)

**If you need production build:**
- Use multi-stage Dockerfiles
- No volume mounts
- Optimized Nginx serving static files

---

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| `python:3.11-slim` | FastAPI 0.109+, uvicorn 0.27+ | Tested; Python 3.12 also works |
| `node:20-alpine` | Vite 5+, React 19 | Node 20 is LTS through 2026 |
| `postgres:16-alpine` | psycopg2-binary 2.9+, SQLAlchemy 2.0+ | Works with all project dependencies |
| `nginx:1.25-alpine` | SPA routing needs | 1.24+ required for some modern features |

---

## Integration Points

### Database Connection String

The backend expects `DATABASE_URL` in this format:
```
postgresql+psycopg2://user:password@host:5432/dbname
```

The current `requirements.txt` uses `psycopg2-binary` which works in Docker without system dependencies.

### Health Check Endpoint

Add to `backend/app/main.py`:
```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

### CORS Configuration

Ensure backend CORS allows frontend origin:
```python
# backend/app/core/config.py or main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Sources

- **FastAPI Docker Best Practices**: [Docker Recipes - FastAPI + PostgreSQL](https://docker.recipes/full-stacks/fastapi-postgres) — MEDIUM confidence
- **FastAPI Production Deployment**: [Greeden - Definitive Guide 2025](https://blog.greeden.me/en/2025/09/02/the-definitive-guide-to-fastapi-production-deployment-with-dockeryour-one-stop-reference-for-uvicorn-gunicorn-nginx-https-health-checks-and-observability-2025-edition/) — MEDIUM confidence
- **Monorepo Docker Patterns**: [Medium - Dockerized Monorepo](https://medium.com/@alexaluga/why-we-chose-a-monorepo-and-dockerized-everything-3d70ecfe4368) — MEDIUM confidence
- **FastAPI + React Starter**: [GitHub - fastapi-react-starter](https://github.com/raythurman2386/fastapi-react-starter) — MEDIUM confidence (real-world example)
- **Small FastAPI Images**: [Medium - 7 FastAPI Images Under 100MB](https://medium.com/@1nick1patel1/7-fastapi-images-under-100mb-without-pain-0e455912a603) — MEDIUM confidence

---

## Phase 1 Deliverables Summary

| File | Status | Action |
|------|--------|--------|
| Root docker-compose.yml | Missing | Create |
| frontend/Dockerfile | Missing | Create |
| frontend/nginx.conf | Missing | Create |
| frontend/.dockerignore | Missing | Create |
| backend/.dockerignore | Missing | Create |
| .env.example | Missing | Create |
| backend/Dockerfile | Exists (basic) | Upgrade to multi-stage |
| backend/docker-compose.yml | Exists | Keep as-is or deprecate |

---

*Stack research for: Docker Compose monorepo containerization*
*Researched: 2026-04-12*
