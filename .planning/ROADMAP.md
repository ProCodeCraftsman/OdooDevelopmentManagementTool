# Roadmap: GPS Odoo Tracker

## Overview

Containerize the GPS Odoo Tracker monorepo (React + FastAPI + PostgreSQL) using Docker Compose. Single-phase milestone delivers production-ready containerization with Nginx reverse proxy as the unified entry point, health checks for reliability, and proper environment configuration.

## Milestones

- 🚧 **v1.0 Docker Compose** - Phase 1 (in progress)
- 📋 **v1.1 Development Experience** - Hot reload, override files
- 📋 **v1.2 Production Hardening** - Resource limits, restart policies

## Phases

- [ ] **Phase 1: Base Containerization** - Docker Compose with health checks, multi-stage builds, Nginx proxy

## Phase Details

### Phase 1: Base Containerization

**Goal**: Developer can run `docker compose up` to start all services with production-ready containerization

**Depends on**: Nothing (first phase)

**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, NET-01, NET-02, NET-03, NET-04, HLTH-01, HLTH-02, HLTH-03, HLTH-04, ENV-01, ENV-02, ENV-03

**Success Criteria** (what must be TRUE):
  1. Developer clones repo and runs `docker compose up` → all services (postgres, backend, frontend, nginx) start successfully
  2. User accesses port 80 → sees React frontend via Nginx (SPA fallback works for all non-API routes)
  3. User makes API request to /api/* → response from backend through Nginx proxy (no CORS errors)
  4. Backend connects to PostgreSQL successfully (health checks ensure postgres ready before backend)
  5. Services start reliably from cold (`docker compose down -v && docker compose up -d`)
  6. Backend serves health check response at /health endpoint
  7. PostgreSQL container shows healthy status after startup
  8. All image versions are explicitly pinned (no :latest tags)
  9. .dockerignore files prevent __pycache__, node_modules, and .git from bloating images
  10. .env.example documents all required variables; no hardcoded secrets in Dockerfiles or compose files; .env in .gitignore

**Plans**: 1 plan
- [ ] 1-01-PLAN.md — Complete Docker Compose setup with all services

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Base Containerization | 0/1 | Ready to execute | - |

## Coverage

**Requirements Coverage:**
- CONT-01 → Phase 1 ✓
- CONT-02 → Phase 1 ✓
- CONT-03 → Phase 1 ✓
- CONT-04 → Phase 1 ✓
- CONT-05 → Phase 1 ✓
- NET-01 → Phase 1 ✓
- NET-02 → Phase 1 ✓
- NET-03 → Phase 1 ✓
- NET-04 → Phase 1 ✓
- HLTH-01 → Phase 1 ✓
- HLTH-02 → Phase 1 ✓
- HLTH-03 → Phase 1 ✓
- HLTH-04 → Phase 1 ✓
- ENV-01 → Phase 1 ✓
- ENV-02 → Phase 1 ✓
- ENV-03 → Phase 1 ✓

**Total: 15/15 requirements mapped ✓**

---

*Created: 2026-04-12*
