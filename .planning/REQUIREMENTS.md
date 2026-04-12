# Requirements: GPS Odoo Tracker

**Defined:** 2026-04-20  
**Core Value:** Accurately track Odoo module versions across environments and enable safe, validated release deployments through automated drift detection.

> Note: Previous requirements archived to milestones/v1.0-REQUIREMENTS.md

## v2 Requirements

### Development Experience

- [ ] **DEV-01**: docker-compose.override.yml enables hot reload for backend and frontend
- [ ] **DEV-02**: Vite HMR works inside container with volume mounts
- [ ] **DEV-03**: Alembic migration runner script available

### Production Hardening

- [ ] **PROD-01**: docker-compose.prod.yml for production deployment
- [ ] **PROD-02**: Resource limits on all services (CPU/memory)
- [ ] **PROD-03**: Restart policies (unless-stopped)
- [ ] **PROD-04**: Log rotation configuration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-environment compose | Over-engineered for current team |
| Docker secrets | .env approach sufficient |
| CI/CD pipeline | Separate concern |
| Traefik | Adds complexity |
| Kubernetes | Future after Docker validated |

---

*Starting fresh for v2: 2026-04-20*