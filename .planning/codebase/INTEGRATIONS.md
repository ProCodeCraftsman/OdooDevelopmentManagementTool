# External Integrations

**Analysis Date:** 2026-04-05

## APIs & External Services

**Odoo Server Integration:**
- Odoo 17 (XML-RPC API) - Module synchronization
  - Client: `app/services/odoo_client.py` (custom xmlrpc.client wrapper)
  - Auth: Username/password per environment
  - Endpoints: `/xmlrpc/2/common`, `/xmlrpc/2/object`
  - Models accessed: `ir.module.module`, `ir.module.module.dependency`
  - Env vars: Per-environment credentials (url, db_name, user, password)

**React Query (Internal API Proxy):**
- Client: `@tanstack/react-query` 5.96.2
- Purpose: Server state management, caching, mutations
- Config: `frontend/src/lib/query-client.ts`

## Data Storage

**Primary Database:**
- PostgreSQL 16
  - Connection: `DATABASE_URL` env var
  - ORM: SQLAlchemy 2.0.0
  - Migrations: Alembic
  - Client: psycopg2-binary
  - Docker image: `postgres:16-alpine` (dev)
  - Docker compose: `backend/docker-compose.yml`

**No file storage:**
- Local filesystem only (module data stored in PostgreSQL)

**No caching layer:**
- In-memory caching via React Query (frontend)
- No Redis/memcached detected

## Authentication & Identity

**JWT Authentication:**
- Implementation: `app/services/auth_service.py`
- Library: python-jose[cryptography]
- Algorithm: HS256
- Expiration: Configurable via `JWT_EXPIRATION_HOURS` (default 24h)
- Token storage: localStorage (frontend)

**Password Security:**
- Hashing: bcrypt via passlib
- Implementation: `app/services/auth_service.py`
- Context: CryptContext with auto-deprecation

**Credential Encryption:**
- Odoo passwords encrypted at rest using Fernet
- Implementation: `app/services/encryption.py`
- Key: `FERNET_KEY` env var
- Used by: `app/repositories/environment.py` (for environment credentials)

## Monitoring & Observability

**No external monitoring:**
- No Sentry, DataDog, or similar error tracking
- No structured logging to external services

**Logging:**
- Python standard logging module
- Console output in development
- Network errors logged client-side via axios interceptor (`frontend/src/lib/api.ts`)

## CI/CD & Deployment

**Containerization:**
- Docker + Docker Compose for local development
- Backend Dockerfile: `backend/Dockerfile`
- Services: postgres + app containers

**No CI/CD pipeline detected:**
- No GitHub Actions, GitLab CI, or similar
- Manual deployment

**Hosting:**
- Not determined (self-hosted based on AGENTS.md patterns)

## Environment Configuration

**Required env vars (Backend):**
```
DATABASE_URL=postgresql://user:pass@host:5432/db
FERNET_KEY=<fernet-encryption-key>
JWT_SECRET_KEY=<jwt-signing-secret>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
APP_ENV=development|production
APP_HOST=0.0.0.0
APP_PORT=8000
APP_DEBUG=true|false
```

**Required env vars (Frontend):**
```
VITE_API_URL=http://localhost:8000/api/v1
```

**Secrets location:**
- `.env` file (backend) - NOT committed
- `.env.example` - committed as template
- localStorage (frontend) - for auth token

## Webhooks & Callbacks

**No incoming webhooks detected**

**No outgoing webhooks configured**

## Security Considerations

**CORS Configuration:**
- Allowed origins: `http://localhost:5173`, `http://localhost:3000`
- Configured in: `backend/app/main.py`
- Should be restricted in production

**SSL/TLS:**
- Odoo XML-RPC connections use SSL with `ssl._create_unverified_context()`
- WARNING: This bypasses certificate verification
- File: `backend/app/services/odoo_client.py` (line 26)

**Credential Storage:**
- Odoo passwords stored encrypted in database
- Decrypted only during sync operations
- JWT tokens stored client-side in localStorage

---

*Integration audit: 2026-04-05*
