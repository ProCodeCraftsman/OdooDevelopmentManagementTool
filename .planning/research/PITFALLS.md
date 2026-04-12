# Pitfalls Research

**Domain:** Docker Compose monorepo containerization (React + FastAPI + PostgreSQL)
**Researched:** 2026-04-12
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Service Startup Race Conditions

**What goes wrong:**
FastAPI backend starts before PostgreSQL is ready, crashes with "connection refused" error, and never recovers. Developers see intermittent failures where the stack sometimes works and sometimes doesn't.

**Why it happens:**
`depends_on` only waits for the container to START, not for the service to be READY. PostgreSQL can be running but not accepting connections yet. This is especially problematic in monorepos where the backend is quick to start.

**How to avoid:**
```yaml
services:
  backend:
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s
```

**Warning signs:**
- "connection refused" in backend logs on startup
- Intermittent CI failures
- Works on developer machine but fails in CI
- Backend container shows "Exit 1" immediately after starting

**Phase to address:**
**Phase 1: Base Containerization** — Health checks must be implemented in the initial Docker Compose setup, not added later.

---

### Pitfall 2: Volume Mounts Hiding Built Dependencies

**What goes wrong:**
After building the image successfully, the backend crashes with "MODULE_NOT_FOUND" or "No module named 'fastapi'" errors. This happens when you add development volume mounts.

**Why it happens:**
When you mount a volume like `./backend:/app`, it OVERWRITES the entire `/app` directory in the container — including the `node_modules` or installed Python packages that were just built. The host's `backend/` directory (without dependencies) replaces the image's `/app` directory (with dependencies).

**How to avoid:**
```yaml
# WRONG - hides dependencies
services:
  backend:
    build: ./backend
    volumes:
      - ./backend:/app  # This hides node_modules!

# CORRECT - use anonymous volume to protect image layers
services:
  backend:
    build: ./backend
    volumes:
      - /app/node_modules  # Anonymous volume preserves this path
      - ./backend:/app     # But allows code editing
```

For Python/FastAPI, use a similar pattern or mount specific subdirectories:
```yaml
volumes:
  - ./backend/app:/app/app      # Mount only source, not entire app
  - backend_python_cache:/root/.cache/pip
```

**Warning signs:**
- `MODULE_NOT_FOUND` or `No module named` errors after successful build
- Works in production but fails in development with volume mounts
- Removing volumes makes it work

**Phase to address:**
**Phase 1: Base Containerization** — Use correct volume mount patterns from the start. This is painful to debug and fix after development patterns are established.

---

### Pitfall 3: Build Context Path Issues in Monorepos

**What goes wrong:**
Docker build fails with "COPY failed: file not found" or builds successfully but copies wrong files. Services end up with incomplete code.

**Why it happens:**
Setting `context: ./backend` means COPY commands in the Dockerfile start from `./backend/`. If your Dockerfile has `COPY ./requirements.txt .`, it looks for `./backend/requirements.txt`. In a monorepo with shared dependencies, this breaks.

**How to avoid:**
```yaml
# For monorepo with shared code
services:
  backend:
    build:
      context: .                          # Root of monorepo
      dockerfile: ./backend/Dockerfile    # Point to correct Dockerfile
    volumes:
      - ./backend:/app/backend            # Mount at subdirectory
      - ./shared:/app/shared             # Mount shared code too
```

Alternative: Use separate Dockerfiles per service with proper context:
```yaml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      # COPY commands in backend/Dockerfile work from ./backend/
```

**Warning signs:**
- "file not found" during COPY commands
- Services missing shared code
- Build works locally but fails in CI (different paths)
- Services getting wrong version of shared modules

**Phase to address:**
**Phase 1: Base Containerization** — Define build context strategy upfront. Changing it later requires rebuilding all images.

---

### Pitfall 4: Missing Health Checks Leading to Unreliable Stacks

**What goes wrong:**
Services appear "running" in `docker compose ps` but are actually unhealthy. The application returns 500 errors but Docker reports everything is fine.

**Why it happens:**
Without health checks, Docker only knows if a container process is running, not if it's working. A FastAPI app that crashes internally but doesn't exit, or a database with corrupted files, will show as "healthy" to Docker.

**How to avoid:**
```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
```

**Warning signs:**
- Services "running" but returning errors
- `docker compose ps` shows all green but app is broken
- Health checks not implemented
- No `/health` endpoint in FastAPI app

**Phase to address:**
**Phase 1: Base Containerization** — Health checks are foundational. Add `/health` endpoint to FastAPI and configure health checks immediately.

---

### Pitfall 5: Hardcoded Credentials and Secrets in Compose Files

**What goes wrong:**
Production database passwords, API keys, and JWT secrets end up in Docker Compose files, which get committed to Git and eventually leak.

**Why it happens:**
It's easy to add `POSTGRES_PASSWORD: mysecretpassword123` directly in the compose file. Developers forget to move it to a `.env` file or secrets manager.

**How to avoid:**
```yaml
# docker-compose.yml - NO secrets here
services:
  backend:
    env_file:
      - .env

# .env - NOT committed to git
POSTGRES_PASSWORD=actual_secret_here
JWT_SECRET=another_secret

# .gitignore
.env
.env.*
!.env.example
```

For production, use Docker secrets:
```yaml
services:
  db:
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

**Warning signs:**
- Secrets in docker-compose.yml
- .env file committed to git
- Same credentials in all environments
- No `.gitignore` for .env files

**Phase to address:**
**Phase 1: Base Containerization** — Establish secret management from day one. Retrofitting is error-prone.

---

### Pitfall 6: Using `:latest` or Unpinned Image Tags

**What goes wrong:**
Your staging and production environments run different versions of PostgreSQL or Node. What worked in development suddenly fails in production. Automated builds produce non-reproducible results.

**Why it happens:**
`image: postgres:latest` or `image: node:alpine` means "give me whatever is newest." This changes over time, sometimes breaking your application.

**How to avoid:**
```yaml
# WRONG
services:
  db:
    image: postgres:latest
  backend:
    image: node:alpine

# CORRECT - Pin exact versions
services:
  db:
    image: postgres:16.2-alpine
  backend:
    image: node:20.13-alpine
```

**Warning signs:**
- `image: postgres:latest` or `image: nginx:latest`
- `image: node:alpine` without version
- Works on one machine, fails on another
- CI failures that don't reproduce locally

**Phase to address:**
**Phase 1: Base Containerization** — Pin all image versions. This ensures reproducibility across environments.

---

### Pitfall 7: Missing Resource Limits

**What goes wrong:**
A runaway process in one container consumes all RAM or CPU, crashing the entire host. All containers become unresponsive. No visibility into which container caused the problem.

**Why it happens:**
Docker containers, by default, can use unlimited resources. Without explicit limits, one misbehaving service takes down everything.

**How to avoid:**
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 256M

  db:
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2G
```

Resource guidelines for this stack:
| Service | CPU Limit | Memory Limit |
|---------|-----------|--------------|
| React Frontend | 0.5-1.0 | 256M-512M |
| FastAPI Backend | 0.5-2.0 | 512M-1G |
| PostgreSQL | 1.0-4.0 | 1G-4G |

**Warning signs:**
- No `deploy.resources` in compose files
- No monitoring of container resource usage
- Containers without limits in production
- `docker stats` shows unexpected resource usage

**Phase to address:**
**Phase 2: Production Hardening** — Resource limits are essential for production. Set appropriate limits based on actual usage patterns.

---

### Pitfall 8: Development Compose File Used in Production

**What goes wrong:**
Production environment uses bind mounts for code, exposing source code. Services don't restart properly. Logs flood disk. Permissions are wrong.

**Why it happens:**
Using the same `docker-compose.yml` for development and production. Development needs volume mounts for hot-reload; production needs baked-in code and proper restart policies.

**How to avoid:**
Use Docker Compose override files:

```yaml
# docker-compose.yml - Base configuration (committed to git)
services:
  backend:
    build: ./backend
    restart: unless-stopped
  db:
    image: postgres:16.2-alpine
    restart: unless-stopped
```

```yaml
# docker-compose.override.yml - Local dev only (NOT committed)
services:
  backend:
    volumes:
      - ./backend:/app/backend
    environment:
      - DEBUG=true
  db:
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
```

```yaml
# docker-compose.prod.yml - Production settings
services:
  backend:
    image: myapp/backend:${IMAGE_TAG}
    env_file:
      - ./prod.env
  db:
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Start with:
```bash
# Development
docker compose up -d

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Warning signs:**
- Single monolithic docker-compose.yml
- Bind mounts (`./data:/var/lib/postgresql/data`) in committed files
- Source code volume mounts in production
- Debug environment variables in production

**Phase to address:**
**Phase 2: Production Hardening** — Separate development and production configurations from the start.

---

### Pitfall 9: Missing `.dockerignore` Files

**What goes wrong:**
Docker builds take forever because thousands of node_modules, .git directory, and development files are copied into the build context. Image size balloons.

**Why it happens:**
Without `.dockerignore`, Docker copies everything in the build context, including large directories that should be excluded.

**How to avoid:**
Create `.dockerignore` at project root:
```
# Dependencies
**/node_modules
**/__pycache__
**/*.pyc
**/.venv
**/venv

# Git
**/.git
**/.gitignore

# IDE
**/.idea
**/.vscode
**/*.swp

# Development files
**/*.log
**/.env
**/.env.*
!**/.env.example

# Testing
**/coverage
**/.pytest_cache
**/test
**/tests

# Docker
**/Dockerfile
**/docker-compose.yml
**/.dockerignore

# Documentation
**/README.md
**/docs
```

**Warning signs:**
- `docker build` takes minutes for small changes
- Image size is unexpectedly large
- node_modules appear in image
- Build context size is huge

**Phase to address:**
**Phase 1: Base Containerization** — Create `.dockerignore` before first build. This is foundational.

---

### Pitfall 10: No Restart Policy = Dead Containers

**What goes wrong:**
Container exits with an error and stays dead. Developers don't notice until users report issues.

**Why it happens:**
Default restart policy is `no` — containers never restart automatically. In development this is fine; in production it's a disaster.

**How to avoid:**
```yaml
# Production
services:
  backend:
    restart: unless-stopped    # Restart on crash, don't restart if manually stopped

  db:
    restart: always          # Always restart (databases should always be running)

# Development
services:
  backend:
    restart: no              # Manual control in dev
```

**Warning signs:**
- No `restart` key in service definitions
- Containers not restarting after host reboot
- Production services staying down after crashes

**Phase to address:**
**Phase 2: Production Hardening** — Add restart policies as part of production hardening, not as an afterthought.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip `.dockerignore` | Faster file creation | Slow builds, huge images | Never |
| Use `latest` tag | Less maintenance initially | Non-reproducible builds | Only for throwaway dev containers |
| Skip health checks | Faster initial setup | Unreliable stack, hard debugging | Never |
| Single compose file | Simpler initial setup | No dev/prod separation | Only for single-use prototypes |
| Root user in containers | No permission issues | Security vulnerability | Never |
| Expose database port publicly | Easier debugging | Security risk | Only localhost dev, never prod |
| No resource limits | No OOM errors initially | Host-wide resource exhaustion | Only for single-tenant dev |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Frontend → Backend | Hardcoding `localhost:8000` | Use service name: `http://backend:8000` |
| Backend → PostgreSQL | Using `localhost:5432` | Use `postgresql://db:5432/app` (service name) |
| Environment variables | Different names in Docker vs host | Use `.env` file for consistency |
| CORS | Not configuring for Docker network | Set `CORS_ORIGINS` to include backend service name |
| HTTPS termination | Handling TLS in containers | Terminate TLS at reverse proxy (Traefik/nginx), not in app |
| Database migrations | Running on container start | Use init containers or startup scripts with health check dependencies |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded log output | Disk fills up, containers crash | Configure log rotation: `logging.driver: json-file` + `logging.options: max-size: 10m` | After ~1 week of running |
| No resource limits on DB | PostgreSQL OOM kills other containers | Set memory limits | Under memory pressure |
| Rebuilding all services on any change | Slow CI/CD | Use `depends_on` with `condition: service_healthy` and `--build` flag only when needed | In CI/CD pipelines |
| Large build context | Slow builds | Use `.dockerignore` and narrow context | First build in CI |
| No volume caching | Slow database queries | Use named volumes, not bind mounts | After container restart (data loss) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Running as root | Container breakout gives root on host | `USER` directive in Dockerfile, run as non-root |
| Exposing internal ports publicly | Database accessible to internet | Only expose frontend port; use `expose` not `ports` for internal |
| Secrets in environment variables | Leaked in logs, images | Use Docker secrets or secret files |
| No network isolation | Compromised service can reach all services | Use separate networks for frontend/backend/data |
| Not updating base images | Known CVEs in dependencies | Regularly rebuild with updated base images |
| COPY with wildcards from untrusted sources | Supply chain attack | Pin base images, use checksums for dependencies |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No startup logs | Developers don't know what's happening | Use `docker compose up` (attached) for first run |
| Missing /health endpoint | No way to verify service health | Add health endpoint, document it |
| No health check for backend | Can't distinguish "starting" from "ready" | Implement health checks immediately |
| Inconsistent service names | Confusion about which service to call | Use consistent naming: `frontend`, `backend`, `db` |
| No `.env.example` | Developers don't know required env vars | Provide template with all required variables |

---

## "Looks Done But Isn't" Checklist

- [ ] **Containerization:** Images build successfully — verify with `docker compose up -d && docker compose logs` and ensure no crashes
- [ ] **Health checks:** Containers show healthy status — verify with `docker compose ps` showing "(healthy)"
- [ ] **Startup order:** Stack survives `docker compose down -v && docker compose up -d` — cold start works
- [ ] **Secrets:** No secrets in docker-compose.yml — verify with `git grep` for passwords/keys
- [ ] **Resource limits:** All services have limits — verify with `docker compose config` and check `deploy.resources`
- [ ] **Volume strategy:** Named volumes for PostgreSQL data — verify with `docker compose config` for `volumes:` section
- [ ] **Network isolation:** Services on appropriate networks — verify with `docker network inspect`
- [ ] **Restart policies:** Production services have restart policy — verify with `docker compose config`
- [ ] **CORS configuration:** Backend CORS allows frontend — test with actual frontend container
- [ ] **Environment variables:** All services work with `.env` file — verify by removing .env and checking for errors

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Race condition startup | LOW | Add health checks + `condition: service_healthy` |
| Volume mount hiding deps | MEDIUM | Remove volume mounts, rebuild, add anonymous volumes |
| Wrong build context | MEDIUM | Fix context paths, force rebuild with `--no-cache` |
| Secrets in git | HIGH | Rotate secrets immediately, clean git history (if possible) |
| Using latest tag | LOW | Pin versions, rebuild |
| Root user security issue | MEDIUM | Add non-root user to Dockerfile, rebuild |
| Wrong network config | LOW | Update compose file, recreate containers with `--force-recreate` |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Service startup race conditions | Phase 1: Base Containerization | Cold start test: `docker compose down -v && docker compose up -d` |
| Volume mount hiding deps | Phase 1: Base Containerization | Verify with `docker compose exec backend pip list` after volume mount |
| Build context issues | Phase 1: Base Containerization | Verify images build correctly in CI |
| Missing health checks | Phase 1: Base Containerization | `docker compose ps` shows "(healthy)" status |
| Hardcoded secrets | Phase 1: Base Containerization | `git grep` for passwords, check committed files |
| Using latest tag | Phase 1: Base Containerization | All images have specific version tags |
| Missing resource limits | Phase 2: Production Hardening | Review compose config for `deploy.resources` |
| Dev file in production | Phase 2: Production Hardening | Production compose uses only base + prod files |
| Missing .dockerignore | Phase 1: Base Containerization | Build context size reasonable |
| No restart policy | Phase 2: Production Hardening | Production services have restart policy |

---

## Sources

- [Your Docker Compose File Is Probably Wrong — 7 Mistakes](https://dev.to/0012303/your-docker-compose-file-is-probably-wrong-7-mistakes-i-see-in-every-project-p05) — Community discussion on common Compose mistakes
- [Docker Compose v2 Breaking Changes](https://zeonedge.com/am/blog/docker-compose-v2-breaking-changes-guide) — Migration issues from v1 to v2
- [How we actually use Docker Compose in 2025](https://toxigon.com/docker-compose-best-practices-2025) — Production best practices
- [Docker Compose Production Setup Guide 2026](https://ztabs.co/blog/docker-compose-production-setup) — Production configuration
- [Docker Compose Production Guide: Multi-Container Apps Done Right](https://use-apify.com/blog/docker-compose-production-guide) — Production checklist
- [Multi-Stage Dockerfiles for Monorepos](https://oneuptime.com/blog/post/2026-01-30-docker-multi-stage-monorepos/view) — Monorepo-specific patterns
- [Stack Overflow: Monorepo Docker Compose setup](https://stackoverflow.com/questions/77377191/how-to-set-up-docker-compose-with-monorepo-structure) — Common monorepo issues

---
*Pitfalls research for: Docker Compose monorepo containerization (React + FastAPI + PostgreSQL)*
*Researched: 2026-04-12*
