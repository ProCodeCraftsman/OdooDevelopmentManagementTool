# AGENTS.md - Odoo Release Management Backend
## Project Overview
**Odoo Module Dependency & Version Auditor** - A full-stack application for synchronizing Odoo 17 module data across multiple environments, featuring a React frontend with RBAC.

**Current State**: FastAPI backend with React frontend, PostgreSQL database, Development Request module
**Architecture**: React + FastAPI + PostgreSQL (monorepo with frontend/ and backend/)
---

## Project Structure

```
.
├── backend/                    # FastAPI Python backend
│   ├── alembic/
│   │   └── versions/          # Database migrations
│   ├── app/
│   │   ├── api/v1/            # FastAPI routes
│   │   │   ├── auth.py
│   │   │   ├── development_requests.py
│   │   │   ├── environments.py
│   │   │   ├── reports.py
│   │   │   ├── roles.py
│   │   │   ├── sync.py
│   │   │   └── users.py
│   │   ├── core/              # Config, security, database
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── security_matrix.py
│   │   │   └── deps.py
│   │   ├── models/            # SQLAlchemy models
│   │   │   ├── base.py
│   │   │   ├── user.py
│   │   │   ├── role.py
│   │   │   ├── environment.py
│   │   │   ├── module.py
│   │   │   ├── sync_record.py
│   │   │   ├── development_request.py
│   │   │   └── control_parameters/
│   │   │       ├── request_state.py
│   │   │       ├── request_type.py
│   │   │       ├── priority.py
│   │   │       └── functional_category.py
│   │   ├── repositories/      # Database CRUD operations
│   │   │   ├── base.py
│   │   │   ├── user.py
│   │   │   ├── role.py
│   │   │   ├── environment.py
│   │   │   ├── module.py
│   │   │   ├── sync_record.py
│   │   │   └── development_request.py
│   │   ├── schemas/           # Pydantic validation models
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── role.py
│   │   │   ├── environment.py
│   │   │   ├── sync.py
│   │   │   ├── report.py
│   │   │   └── development_request.py
│   │   ├── services/          # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── encryption.py
│   │   │   ├── odoo_client.py
│   │   │   ├── comparer.py
│   │   │   ├── sync_service.py
│   │   │   └── development_request_service.py
│   │   └── main.py
│   ├── scripts/               # Data migration scripts
│   ├── tests/                 # Unit and integration tests
│   │   ├── conftest.py
│   │   ├── test_api/
│   │   ├── test_services/
│   │   ├── test_core/
│   │   └── test_repositories/
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                  # React TypeScript frontend
│   ├── src/
│   │   ├── api/               # API client functions
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ui/            # Base UI components
│   │   │   ├── layout/        # Layout components
│   │   │   └── sync/          # Sync-related components
│   │   ├── hooks/             # React Query hooks
│   │   ├── pages/             # Page components
│   │   ├── store/             # Zustand stores
│   │   ├── types/             # TypeScript types
│   │   └── lib/                # Utilities
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── venv/                      # Python virtual environment
└── .gitignore
```

---

## Build/Lint/Test Commands

### Backend Setup
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
docker-compose up -d postgres
```

### Backend Running
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Backend Database Migrations
```bash
cd backend
alembic revision --autogenerate -m "Description"
alembic upgrade head
alembic downgrade -1
```

### Backend Testing (always use nohup for long tests)
```bash
cd backend
nohup pytest -v &
nohup pytest --cov=app --cov-report=term-missing &
nohup pytest tests/test_services/test_comparer.py -v &
```

### Frontend Setup
```bash
cd frontend
npm install
```

### Frontend Running
```bash
cd frontend
npm run dev
```

### Frontend Testing
```bash
cd frontend
nohup npm run build &
nohup npm run lint &
nohup npx vitest &
```

---

## Code Style Guidelines

### Backend (Python)
| Type | Convention |
|------|------------|
| Classes | PascalCase |
| Functions/Variables | snake_case |
| Constants | UPPER_SNAKE |
| Private Methods | _prefix |
| Database Tables | snake_case |

### Frontend (TypeScript/React)
| Type | Convention |
|------|------------|
| Components | PascalCase (.tsx) |
| Hooks | camelCase with `use` prefix |
| Functions/Variables | camelCase |
| Constants | UPPER_SNAKE |
| File naming | kebab-case.ts(x) |

### Type Hints (Backend - Required)
```python
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Mapped, mapped_column

class Module(Base):
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
```

### Import Order (Backend)
```python
# 1. Standard library
import uuid
from datetime import datetime
from enum import Enum
# 2. Third-party
from fastapi import APIRouter, Depends
from sqlalchemy import select
from pydantic import BaseModel
# 3. Local application
from app.core.database import get_db
```

---

## Backend Architecture

### Layered Architecture Rules
| Layer | Location | Responsibility |
|-------|----------|-----------------|
| API | app/api/v1/ | Validate input, return HTTP responses, JWT auth |
| Service | app/services/ | Business logic, orchestration |
| Repository | app/repositories/ | Database transactions, CRUD |
| Model | app/models/ | SQLAlchemy declarative models |

### Database Conventions
```python
class SyncRecord(Base):
    version_major: Mapped[int] = mapped_column(nullable=True)
    version_minor: Mapped[int] = mapped_column(nullable=True)
    version_patch: Mapped[int] = mapped_column(nullable=True)
    version_build: Mapped[int] = mapped_column(nullable=True)
    version_string: Mapped[str] = mapped_column()

class SyncStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
```

### Deduplication Pattern
```python
stmt = insert(Module).values(name=name, shortdesc=desc)
stmt = stmt.on_conflict_do_nothing(index_elements=['name'])
await db.execute(stmt)
```

---

## Security

### Credential Handling
- Odoo passwords encrypted at rest using Fernet
- Master key from environment variable FERNET_KEY
- JWT tokens for API authentication
- Never log decrypted credentials

### JWT Authentication
```python
from app.api.deps import get_current_user

@router.post("/sync/{env_name}")
def trigger_sync(env_name: str, current_user: User = Depends(get_current_user)):
    ...
```

### Environment Variables (Required)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/odoo_auditor
FERNET_KEY=<32-byte-base64-encoded-key>
JWT_SECRET_KEY=<random-secret>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
```

---

## Testing Guidelines

### Backend Test Structure
```
tests/
├── conftest.py                 # Shared fixtures
├── test_api/
│   ├── test_auth.py
│   ├── test_development_requests.py
│   └── test_environments.py
├── test_services/
│   ├── test_comparer.py
│   └── test_odoo_client.py
├── test_core/
│   └── test_security_matrix.py
└── test_repositories/
```

### Backend Fixtures Pattern
```python
@pytest.fixture
def db_session():
    # Create test database
    ...

@pytest.fixture
def sample_environment(db_session):
    return Environment(name="DEV", order=4, ...)

def test_version_comparison(db_session, sample_environment):
    assert calculate_release_action("17.0.1.10", "17.0.1.9") == "Upgrade"
```

### Test Naming Convention
```python
def test_comparer_returns_upgrade_when_source_greater():
    ...

def test_sync_record_transitions_to_running_on_start():
    ...
```

---

---

## Alembic Migration Guidelines

1. Structural changes: `alembic revision --autogenerate -m "description"`
2. Data migrations: Separate migration files with `ops.execute()` for data transforms
3. Never delete historical data - append-only design
4. Test migrations on a copy of production data before deploying

---

## Plan Management

All project plans MUST be stored in the centralized location `.opencode/plans/`.

### Directory Structure
```
.opencode/plans/
├── pending/      # Plans to be executed (check this FIRST)
└── completed/    # Executed plans (NEVER re-execute without explicit user approval)
```

### Rules
1. **Create new plans** in `.opencode/plans/pending/` with descriptive names
2. **Check pending plans** at the start of each session
3. **Move to completed** after execution: `mv .opencode/plans/pending/<plan>.md .opencode/plans/completed/`
4. **Never re-execute** completed plans without explicit user approval
5. **Document outcomes** in the plan before archiving (results, files created, tests run)

---

## Migration Phases & Tasks

### Phase 1-3: Foundation ✅ COMPLETED
- Backend project setup with FastAPI, SQLAlchemy, Alembic
- Database models (User, Role, Environment, Module, SyncRecord)
- PostgreSQL configuration with migrations

### Phase 4-6: Backend Layered Architecture ✅ COMPLETED
- Repository layer with CRUD operations
- Service layer with business logic
- API layer with FastAPI endpoints
- JWT authentication

### Phase 7-8: Core Features ✅ COMPLETED
- Background sync with Odoo XML-RPC
- Version comparison engine
- Reports generation

### Phase 9: Development Request Module ✅ COMPLETED
**Objective**: Add Development Request CRUD with RBAC

**Tasks**:
- [x] Create control parameters (request_state, request_type, priority, functional_category)
- [x] Create DevelopmentRequest model with self-referencing parent/child
- [x] Implement Role-based access control matrix
- [x] Add security checks for line item ownership
- [x] Add circular parent detection
- [x] Add N+1 query optimization
- [x] Write 165+ tests with edge cases

**Files Added**:
- `backend/app/models/control_parameters/*.py`
- `backend/app/models/development_request.py`
- `backend/app/core/security_matrix.py`
- `backend/app/api/v1/development_requests.py`
- `backend/app/api/v1/roles.py`
- `backend/app/services/development_request_service.py`
- `backend/scripts/seed_roles.py`
- `backend/scripts/seed_development_request_params.py`

### Phase 10: Frontend Integration ✅ COMPLETED
**Objective**: Add React frontend with Vite and Tailwind CSS

**Tasks**:
- [x] Create React frontend with Vite + TypeScript
- [x] Add Tailwind CSS with Radix UI components
- [x] Implement authentication flow with Zustand
- [x] Add environment management pages
- [x] Add sync functionality
- [x] Add reports page
- [x] Add Playwright E2E testing

**Frontend Structure**:
```
frontend/src/
├── api/           # Axios API clients
├── components/    # UI components
├── hooks/         # React Query hooks
├── pages/         # Route pages
├── store/         # Zustand auth store
└── types/         # TypeScript interfaces
```

---

## Phase Completion Criteria

| Phase | Verification |
|-------|--------------|
| Backend Setup | `docker-compose ps` shows postgres |
| Database | `alembic current` returns baseline |
| Tests | `pytest tests/` all pass |
| API | `curl localhost:8000/docs` shows Swagger |
| Frontend | `npm run dev` starts successfully |

---

## Commit Standards

**Branch naming**: `feature/{short-description}`

**Commit message format**:
```
{type}({scope}): {description}

{body}

{footer}
```

**Types**: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

**Examples**:
```
feat(backend): add Development Request CRUD with RBAC

- Add DevelopmentRequest model with parent/child relationships
- Implement role-based access control matrix
- Add security checks for line item ownership
- Write comprehensive edge case tests

Closes #development-request-module
```

```
feat(frontend): add React frontend with authentication

- Add Vite + TypeScript setup with Tailwind CSS
- Implement JWT authentication flow
- Add environment management pages
- Add Playwright E2E tests
```

---

## Development Request Module (Phase 9 Highlights)

### Control Parameters
| Parameter | Description |
|-----------|-------------|
| RequestState | pending, in_progress, review, approved, rejected, deployed, closed |
| RequestType | feature, bugfix, refactor, documentation, security, performance |
| Priority | low, medium, high, critical |
| FunctionalCategory | modules, integrations, database, security, ui, api, documentation |

### RBAC Matrix
| Role | Create | Read | Update | Delete | Assign |
|------|--------|------|--------|--------|--------|
| admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| manager | ✓ | ✓ | ✓ | ✗ | ✓ |
| developer | ✓ | own | own | ✗ | ✗ |
| viewer | ✗ | ✓ | ✗ | ✗ | ✗ |

### Security Features
- Line item ownership verification on updates
- Circular parent detection (A→B→C→A)
- Self-reference prevention
- N+1 query optimization with eager loading

---

## Plan Finalized

This AGENTS.md covers:
- ✅ Full project structure (backend + frontend)
- ✅ Build/lint/test commands for both backend and frontend
- ✅ Code style guidelines (Python + TypeScript/React)
- ✅ Layered architecture rules
- ✅ Database conventions
- ✅ Security (JWT, Fernet, RBAC)
- ✅ Testing guidelines with fixtures
- ✅ Migration phases with Phase 10 completion
- ✅ Development Request module details
- ✅ Commit standards
- ✅ Centralized plan management (`.opencode/plans/`)

**Always use nohup when running long-running terminal commands.**
