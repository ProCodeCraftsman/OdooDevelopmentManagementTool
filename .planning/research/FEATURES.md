# Feature Research: Docker Compose Monorepo Containerization

**Domain:** DevOps / Infrastructure / Containerization
**Project:** GPS Odoo Tracker — Adding Docker Compose to existing React + FastAPI + PostgreSQL monorepo
**Researched:** 2026-04-12
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist when adding Docker containerization. Missing these = broken or incomplete setup.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|-------------|-------|
| **Multi-service Compose file** | Standard pattern for monorepo with backend, frontend, database | LOW | None | Define all services (app, db, optionally redis) in one place |
| **PostgreSQL health check** | Prevents app from starting before DB is ready | LOW | None | `pg_isready` command with interval/retries/start_period |
| **Health-aware dependency ordering** | Avoids race conditions where app crashes on startup | MEDIUM | Health checks | Use `depends_on: condition: service_healthy` |
| **Volume persistence for database** | Data must survive container restarts | LOW | None | Named volume `postgres_data:/var/lib/postgresql/data` |
| **Environment variable configuration** | Secrets and config differ per environment | LOW | None | `.env` file with DB credentials, JWT secret |
| **Custom Docker network** | Containers must communicate, isolated from other apps | LOW | None | Bridge network named after project |
| **`.dockerignore` file** | Prevents sending node_modules, venv, git to Docker daemon | LOW | None | Critical for monorepo build performance |
| **Dockerfile for backend** | Defines how to build FastAPI container | LOW | None | Python base image, uvicorn, port 8000 |
| **Dockerfile for frontend** | Defines how to build React container | LOW | None | Node base image, build step, port 5173 |
| **Health endpoint in FastAPI** | Enables health check for app container | LOW | None | `/health` endpoint returning 200 OK |
| **CORS configuration via env** | Frontend URL differs between dev/prod | LOW | None | Pass `CORS_ORIGINS` via environment |

### Differentiators (Competitive Advantage)

Features that set the containerization apart. Not required, but valuable for DX and production readiness.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|-------------|-------|
| **Override file pattern** | Separates dev from prod cleanly, prevents config drift | MEDIUM | None | `docker-compose.yml` (base) + `docker-compose.override.yml` (dev auto-load) + `docker-compose.prod.yml` |
| **Multi-stage Dockerfiles** | Production images are smaller, no dev deps included | MEDIUM | None | `FROM python:3.11-slim AS builder` → `FROM python:3.11-slim` |
| **Hot reload in development** | Developers can edit code without rebuilding | LOW | Override file | Volume mount `./backend:/app` for uvicorn auto-reload |
| **Startup migration runner** | Database schema stays in sync automatically | MEDIUM | Migration container | Separate `migrations` service with `condition: service_completed_successfully` |
| **Resource limits** | Prevents one service from consuming all memory/CPU | MEDIUM | None | `deploy.resources.limits` in production override |
| **Restart policies** | Containers recover from crashes automatically | LOW | None | `restart: unless-stopped` for production |
| **Production reverse proxy** | Single port exposure, serves built frontend | HIGH | Nginx/Traefik | Nginx serving static React build, proxying to FastAPI |
| **Secrets management** | Credentials not in environment variables | MEDIUM | None | Docker secrets for production |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|----------------|-------------|
| **Bind mounts for database in production** | Simpler than named volumes | Data corruption risk, permission issues | Named volumes only |
| **Single compose file for all environments** | Simplicity | Config drift between dev/prod | Override file pattern |
| **`depends_on` without health checks** | Simpler configuration | App starts before DB ready, crashes | Health checks + `condition: service_healthy` |
| **Building in production compose** | "Same process everywhere" | Slow deploys, inconsistent builds | Pre-built images in production |
| **`allow_origins: "*"` for CORS** | "Works everywhere" | Security risk in production | Environment-specific origins |
| **Running as root in containers** | Avoids permission issues | Security vulnerability | `USER` instruction in Dockerfile |
| **`latest` tag for base images** | "Always up to date" | Reproducibility issues | Specific version tags (`python:3.11-slim`) |

## Feature Dependencies

```
[PostgreSQL Health Check]
    └──required-by──> [Health-Aware depends_on]
                           └──enables──> [Startup Migration Runner]

[Dockerfile (backend)]
    └──used-by──> [Multi-stage Build]
                        └──produces──> [Production Image]

[docker-compose.yml (base)]
    └──extended-by──> [docker-compose.override.yml (dev)]
                          └──extended-by──> [docker-compose.prod.yml]

[.env file]
    └──required-by──> [All services]
                           └──enables──> [Secrets via env vars]

[Multi-stage Dockerfile]
    └──optimizes──> [Production Image Size]
```

### Dependency Notes

- **PostgreSQL health check requires health check block:** Without `healthcheck:` in the postgres service, `condition: service_healthy` will never pass
- **Override files extend base:** Changes in override files merge on top of base, later files win for scalar values
- **Hot reload requires volume mount:** Development volume mount `./backend:/app` is essential for uvicorn `--reload` to work
- **Health endpoint requires FastAPI implementation:** Must add `/health` endpoint that returns 200 OK

## MVP Definition

### Launch With (v1 — Development Containerization)

Minimum viable containerization for team development. Enables "one command setup."

- [ ] **Base docker-compose.yml** — Defines backend, frontend, postgres services with custom network and volumes
- [ ] **PostgreSQL health check** — `pg_isready` with 5s interval, 5 retries, 10s start_period
- [ ] **Health-aware depends_on** — Backend waits for postgres `condition: service_healthy`
- [ ] **Backend Dockerfile** — Python base, requirements.txt install, uvicorn startup
- [ ] **Frontend Dockerfile** — Node base, npm build, nginx for production OR vite dev server
- [ ] **Hot reload volumes** — `./backend:/app` and `./frontend:/app` mounts for development
- [ ] **CORS environment variable** — `CORS_ORIGINS` passed to backend, configurable
- [ ] **.dockerignore** — Excludes node_modules, venv, .git, __pycache__, *.pyc
- [ ] **.env template** — Documents required variables (DB_USER, DB_PASSWORD, etc.)

### Add After Validation (v1.1 — Production Readiness)

Features to add when deploying to staging/production.

- [ ] **docker-compose.prod.yml override** — Removes volumes, adds restart policy, resource limits
- [ ] **Production multi-stage Dockerfiles** — Smaller images, no dev dependencies
- [ ] **Startup migration runner** — Separate migrations container with `condition: service_completed_successfully`
- [ ] **Nginx reverse proxy** — Serves frontend static files, proxies to backend API

### Future Consideration (v2+)

Features to defer until containerization is stable.

- [ ] **Docker secrets** — For production credential management instead of .env
- [ ] **Traefik integration** — Automatic HTTPS, routing
- [ ] **Multiple environment compose files** — staging, uat, production
- [ ] **CI/CD compose usage** — Same compose files for GitHub Actions testing

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Reason |
|---------|------------|---------------------|----------|--------|
| Base docker-compose.yml | HIGH | LOW | P1 | Core of containerization |
| PostgreSQL health check | HIGH | LOW | P1 | Prevents startup race conditions |
| Health-aware depends_on | HIGH | LOW | P1 | Required for reliable startup |
| Backend Dockerfile | HIGH | LOW | P1 | Build the FastAPI container |
| Frontend Dockerfile | HIGH | LOW | P1 | Build the React container |
| .dockerignore | MEDIUM | LOW | P1 | Prevents bloated build context |
| Hot reload volumes | HIGH | LOW | P1 | Developer productivity |
| CORS env config | MEDIUM | LOW | P1 | Required for frontend-backend communication |
| .env template | MEDIUM | LOW | P1 | Documents required configuration |
| Volume persistence | HIGH | LOW | P1 | Data survives restarts |
| Override file pattern | MEDIUM | MEDIUM | P2 | Separates dev from prod cleanly |
| Production multi-stage | MEDIUM | MEDIUM | P2 | Smaller production images |
| Resource limits | MEDIUM | MEDIUM | P2 | Production stability |
| Startup migrations | MEDIUM | MEDIUM | P2 | Automatic schema sync |
| Nginx reverse proxy | MEDIUM | HIGH | P3 | Single port, production realism |
| Docker secrets | LOW | MEDIUM | P3 | Over-engineered for small teams |
| Traefik integration | LOW | HIGH | P3 | Adds complexity, not needed yet |

**Priority key:**
- P1: Must have for MVP launch
- P2: Should have, add when stable
- P3: Nice to have, future consideration

## Existing Project Context

### Current Stack (from ARCHITECTURE.md)
- **Frontend:** React 18, TypeScript, Vite, React Query, Zustand, TailwindCSS
- **Backend:** FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2
- **Database:** PostgreSQL
- **Auth:** JWT (python-jose), Passlib
- **External:** XML-RPC to Odoo 17

### Containerization Implications

| Existing Component | Docker Consideration | Complexity | Notes |
|-------------------|---------------------|------------|-------|
| FastAPI on port 8000 | Expose 8000 in compose, 8000:8000 mapping | LOW | Already configured |
| React on port 5173 (Vite) | Development uses 5173:5173, production uses nginx | LOW | Vite HMR works in container |
| PostgreSQL connection | Host becomes `postgres` (service name) | LOW | Update `DB_HOST` env var |
| Alembic migrations | Can run as separate container or on startup | MEDIUM | Recommended: separate migration service |
| JWT SECRET_KEY | Must come from environment, not hardcoded | LOW | Already uses pydantic-settings |
| Odoo XML-RPC | External service, not in compose | LOW | Network access required |
| `.env` configuration | FastAPI uses pydantic-settings | LOW | Already supports env vars |

## Recommended Project Structure

```
GPSOdooTracker/
├── docker-compose.yml              # Base compose (commits to repo)
├── docker-compose.override.yml    # Dev overrides (gitignored or local-only)
├── docker-compose.prod.yml         # Production overrides
├── .env.example                    # Template for required variables
├── .dockerignore                   # Prevents bloat
├── backend/
│   ├── Dockerfile                  # Backend container definition
│   ├── Dockerfile.prod             # Multi-stage production build
│   └── ...
├── frontend/
│   ├── Dockerfile                  # Frontend container definition
│   ├── Dockerfile.prod             # Multi-stage production build
│   └── ...
└── ...
```

## Sources

- Docker Recipes: FastAPI + PostgreSQL Docker Compose patterns (2026-03-08)
- OneUptime: How to Structure a Monorepo with Docker (2026-02-08)
- Docker Docs: Control startup order with health checks (2025-07-02)
- Docker Recipes: Compose Override Files pattern (2026-03-08)
- ZTABS: Docker Compose Production Setup Guide (2026-03-14)
- UseApify: Docker Compose Production Guide (2026-03-19)
- OneUptime: Docker Compose Override Files (2026-01-25)
- Docker Recipes: Health Checks and Service Dependencies (2026-03-08)

---

*Feature research for: Docker Compose monorepo containerization*
*Researched: 2026-04-12*
