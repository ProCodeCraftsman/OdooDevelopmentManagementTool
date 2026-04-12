# Roadmap: GPS Odoo Tracker

## Overview

Enable hot development workflow for local development with file watching and HMR.

## Milestones

- ✅ **v1.0 Docker Compose** - Containerization complete (see milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Development Experience** - Hot reload, override files
- 📋 **v1.2 Production Hardening** - Resource limits, restart policies

## Phases

- [x] **Phase 1: Base Containerization** - Docker Compose with health checks, multi-stage builds, Nginx proxy (complete)
- [ ] **Phase 2: Development Experience** - Hot reload with volumes and HMR

## Phase Details

### Phase 2: Development Experience

**Goal**: Developer can run `docker compose -f docker-compose.yml -f docker-compose.override.yml up` for hot development

**Depends on**: Phase 1 (v1.0)

**Requirements**: DEV-01, DEV-02, DEV-03

**Success Criteria** (what must be TRUE):
1. Override file enables hot reload without rebuild
2. Backend files changed → uvicorn auto-reloads (volume mount)
3. Frontend files changed → Vite HMR updates (volume mount)
4. `docker compose up` still works for production (base file unchanged)
5. No .dockerignore blocking volume mounts

**Plans**: 1 plan
- [ ] 2-01-PLAN.md — Development Experience with hot reload

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Base Containerization | 1/1 | Complete | 2026-04-20 |
| 2. Development Experience | 0/1 | Ready to execute | - |

## Coverage

**Requirements Coverage:**
- DEV-01 → Phase 2 ✓
- DEV-02 → Phase 2 ✓
- DEV-03 → Phase 2 ✓

**Total: 3/3 requirements mapped ✓**

---

*Created: 2026-04-20 for v1.1*