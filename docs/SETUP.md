# Setup Guide

This guide covers how to set up the GPS Odoo Tracker application locally using Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+
- At least 4GB available RAM
- Ports 80 and 5432 available

## Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd OdooDevelopmentManagementTool

# 2. Generate environment variables (or copy from .env.example)
cp .env.example .env

# 3. Start all services
docker compose up -d

# 4. Verify services are running
docker compose ps
```

After startup, access the application at:
- **Frontend**: http://localhost/
- **API**: http://localhost/api/v1/

## Default Credentials

The seeding process creates a default admin user:
- **Username**: `admin`
- **Password**: `changeme`

> **Important**: Change the default password immediately after first login.

## Services Architecture

| Service | Port | Description |
|---------|-----|-------------|
| nginx | 80 | Reverse proxy, serves frontend + API |
| frontend | 80 (internal) | React SPA built assets |
| backend | 8000 | FastAPI application |
| postgres | 5432 | PostgreSQL 16 database |

## Domain Configuration

### Option 1: Local Development (No Domain)

The default `.env` configuration works for local development access via `http://localhost`.

### Option 2: Custom Domain

To use a custom domain:

1. Update `.env`:
```bash
# Replace nginx config - see nginx/nginx.conf
# Update FRONTEND_URLS to your domain
FRONTEND_URLS=https://your-domain.com
```

2. For HTTPS, you'll need to configure SSL certificates. A common approach:

```bash
# Create certificates directory
mkdir -p nginx/ssl

# Generate self-signed certificate (for development)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/server.key \
  -out nginx/ssl/server.crt
```

3. Update nginx configuration for HTTPS in `nginx/nginx.conf`:

```nginx
server {
    listen 443 ssl;
    server_name _;
    
    ssl_certificate /etc/nginx/ssl/server.crt;
    ssl_certificate_key /etc/nginx/ssl/server.key;
    
    # ... rest of config
}
```

### Option 3: Production Domain (with reverse proxy)

For production deployments behind a reverse proxy (nginx, traefik, etc.):

1. Configure your upstream to point to the nginx container
2. Update CORS settings in backend:
```bash
FRONTEND_URLS=https://your-production-domain.com
```

## Environment Variables

Create a `.env` file from the template:

```bash
# Database
POSTGRES_USER=odoo_auditor
POSTGRES_PASSWORD=change_me_in_production
POSTGRES_DB=odoo_auditor

# Backend
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

# Security - generate new keys for production
FERNET_KEY=<generate-fernet-key>
JWT_SECRET_KEY=<generate-jwt-secret>

# Access
FRONTEND_URLS=http://localhost:80
APP_DEBUG=false
```

### Generating Security Keys

```bash
# Generate Fernet key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Generate JWT secret (use a long random string)
openssl rand -base64 32
```

## Database Seeding

On first startup, the container automatically:

1. Runs Alembic migrations to create tables
2. Seeds roles (7 predefined roles)
3. Seeds control parameters (request types, states, priorities)
4. Creates admin user
5. Imports development requests from `Data/import_ready.json` (155 records)

This is idempotent - subsequent startups skip seeding if data exists.

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs backend

# Common issues:
# - Port conflicts: stop other services using ports 80/5432
# - Database not ready: wait for postgres health check
```

### Login Fails

Verify the admin user was created:
```bash
docker compose exec postgres psql -U odoo_auditor -d odoo_auditor -c "SELECT username FROM users;"
```

### Database Connection Errors

Check DATABASE_URL format in `.env`:
```
DATABASE_URL=postgresql://user:password@host:port/dbname
```

The host should be `postgres` (Docker service name), not `localhost`.

### Rebuild After Changes

```bash
# Full rebuild
docker compose down -v
docker compose build
docker compose up -d
```

## Development Commands

```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs -f backend
docker compose logs -f nginx

# Execute commands in container
docker compose exec backend python scripts/seed_admin.py
docker compose exec backend alembic upgrade head

# Database access
docker compose exec postgres psql -U odoo_auditor -d odoo_auditor

# Stop all services
docker compose down

# Stop and remove volumes (fresh start)
docker compose down -v
```

## Seeded Data

The application comes pre-seeded with:

- **7 Roles**: Super Admin, Product Manager, Release Manager, Server Admin, Developer, QA/Tester, View Only
- **8 Request Types**: Feature Request, Bug Report, Report Generation, UI/UX, Master Data, Performance Issue, Transactional Data, Configurations
- **10 Request States**: Draft, In Progress, Ready, Done, Cancelled states
- **12 Functional Categories**: Finance, PO, Budget, Payment, Sales, Expense, PR, Project, Inventory, HR, GST modules
- **4 Priorities**: Low, Medium, High, Urgent
- **155 Development Requests**: Imported from import data

---

For API documentation, see [API.md](API.md).
For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).