# Requirements: GPS Odoo Tracker

**Defined:** 2026-04-12
**Core Value:** Accurately track Odoo module versions across environments and enable safe, validated release deployments through automated drift detection.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Containerization

- [ ] **CONT-01**: Developer can run `docker compose up` to start all services (postgres, backend, frontend, nginx)
- [ ] **CONT-02**: Backend Dockerfile uses multi-stage build for production (Python 3.11-slim)
- [ ] **CONT-03**: Frontend Dockerfile uses multi-stage build for production (Node 20 build → Nginx serve)
- [ ] **CONT-04**: All image versions are pinned (no :latest tags)
- [ ] **CONT-05**: `.dockerignore` files exist at root and in backend/frontend to prevent bloat

### Networking & Routing

- [ ] **NET-01**: Nginx reverse proxy routes `/api/*` to backend service on port 8000
- [ ] **NET-02**: Nginx serves React static files for all other routes (SPA fallback)
- [ ] **NET-03**: Nginx configuration includes static asset caching headers
- [ ] **NET-04**: Single entry point on port 80 via nginx (no CORS configuration needed)

### Health & Reliability

- [ ] **HLTH-01**: PostgreSQL container includes health check using `pg_isready`
- [ ] **HLTH-02**: Backend container includes HTTP health check endpoint
- [ ] **HLTH-03**: Compose file uses `depends_on: condition: service_healthy` for dependency ordering
- [ ] **HLTH-04**: Services start reliably from cold (`docker compose down -v && docker compose up -d`)

### Environment Configuration

- [ ] **ENV-01**: `.env.example` documents all required environment variables
- [ ] **ENV-02**: No hardcoded secrets in Dockerfiles or compose files
- [ ] **ENV-03**: `.env` is listed in `.gitignore`

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Development Experience

- **DEV-01**: `docker-compose.override.yml` enables hot reload for backend and frontend
- **DEV-02**: Vite HMR works inside container with volume mounts
- **DEV-03**: Alembic migration runner script available

### Production Hardening

- **PROD-01**: `docker-compose.prod.yml` for production deployment
- **PROD-02**: Resource limits on all services (CPU/memory)
- **PROD-03**: Restart policies (`unless-stopped`)
- **PROD-04**: Log rotation configuration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-environment compose files | Over-engineered for current team; single config sufficient |
| Docker secrets | `.env` approach sufficient for team size; secrets adds complexity |
| CI/CD pipeline integration | Separate concern from local containerization |
| Traefik integration | Adds complexity without benefit for current scale |
| Kubernetes/Helm charts | Future consideration after Docker Compose validated |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 1 | Pending |
| CONT-02 | Phase 1 | Pending |
| CONT-03 | Phase 1 | Pending |
| CONT-04 | Phase 1 | Pending |
| CONT-05 | Phase 1 | Pending |
| NET-01 | Phase 1 | Pending |
| NET-02 | Phase 1 | Pending |
| NET-03 | Phase 1 | Pending |
| NET-04 | Phase 1 | Pending |
| HLTH-01 | Phase 1 | Pending |
| HLTH-02 | Phase 1 | Pending |
| HLTH-03 | Phase 1 | Pending |
| HLTH-04 | Phase 1 | Pending |
| ENV-01 | Phase 1 | Pending |
| ENV-02 | Phase 1 | Pending |
| ENV-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12 after roadmap creation (Phase 1 mapped)*
