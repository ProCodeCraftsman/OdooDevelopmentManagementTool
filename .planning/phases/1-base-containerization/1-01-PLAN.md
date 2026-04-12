---
phase: 1-base-containerization
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements:
  - CONT-02
  - CONT-03
  - CONT-04
  - CONT-05
  - NET-01
  - NET-02
  - NET-03
  - NET-04
  - HLTH-01
  - HLTH-02
  - HLTH-03
  - HLTH-04
  - ENV-01
  - ENV-02
  - ENV-03

must_haves:
  truths:
    - "docker compose up starts all services (postgres, backend, frontend, nginx)"
    - "Port 80 shows React frontend via Nginx with SPA fallback"
    - "/api/* routes to backend through Nginx proxy"
    - "Backend connects to PostgreSQL successfully"
    - "Cold start works reliably"
    - "Backend /health endpoint responds 200"
    - "PostgreSQL shows healthy status"
    - "No :latest tags anywhere"
    - ".dockerignore prevents __pycache__, node_modules, .git"
    - ".env.example documents all variables, no hardcoded secrets, .env in .gitignore"
  artifacts:
    - path: "docker-compose.yml"
      provides: "Root-level orchestration"
      services: ["postgres", "backend", "frontend", "nginx"]
    - path: "backend/Dockerfile"
      provides: "Multi-stage build Python 3.11-slim"
      stages: ["builder", "runner"]
    - path: "frontend/Dockerfile"
      provides: "Multi-stage Node 20 → Nginx"
      stages: ["builder", "runner"]
    - path: "nginx/nginx.conf"
      provides: "Reverse proxy + SPA fallback + caching"
      features: ["proxy_pass /api", "try_files", "cache headers"]
    - path: ".dockerignore (project root)"
      provides: "Exclude build context bloat"
    - path: "backend/.dockerignore"
      provides: "Backend build context"
    - path: "frontend/.dockerignore"
      provides: "Frontend build context"
    - path: ".env.example (root)"
      provides: "Document all environment variables"
  key_links:
    - from: "nginx.conf"
      to: "backend:8000"
      via: "proxy_pass"
      pattern: "location /api/"
    - from: "docker-compose.yml"
      to: "backend/Dockerfile"
      via: "build.context"
      pattern: "build:\\s*context"
    - from: "docker-compose.yml"
      to: "postgres"
      via: "depends_on.condition"
      pattern: "service_healthy"
---

<objective>
Create a complete, production-ready Docker Compose setup that orchestrates all services (PostgreSQL, Backend, Frontend, Nginx) with proper health checks, multi-stage Dockerfiles, and Nginx reverse proxy as the single entry point.
</objective>

<context>
@backend/Dockerfile
@backend/docker-compose.yml
@backend/.env.example

# Existing artifacts to build upon:
# - backend/Dockerfile exists but needs multi-stage upgrade
# - backend/docker-compose.yml has postgres + app services (partial)
# - .env.example at backend/.env.example

# Frontend build details (from frontend/package.json):
# - React 19 with Vite + TypeScript
# - Build command: "npm run build" → outputs to dist/
# - Uses react-router-dom for SPA routing

# Backend health endpoint (from backend/app/main.py):
# - GET /health returns {"status": "healthy"}
# - Runs on port 8000
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create multi-stage Backend Dockerfile</name>
  <files>backend/Dockerfile</files>
  <action>
Replace existing single-stage backend/Dockerfile with multi-stage build:
- Stage 1 (builder): Install build dependencies, copy requirements.txt, run pip install
- Stage 2 (runner): Use python:3.11-slim, copy only installed packages from builder
- Set non-root user for security
- Pin Python version explicitly
- Expose port 8000
- CMD: uvicorn app.main:app --host 0.0.0.0 --port 8000
  </action>
  <verify>
docker build -t test-backend backend/ -f backend/Dockerfile | tail -20
</verify>
  <done>Backend image builds successfully, no :latest tags, smaller than single-stage</done>
</task>

<task type="auto">
  <name>Task 2: Create multi-stage Frontend Dockerfile</name>
  <files>frontend/Dockerfile</files>
  <action>
Create frontend/Dockerfile with multi-stage build:
- Stage 1 (builder): Use node:20-alpine, run npm install, npm run build
- Stage 2 (runner): Use nginx:alpine, copy built artifacts from builder stage
- Configure Nginx to serve static files
- Set non-root user for security
- Expose port 80
- Default CMD serves on port 80
  </action>
  <verify>
docker build -t test-frontend frontend/ -f frontend/Dockerfile && docker run -d -p 8080:80 test-frontend && curl -I http://localhost:8080
</verify>
  <done>Frontend image builds and serves static React app</done>
</task>

<task type="auto">
  <name>Task 3: Create Nginx reverse proxy configuration</name>
  <files>nginx/nginx.conf</files>
  <action>
Create nginx/nginx.conf with:
- Listen on port 80
- Proxy /api/* to backend:8000 (upstream backend)
- Serve static files from /usr/share/nginx/html (React build output)
- SPA fallback: try_files $uri $uri/ /index.html for non-API routes
- Cache headers for static assets: CSS/JS cache 1 year, images cache 1 year
- Health check endpoint at /health (proxied to backend)
  </action>
  <verify>
cat nginx/nginx.conf | grep -E "(proxy_pass|try_files|expires)"
</verify>
  <done>nginx.conf configures proxy, SPA fallback, and caching</done>
</task>

<task type="auto">
  <name>Task 4: Create .dockerignore files</name>
  <files>.dockerignore, backend/.dockerignore, frontend/.dockerignore</files>
  <action>
Create .dockerignore files to prevent build context bloat:
- Project root .dockerignore: excludes .git, .planning, *.md, .DS_Store
- backend/.dockerignore: excludes __pycache__, *.pyc, .env, *.log, venv/
- frontend/.dockerignore: excludes .git, node_modules, .src, *.ts, *.tsx, .env
  </action>
  <verify>
cat .dockerignore | head -10
</verify>
  <done>.dockerignore files exist in root, backend, and frontend</done>
</task>

<task type="auto">
  <name>Task 5: Update .env.example for root level</name>
  <files>.env.example</files>
  <action>
Create root-level .env.example documenting:
- POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
- DATABASE_URL (auto from postgres vars)
- FERNET_KEY, JWT_SECRET_KEY
- JWT_ALGORITHM, JWT_EXPIRATION_HOURS
- APP_ENV, APP_HOST, APP_PORT, APP_DEBUG
- Include generation commands as comments
  </action>
  <verify>
cat .env.example
</verify>
  <done>.env.example exists at project root, documents all variables</done>
</task>

<task type="auto">
  <name>Task 6: Create root-level docker-compose.yml</name>
  <files>docker-compose.yml</files>
  <action>
Create root docker-compose.yml with all 4 services:

1. postgres: postgres:16-alpine with health check (pg_isready)
2. backend: build from backend/Dockerfile, depends on service_healthy postgres
3. frontend: build from frontend/Dockerfile, depends on backend
4. nginx: nginx:alpine with custom config, proxy all /api to backend, depends on frontend

Environment: Use .env file, no hardcoded secrets
Volumes: Named volume for postgres_data
Ports: 80 (nginx), not 8000 or 3000 directly exposed
Health checks: postgres (pg_isready), backend (HTTP /health), nginx (TCP 80)

Key configurations:
- All images pinned (e.g., postgres:16-alpine, not postgres:latest)
- depends_on uses condition: service_healthy
- restart: unless-stopped for production behavior
  </action>
  <verify>
docker compose config --services
</verify>
  <done>root docker-compose.yml defines all 4 services with proper dependencies</done>
</task>

<task type="auto">
  <name>Task 7: Verify .gitignore contains .env</name>
  <files>.gitignore</files>
  <action>
Confirm .env is in .gitignore - existing .gitignore already contains ".env" on line 24.
No action needed - this requirement met by existing .gitignore.
  </action>
  <verify>
grep -n "\.env" .gitignore
</verify>
  <done>.env in .gitignore verified</done>
</task>

<task type="checkpoint:human-verify">
  <what-built>Complete containerized stack ready for docker compose up</what-built>
  <how-to-verify>
    # Step 1: Build all images (no cache)
    docker compose build --no-cache

    # Step 2: Start all services
    docker compose up -d

    # Step 3: Wait for health checks
    docker compose ps  # All should show "healthy"

    # Step 4: Test Nginx serves React frontend
    curl -I http://localhost/  # Should return 200

    # Step 5: Test SPA fallback works (non-API route)
    curl http://localhost/any-unknown-route  # Should return React index.html

    # Step 6: Test API proxy works
    curl http://localhost/api/v1/  # Should return backend response or 401 (not 502)

    # Step 7: Test backend health endpoint
    curl http://localhost/health  # Should return {"status":"healthy"}

    # Step 8: Test cold start (destroy volumes, restart)
    docker compose down -v
    docker compose up -d
    # Wait and verify all services become healthy
    docker compose ps
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Internet → Nginx:80 | All external traffic enters through Nginx proxy |
| Nginx → Backend:8000 | Nginx proxies API requests, no direct external access |
| Backend → PostgreSQL:5432 | Backend connects to database, no external exposure |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-CONT-01 | Information Disclosure | .env file in image | mitigate | Ensure .dockerignore excludes .env, verify .env not in context |
| T-CONT-02 | Denial of Service | No resource limits | accept | Phase 1.2 (Production Hardening) will add limits |
| T-HLTH-01 | Race Condition | Backend starts before DB | mitigate | Use depends_on with service_healthy condition |
| T-NET-01 | Path Traversal | Nginx serving static | mitigate | Nginx default config prevents ../ traversal |
| T-NET-02 | Proxy Timeout | Upstream failures | accept | Default Nginx timeouts acceptable for v1 |
</threat_model>

<verification>
# Requirements mapping to tasks:

| Requirement | Task | Verification |
|-------------|------|-------------|
| CONT-01 | Task 6 | docker compose up starts postgres, backend, frontend, nginx |
| CONT-02 | Task 1 | Multi-stage backend/Dockerfile exists |
| CONT-03 | Task 2 | Multi-stage frontend/Dockerfile exists |
| CONT-04 | Tasks 1,2 | No :latest tags in Dockerfiles |
| CONT-05 | Task 4 | .dockerignore files exist in root, backend, frontend |
| NET-01 | Task 3 | nginx.conf proxies /api/* to backend:8000 |
| NET-02 | Task 3 | nginx.conf has try_files for SPA fallback |
| NET-03 | Task 3 | nginx.conf sets expires headers |
| NET-04 | Task 6 | nginx is single entry on port 80 |
| HLTH-01 | Task 6 | postgres healthcheck: pg_isready |
| HLTH-02 | Task 6 | backend healthcheck: HTTP /health |
| HLTH-03 | Task 6 | depends_on uses service_healthy |
| HLTH-04 | Task 6 | Cold start test in checkpoint |
| ENV-01 | Task 5 | root .env.example exists |
| ENV-02 | Tasks 1,2,6 | No hardcoded secrets in Dockerfiles/compose |
| ENV-03 | Task 7 | .env in .gitignore |
</verification>

<success_criteria>
All 10 success criteria from ROADMAP.md:
1. docker compose up starts all 4 services ✓
2. Port 80 shows React frontend via Nginx ✓
3. /api/* routes to backend ✓
4. Backend connects to PostgreSQL ✓
5. Cold start works ✓
6. Backend /health responds ✓
7. PostgreSQL shows healthy ✓
8. No :latest tags ✓
9. .dockerignore prevents bloat ✓
10. .env.example exists, no hardcoded secrets, .env in .gitignore ✓
</success_criteria>

<output>
After completion, create `.planning/phases/1-base-containerization/1-01-SUMMARY.md`
</output>