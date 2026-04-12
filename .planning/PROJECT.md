# GPS Odoo Tracker

## What This Is

A full-stack application for managing Odoo 17 module synchronization across multiple environments with RBAC (Role-Based Access Control). Provides a secure, queryable release management engine for tracking module versions, drift detection, and release planning.

## Core Value

Accurately track Odoo module versions across environments and enable safe, validated release deployments through automated drift detection.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## Requirements

### Validated

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] **Containerize backend** — Add multi-stage Dockerfile for FastAPI backend
- [ ] **Containerize frontend** — Add multi-stage Dockerfile with Nginx for React frontend
- [ ] **Orchestrate with Compose** — Root-level docker-compose.yml coordinating all services
- [ ] **Configure Nginx reverse proxy** — Single entry point routing /api/* to backend, /* to frontend
- [ ] **Add health checks** — PostgreSQL and backend health checks with depends_on ordering
- [ ] **Create .dockerignore** — Prevent monorepo build bloat
- [ ] **Create .env.example** — Document required environment variables

### Out of Scope

- Multi-environment compose files (staging, UAT, production) — defer to future milestone
- Docker secrets — over-engineered for current team size
- CI/CD pipeline integration — separate from local containerization
- Hot reload development — Phase 2 item
- Production hardening (resource limits, restart policies) — Phase 3 item

## Context

**Current stack:**
- Frontend: React 18 + Vite + TypeScript + React Query + Zustand + TailwindCSS
- Backend: FastAPI + SQLAlchemy 2.0 + Pydantic v2 + Alembic
- Database: PostgreSQL
- External API: XML-RPC to Odoo 17

**Existing Docker setup:**
- Backend has basic `Dockerfile` (single-stage, needs upgrade)
- No frontend Docker setup
- No root-level orchestration

**Key architectural decision from research:**
- Nginx reverse proxy as single entry point (eliminates CORS complexity)
- Root-level `docker-compose.yml` for unified orchestration
- Health checks with `condition: service_healthy` to prevent startup race conditions

## Constraints

- **Tech stack**: Must use Docker Compose v2.x (native YAML), PostgreSQL 16, Nginx 1.25-alpine, Python 3.11-slim, Node.js 20-alpine
- **No :latest tags**: All image versions must be pinned
- **Environment**: All secrets via .env file, never hardcoded

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Nginx reverse proxy | Eliminates CORS, single entry point, production-realistic | ✓ Good |
| Root-level docker-compose.yml | Unifies monorepo orchestration, clear entry point | ✓ Good |
| Multi-stage Dockerfiles | Smaller production images, security | ✓ Good |
| Health checks required | Prevents race conditions on startup | ✓ Good |

---
*Last updated: 2026-04-12 after v1.0 milestone started*
