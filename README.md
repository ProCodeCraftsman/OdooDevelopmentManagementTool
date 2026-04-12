# GPS Odoo Tracker

GPS Odoo Tracker is a comprehensive operations management system for Odoo 17, combining environment synchronization, module/version auditing, development request tracking, release planning, and role-based access control.

## Quick Start (Docker)

```bash
# Clone and run
git clone https://github.com/ProCodeCraftsman/OdooDevelopmentManagementTool.git
cd OdooDevelopmentManagementTool
docker compose up -d

# Access at http://localhost/
# Login: admin / changeme
```

## Project Structure

This is a monorepo consisting of:

- `backend/`: FastAPI application with SQLAlchemy, PostgreSQL, and Alembic.
- `frontend/`: React 19 + Vite SPA with TypeScript, TanStack Query, Zustand, and Tailwind CSS.
- `nginx/`: Reverse proxy configuration.
- `docs/`: Detailed project documentation.

## Key Features

- **Environment Sync:** Track and audit Odoo modules, versions, and dependencies across multiple environments.
- **Development Requests:** Full lifecycle management for Odoo developments, including technical metadata, comments, and attachments.
- **Release Planning:** Guarded deployment workflows to plan and gate releases between environments.
- **Reporting & Drift:** Automated comparison tools to identify version drift and missing modules.
- **RBAC:** Enterprise-grade permission-based access control.
- **Dashboards:** Operational summaries with KPI cards, workload matrices, and health visualizations.

## Getting Started

### Option 1: Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/ProCodeCraftsman/OdooDevelopmentManagementTool.git
cd OdooDevelopmentManagementTool

# 2. Create .env file
cp .env.example .env

# 3. Start all services
docker compose up -d

# 4. Access the application
# Frontend: http://localhost/
# API: http://localhost/api/v1/
```

**Default login:** `admin` / `changeme`

### Option 2: Local Development

#### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 16+

#### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
alembic upgrade head

# Seed data (optional)
python scripts/seed_roles.py
python scripts/seed_development_request_params.py
python scripts/seed_admin.py

# Start server
uvicorn app.main:app --reload
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## Documentation

For detailed setup and configuration, see:

- [Setup Guide](docs/SETUP.md) - Complete Docker setup and troubleshooting
- [API Documentation](docs/API.md) - API endpoints reference
- [Architecture](docs/ARCHITECTURE.md) - System design

Additional documentation in `docs/`:

- [Project Summary](docs/ProjectSummary.md)
- [Development Requests](docs/DevelopmentRequests.md)
- [Environments and Version Drift](docs/EnvironmentsAndVersionDrift.md)
- [Release Plans](docs/ReleasePlans.md)
- [Settings and Permissions](docs/SettingsAndPermissions.md)
- [Dashboards](docs/Dashboards.md)

## Tech Stack

### Backend
- **Framework:** FastAPI
- **ORM:** SQLAlchemy 2.x
- **Database:** PostgreSQL 16
- **Migrations:** Alembic
- **Auth:** JWT with rotating refresh tokens (httpOnly cookies)

### Frontend
- **Framework:** React 19
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + Radix UI (shadcn/ui style)
- **State Management:** Zustand & TanStack Query v5
- **Icons:** Lucide React

### Infrastructure
- **Container:** Docker Compose
- **Reverse Proxy:** Nginx
- **Database:** PostgreSQL (Alpine)

## Testing

- **Backend:** `pytest`
- **Frontend:** `vitest`

---

Built for Odoo 17 operations management.