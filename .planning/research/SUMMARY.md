# Research Summary: Docker Compose Monorepo Containerization

**Project:** GPSOdooTracker — Docker Compose containerization of React + FastAPI + PostgreSQL monorepo  
**Synthesized:** 2026-04-12  
**Overall Confidence:** HIGH

---

## Executive Summary

This project adds Docker Compose containerization to an existing React + FastAPI + PostgreSQL monorepo. The existing backend has basic Docker setup, but lacks frontend containerization and unified orchestration. Research recommends a **root-level `docker-compose.yml`** with an **Nginx reverse proxy** as the single entry point — routing `/api/*` to FastAPI and everything else to the React frontend served as static files. This eliminates CORS complexity entirely and matches production deployment patterns.

**Critical requirements for Phase 1:**
1. PostgreSQL and backend health checks with `condition: service_healthy` dependencies
2. Multi-stage Dockerfiles for production (Node build → Nginx serve)
3. `.dockerignore` files to prevent monorepo build bloat
4. Environment variable management via `.env` files (no hardcoded secrets)
5. All image versions pinned (no `:latest` tags)

The architecture cleanly separates concerns: Nginx handles routing, FastAPI handles API logic, React serves pre-built static assets, and PostgreSQL persists data. Development uses volume mounts for hot reload; production uses baked-in images.

---

## Key Findings

### From STACK.md

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Docker Compose | 2.x+ | Orchestration | Native YAML, replaces standalone `docker-compose` |
| PostgreSQL | 16-alpine | Database | Alpine saves ~40% image size; already configured |
| Nginx | 1.25-alpine | Reverse proxy + frontend serve | Tiny footprint, handles SPA routing |
| Python | 3.11-slim | Backend runtime | ~150MB vs 900MB for full; avoids Alpine compatibility issues |
| Node.js | 20-alpine | Frontend build | LTS through 2026 |

**Files to create:** Root `docker-compose.yml`, `frontend/Dockerfile` (multi-stage), `frontend/nginx.conf`, `.dockerignore`, `.env.example`  
**Files to upgrade:** `backend/Dockerfile` → multi-stage production build  
**Files to deprecate:** `backend/docker-compose.yml` (replaced by root-level orchestration)

### From FEATURES.md

**Table Stakes (P1 — MVP launch):**
- Multi-service compose file with custom bridge network
- PostgreSQL health check (`pg_isready`)
- Health-aware `depends_on: condition: service_healthy`
- Volume persistence for database
- Environment variable configuration via `.env`
- `.dockerignore` (prevents node_modules/__pycache__ bloat)
- Backend + frontend Dockerfiles
- FastAPI `/health` endpoint

**Differentiators (P2 — Production readiness):**
- Override file pattern (`docker-compose.yml` + `docker-compose.override.yml` + `docker-compose.prod.yml`)
- Multi-stage Dockerfiles (smaller production images)
- Hot reload via volume mounts (dev only)
- Startup migration runner (separate container)
- Resource limits and restart policies
- Nginx reverse proxy (single port, same-origin setup)

**Defer to v2+:**
- Docker secrets (over-engineered for small teams)
- Traefik integration (adds complexity)
- Multiple environment compose files (staging, UAT, production)

### From ARCHITECTURE.md

**Component Boundaries:**
```
Client (Browser)
    ↓ :80
Nginx Reverse Proxy
    ├── /api/* → backend:8000
    └── /*     → frontend:80 (static React build)
         ↓
┌──────────────┬──────────────┐
│   Frontend   │    Backend   │
│  (Nginx)     │  (FastAPI)   │
└──────────────┴──────────────┘
                   ↓
            PostgreSQL
```

**Build Order:**
1. PostgreSQL (no dependencies)
2. Backend (waits for PostgreSQL `service_healthy`)
3. Frontend (build independent of backend)
4. Nginx (waits for frontend `service_started` + backend `service_healthy`)

**Key Pattern:** Nginx as single entry point eliminates CORS. All traffic enters on port 80; services communicate internally on Docker bridge network.

### From PITFALLS.md

**Top 5 Pitfalls to Prevent in Phase 1:**

| Pitfall | Impact | Prevention |
|---------|--------|------------|
| **Race conditions** | Backend crashes on startup if Postgres not ready | Health checks + `condition: service_healthy` |
| **Volume mount hiding deps** | `MODULE_NOT_FOUND` after successful build | Anonymous volumes for `node_modules` / mounted subdirectories |
| **Build context issues** | `COPY failed: file not found` in monorepo | Use service-specific contexts (`context: ./backend`) |
| **Hardcoded secrets** | Credentials in git history | `.env` file with `.gitignore` exclusion |
| **Missing `.dockerignore`** | Slow builds, bloated images | Create before first build |

**Phase 2 pitfalls (production hardening):**
- Missing resource limits (container resource exhaustion)
- Dev compose file used in production (source exposure)
- No restart policy (dead containers)

---

## Implications for Roadmap

### Suggested Phase Structure

| Phase | Name | Deliverables | Key Features | Pitfalls to Avoid |
|-------|------|--------------|--------------|-------------------|
| **Phase 1** | Base Containerization | Root `docker-compose.yml`, frontend Dockerfile, `.dockerignore`, health checks | All P1 features from FEATURES.md | Race conditions, volume mount issues, missing health checks |
| **Phase 2** | Development Experience | `docker-compose.override.yml`, hot reload volumes, Vite HMR support | Dev hot reload, local migration runner, `.env.example` | Dev/prod config drift |
| **Phase 3** | Production Hardening | `docker-compose.prod.yml`, resource limits, restart policies, multi-stage Dockerfiles | Smaller images, auto-restart, resource constraints | Resource exhaustion, dead containers |

### Phase 1 Detail

**Rationale:** Phase 1 establishes the foundation. Health checks and dependency ordering are architectural requirements that affect everything else. Skipping them creates fragile systems.

**Delivers:**
- `docker-compose.yml` orchestrating postgres + backend + frontend + nginx
- `frontend/Dockerfile` (multi-stage: Node build → Nginx serve)
- `frontend/nginx.conf` (SPA routing, static asset caching)
- `backend/Dockerfile` (upgrade to multi-stage)
- `.dockerignore` (root level)
- `.env.example` (all required variables documented)
- PostgreSQL health check
- Backend health check + `/health` endpoint
- Health-aware `depends_on` between services

**Phase 1 verification:**
```bash
# Cold start test (must work reliably)
docker compose down -v && docker compose up -d
docker compose ps  # All services should show "(healthy)"
```

### Phase 2 Detail

**Rationale:** Once base containerization works, improve developer experience. Hot reload enables rapid iteration without rebuilds.

**Delivers:**
- `docker-compose.override.yml` (auto-loaded for dev)
- Volume mounts for backend and frontend source
- Vite configuration updated for Docker networking
- Alembic migration runner script

### Phase 3 Detail

**Rationale:** Production deployment requires stability guarantees: restart policies, resource limits, and separation of dev/prod configs.

**Delivers:**
- `docker-compose.prod.yml` (production overrides)
- Resource limits on all services
- Restart policies (`unless-stopped`)
- Pre-built images (no building in production)
- Log rotation configuration

---

## Research Flags

| Phase | Flag | Action |
|-------|------|--------|
| Phase 1 | **STANDARD PATTERNS** | Docker Compose + health checks are well-documented; no additional research needed |
| Phase 2 | **VALIDATE HOT RELOAD** | Test Vite HMR works inside container with volume mounts; edge cases exist |
| Phase 3 | **RESOURCE BENCHMARKING** | Measure actual CPU/memory usage before setting limits |
| All phases | **CI INTEGRATION** | Research not yet done; GitHub Actions Docker testing pattern |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | Standard Docker + Compose stack; multiple authoritative sources confirm versions |
| **Features** | HIGH | Well-established patterns from Docker documentation and community |
| **Architecture** | HIGH | Nginx reverse proxy pattern is industry standard for this stack |
| **Pitfalls** | HIGH | All 10 pitfalls are well-documented with clear prevention strategies |

**Gaps identified:**
- **Vite HMR in Docker** — needs practical testing to confirm works reliably
- **CI/CD pipeline** — Docker testing in GitHub Actions not covered
- **Production image registry** — if not self-hosted, research Docker Hub / GHCR patterns

---

## Sources

| Source | Confidence | Key Contribution |
|--------|------------|------------------|
| Docker Docs: React Development | HIGH | Official multi-stage build + Compose patterns |
| Docker Docs: Control startup order | HIGH | Health check + `condition: service_healthy` pattern |
| Docker Recipes: FastAPI + PostgreSQL | MEDIUM | FastAPI-specific Docker deployment patterns |
| Docker Compose Production Guide (2026) | MEDIUM | Production hardening checklist |
| Community: Common Compose mistakes | MEDIUM | Pitfall identification and prevention |
| OneUptime: Monorepo Docker Structure | MEDIUM | Build context optimization for monorepos |

---

## Files to Create

### Phase 1 (Base Containerization)

| File | Location | Purpose |
|------|----------|---------|
| `docker-compose.yml` | root | Root-level orchestration |
| `frontend/Dockerfile` | frontend/ | Multi-stage production build |
| `frontend/nginx.conf` | frontend/ | SPA routing + static asset caching |
| `backend/Dockerfile` | backend/ | Upgrade to multi-stage production |
| `.dockerignore` | root | Monorepo build optimization |
| `.env.example` | root | Template for required variables |
| `nginx/nginx.conf` | nginx/ | Reverse proxy routing |

### Phase 2 (Development Experience)

| File | Purpose |
|------|---------|
| `docker-compose.override.yml` | Auto-loaded dev configuration |
| `frontend/Dockerfile.dev` | Development with HMR support |

### Phase 3 (Production Hardening)

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production overrides |

---

*Research synthesized from STACK.md, FEATURES.md, ARCHITECTURE.md, and PITFALLS.md*
*Project: GPSOdooTracker Docker Compose containerization*
