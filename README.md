# GPS Odoo Tracker

GPS Odoo Tracker is a comprehensive operations management system for Odoo 17, combining environment synchronization, module/version auditing, development request tracking, release planning, and role-based access control.

## Project Structure

This is a monorepo consisting of:

- `backend/`: FastAPI application with SQLAlchemy, PostgreSQL, and Alembic.
- `frontend/`: React 19 + Vite SPA with TypeScript, TanStack Query, Zustand, and Tailwind CSS.
- `docs/`: Detailed project documentation and architecture artifacts.

## Key Features

- **Environment Sync:** Track and audit Odoo modules, versions, and dependencies across multiple environments.
- **Development Requests:** Full lifecycle management for Odoo developments, including technical metadata, comments, and attachments.
- **Release Planning:** Guarded deployment workflows to plan and gate releases between environments.
- **Reporting & Drift:** Automated comparison tools to identify version drift and missing modules.
- **RBAC:** Enterprise-grade permission-based access control.
- **Dashboards:** Operational summaries with KPI cards, workload matrices, and health visualizations.

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 20+
- PostgreSQL
- Docker & Docker Compose (optional)

### Backend Setup

1. Navigate to the `backend/` directory.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up your environment variables (copy `.env.example` to `.env` if available).
5. Run migrations:
   ```bash
   alembic upgrade head
   ```
6. Start the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup

1. Navigate to the `frontend/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Documentation

For more detailed information, refer to the files in the `docs/` directory:

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
- **Database:** PostgreSQL
- **Migrations:** Alembic
- **Auth:** JWT with rotating refresh tokens (httpOnly cookies)

### Frontend
- **Framework:** React 19
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + Radix UI (shadcn/ui style)
- **State Management:** Zustand & TanStack Query v5
- **Icons:** Lucide React

## Testing

- **Backend:** `pytest`
- **Frontend:** `vitest`

---

Built for Odoo 17 operations management.
