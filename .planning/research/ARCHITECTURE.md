# Architecture Research: Docker Compose Monorepo Containerization

**Project:** GPS Odoo Tracker  
**Research Focus:** Adding Docker Compose containerization to existing monorepo  
**Date:** 2026-04-12  
**Confidence:** HIGH

---

## Executive Summary

This research addresses the first milestone: containerizing the existing React + FastAPI + PostgreSQL monorepo with Docker Compose. The existing backend has basic Docker setup, but lacks frontend containerization and unified orchestration. This document recommends a root-level docker-compose.yml with Nginx reverse proxy pattern for production-ready local development.

**Key Recommendation:** Use root-level `docker-compose.yml` with Nginx as a reverse proxy. Frontend uses multi-stage Docker build (Node build → Nginx serve). Backend continues using existing Dockerfile. All services communicate via Docker's internal network, eliminating CORS issues.

---

## Current State Analysis

### Existing Components

| Component | Current State | Docker Status |
|-----------|---------------|---------------|
| **Backend (FastAPI)** | ✅ Complete | ✅ Dockerfile exists |
| **Frontend (React/Vite)** | ✅ Complete | ❌ No Dockerfile |
| **PostgreSQL** | ✅ Configured | ✅ In backend docker-compose.yml |
| **Orchestration** | ❌ Separate | ❌ Backend has own compose |

### Existing Backend Docker Setup

```yaml
# backend/docker-compose.yml (EXISTS)
services:
  postgres: # ✓ Has health check
  app:      # ✓ Has --reload for dev
```

### Gaps Identified

1. **No frontend Dockerfile** — Cannot containerize frontend
2. **No root-level orchestration** — No unified `docker-compose up`
3. **No Nginx reverse proxy** — CORS handling is manual
4. **No .dockerignore** — Monorepo build context bloat
5. **No multi-environment config** — Dev vs Prod not separated

---

## Recommended Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │ :80
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Nginx Reverse Proxy                          │
│                   (nginx:alpine, port 80)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  location /api/  → proxy_pass http://backend:8000/        │  │
│  │  location /      → proxy_pass http://frontend:80/         │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────┬─────────────────────────────────┬───────────────────┘
            │                                 │
            ▼                                 ▼
┌───────────────────────────┐     ┌───────────────────────────────┐
│    Frontend Container     │     │      Backend Container        │
│   (React/Vite static)    │     │      (FastAPI + Uvicorn)     │
│   Port: 80 (internal)     │     │      Port: 8000 (internal)   │
└───────────┬───────────────┘     └───────────────┬───────────────┘
            │                                     │
            └──────────────┬──────────────────────┘
                           │ Docker Network
                           ▼
            ┌───────────────────────────────┐
            │        PostgreSQL 16           │
            │  Port: 5432 (internal only)    │
            └───────────────────────────────┘
```

### Recommended File Structure

```
GPSOdooTracker/
├── docker-compose.yml          # NEW: Root-level orchestration
├── .dockerignore               # NEW: Exclude build bloat
├── nginx/
│   └── nginx.conf              # NEW: Reverse proxy config
├── frontend/
│   ├── Dockerfile              # NEW: Multi-stage build
│   └── Dockerfile.dev          # NEW: Dev with hot reload
├── backend/
│   ├── Dockerfile              # EXISTS: Keep as-is for now
│   ├── docker-compose.yml      # EXISTS: Can be removed or kept
│   └── ...
└── ...
```

---

## Component Specifications

### 1. Nginx Reverse Proxy (NEW)

**Purpose:** Single entry point for all traffic. Routes `/api/*` to backend, everything else to frontend.

```nginx
# nginx/nginx.conf
upstream frontend {
    server frontend:80;
}

upstream backend {
    server backend:8000;
}

server {
    listen 80;
    
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Why Nginx?**
- Eliminates CORS configuration (same-origin requests)
- Single port exposure (security hardening)
- Production-realistic local development
- Standard industry pattern for containerized apps

### 2. Frontend Dockerfile (NEW)

**Purpose:** Multi-stage build for production. Serves static React build via Nginx.

```dockerfile
# frontend/Dockerfile
# =========================================
# Stage 1: Build the React application
# =========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (layer caching optimization)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# =========================================
# Stage 2: Serve with Nginx
# =========================================
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Frontend nginx.conf:**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. Frontend Dockerfile.dev (NEW)

**Purpose:** Development with hot module replacement (HMR).

```dockerfile
# frontend/Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
```

### 4. Root docker-compose.yml (NEW)

```yaml
# docker-compose.yml
services:
  # ─────────────────────────────────────────────────────────────
  # Nginx Reverse Proxy — Single entry point
  # ─────────────────────────────────────────────────────────────
  nginx:
    image: nginx:alpine
    container_name: odoo_auditor_nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx/conf.d/default.conf:ro
    depends_on:
      frontend:
        condition: service_started
      backend:
        condition: service_healthy
    networks:
      - odoo_auditor_net
    restart: unless-stopped

  # ─────────────────────────────────────────────────────────────
  # Frontend — React static build served by Nginx
  # ─────────────────────────────────────────────────────────────
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: odoo_auditor_frontend
    networks:
      - odoo_auditor_net
    restart: unless-stopped

  # ─────────────────────────────────────────────────────────────
  # Backend — FastAPI with health check
  # ─────────────────────────────────────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: odoo_auditor_backend
    environment:
      DATABASE_URL: postgresql://odoo_auditor:${POSTGRES_PASSWORD}@postgres:5432/odoo_auditor
      FERNET_KEY: ${FERNET_KEY}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      JWT_ALGORITHM: HS256
      FRONTEND_URLS: http://localhost
      APP_ENV: ${APP_ENV:-development}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - odoo_auditor_net
    restart: unless-stopped

  # ─────────────────────────────────────────────────────────────
  # PostgreSQL — Database
  # ─────────────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: odoo_auditor_postgres
    environment:
      POSTGRES_USER: odoo_auditor
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: odoo_auditor
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U odoo_auditor"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - odoo_auditor_net
    restart: unless-stopped

networks:
  odoo_auditor_net:
    driver: bridge

volumes:
  postgres_data:
```

### 5. .dockerignore (NEW)

```dockerignore
# Dependencies
node_modules
**/node_modules
__pycache__
**/__pycache__
*.pyc
*.pyo

# Build outputs
dist
build
.next
out

# Git
.git
.gitignore

# IDE
.vscode
.idea
*.swp
*.swo

# Environment
.env
.env.*
.env.local

# Documentation
*.md
LICENSE

# Docker (avoid recursive build)
**/Dockerfile
**/.dockerignore
docker-compose*.yml

# Tests
coverage
**/*.test.*
**/*.spec.*
**/tests

# Misc
*.log
.DS_Store
Thumbs.db
```

---

## Integration Points

### Data Flow Changes

| Before (Local Dev) | After (Docker) |
|-------------------|----------------|
| Frontend: `localhost:5173` | Frontend: internal only |
| Backend: `localhost:8000` | Backend: internal only |
| CORS: Configured manually | CORS: Not needed (same origin) |
| DB: `localhost:5432` | DB: `postgres:5432` (Docker network) |

### Environment Variable Updates

| Variable | Local Dev | Docker Compose |
|----------|-----------|----------------|
| `DATABASE_URL` | `localhost:5432` | `postgres:5432` |
| `FRONTEND_URLS` | `localhost:5173` | `http://localhost` |

### Backend CORS Update

The backend's current CORS config in `main.py` uses `FRONTEND_URLS` from settings. With Nginx reverse proxy, the frontend is served from the same origin as the backend, so CORS becomes unnecessary for same-origin requests.

**Optional Simplification:**
```python
# In production Docker, allow all since Nginx is the only entry point
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Simplified for containerized deployment
    ...
)
```

---

## Build Order & Dependencies

```
1. postgres          (no dependencies)
       ↓
2. backend           (depends on postgres health)
       ↓
3. frontend          (no backend dependency for build)
       ↓
4. nginx             (depends on frontend started, backend healthy)
```

**Rationale:**
- PostgreSQL must be healthy before backend starts
- Backend has health check endpoint for Nginx dependency
- Frontend build is independent (static assets only)
- Nginx waits for backend health to prevent 502 errors

---

## New vs Modified Files

### New Files to Create

| File | Purpose | Complexity |
|------|---------|------------|
| `docker-compose.yml` | Root orchestration | Low |
| `.dockerignore` | Monorepo build optimization | Low |
| `nginx/nginx.conf` | Reverse proxy routing | Low |
| `frontend/Dockerfile` | Multi-stage production build | Medium |
| `frontend/Dockerfile.dev` | Development with HMR | Low |
| `frontend/nginx.conf` | Frontend static serving | Low |

### Files to Modify

| File | Change | Risk |
|------|--------|------|
| `backend/docker-compose.yml` | Mark for deprecation or remove | Low |
| `.gitignore` | Add `.env` patterns | Low |

### Files to Keep As-Is

| File | Reason |
|------|--------|
| `backend/Dockerfile` | Works fine as-is |
| `backend/app/main.py` | No changes required |
| `frontend/vite.config.ts` | Works with minor adjustment for Docker dev |

---

## Vite Configuration for Docker Dev

For development inside containers, update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,  // Required for Docker networking
    port: 5173,
    strictPort: true,
  },
})
```

---

## Development Workflow Options

### Option A: Production-like (Recommended for Milestone 1)

```bash
docker compose up --build
# Access: http://localhost
# No hot reload — rebuild required for frontend changes
```

### Option B: Development with Hot Reload

```bash
# Start infrastructure + backend
docker compose up -d postgres backend

# Start frontend dev server (with volume mount)
docker compose -f docker-compose.dev.yml up frontend-dev
# Access: http://localhost:5173 (Vite HMR)
```

---

## Sources

| Source | Confidence | Key Takeaway |
|--------|------------|--------------|
| [Docker Docs: React Development](https://docs.docker.com/guides/reactjs/develop) | HIGH | Official multi-stage build + Compose Watch pattern |
| [Medium: Dockerized Full-Stack App](https://medium.com/lets-code-future/i-dockerized-a-full-stack-app-with-react-node-postgres-and-redis-heres-exactly-how-c6628dd009b0) | MEDIUM | Nginx reverse proxy eliminates CORS |
| [OneUptime: Monorepo Docker Structure](https://oneuptime.com/blog/post/2026-02-08-how-to-structure-a-monorepo-with-docker/view) | MEDIUM | Build context + .dockerignore optimization |
| [DigitalOcean: Monorepo Containerization](https://digitalocean.com/community/tutorials/how-to-containerize-monorepo-apps) | MEDIUM | Service isolation patterns |

---

## Recommendations

1. **Start with Option A** (production-like) for Milestone 1 — simpler, faster to implement
2. **Add Compose Watch later** for dev hot reload (Phase 2 enhancement)
3. **Keep backend Dockerfile unchanged** — works fine as-is
4. **Deprecate backend/docker-compose.yml** — root-level compose is the source of truth
5. **Add `.env.example`** with all required variables for easy onboarding
