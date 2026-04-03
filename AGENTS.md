# AGENTS.md - Odoo Release Management Backend
## Project Overview
**Odoo Module Dependency & Version Auditor** - A stateful, secure, and queryable release 
management engine that synchronizes Odoo 17 module data across multiple environments.

**Current State**: CSV-based scripts (Phase 1 migration planned)
**Target State**: Layered backend (API → Service → Repository → PostgreSQL)
---
## current Project Structure for reference only
```
.
├── app/
│   ├── __init__.py
│   └── core/
│       ├── paths.py                    # Centralized path management
│       ├── odoo_xmlprc_config.py      # XML-RPC Odoo client
│       ├── server_env_config_manager.py # Environment registry
│       ├── module_master.py           # Evergreen module tracking
│       ├── comparison_engine.py        # Version comparison logic
│       └── get_env_module_data.py      # Main sync orchestrator
├── data/                              # CSV outputs
│   ├── env_data/                      # Per-environment CSVs + logs
│   ├── module_master/                 # module_master.csv
│   └── report/                        # comparison_report.csv
├── environments.json                  # Server credentials (git-ignored)
└── requirements.txt
```
---
**Architecture**: Layered Service Architecture
- API Layer (FastAPI) → Service Layer → Repository Layer → PostgreSQL
---
## Project Structure
backend/
├── alembic/                    # Database migrations
├── app/
│   ├── api/v1/                 # FastAPI routes
│   ├── core/                   # Config, security, database
│   ├── models/                 # SQLAlchemy models
│   ├── repositories/           # Database CRUD operations
│   ├── schemas/                # Pydantic validation models
│   └── services/               # Business logic
├── tests/                       # Unit and integration tests
├── docker-compose.yml          # PostgreSQL + App
├── Dockerfile
└── requirements.txt
---
## Build/Lint/Test Commands
### Setup
```bash
# Create virtual environment
python3 -m venv venv && source venv/bin/activate
# Install dependencies
pip install -r requirements.txt
# Docker Compose (PostgreSQL)
docker-compose up -d postgres
Running the Application
# Development server
uvicorn app.main:app --reload --port 8000
# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000
Database Migrations (Alembic)
# Create new migration
alembic revision --autogenerate -m "Description"
# Run migrations
alembic upgrade head
# Rollback
alembic downgrade -1
Testing
# Run all tests
pytest
# Run with coverage
pytest --cov=app --cov-report=term-missing
# Run specific test file
pytest tests/test_services/test_comparer.py
# Run specific test
pytest tests/test_services/test_comparer.py::test_parse_semver -v
---
Code Style Guidelines
Naming Conventions
Type	Convention
Classes	PascalCase
Functions/Variables	snake_case
Constants	UPPER_SNAKE
Private Methods	_prefix
Database Tables	snake_case
Type Hints (Required)
Use typing module for annotations:
from typing import Optional, List, Dict, Any
def fetch_modules(env_id: int) -> List[Dict[str, Any]]:
    ...
Use SQLAlchemy 2.0 style for model columns:
from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column
class Module(Base):
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    version: Mapped[Optional[int]] = mapped_column(nullable=True)
Import Order
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
from app.models import Environment
Docstrings (Google Style)
def calculate_release_action(source: str, target: str) -> str:
    """Calculate the release action based on version comparison.
    Compares source version against target version to determine if an
    upgrade is needed or if there's a regression.
    Args:
        source: Source version string (e.g., "17.0.1.10")
        target: Target version string (e.g., "17.0.1.9")
    Returns:
        Action string: "Upgrade", "No Action", or "Error (Downgrade)"
    """
Error Handling
# Use specific exception types
try:
    result = decrypt_password(encrypted)
except cryptography.fernet.InvalidToken:
    raise CredentialDecryptionError("Failed to decrypt password")
# Log errors with context
logger.error(f"Sync failed for environment {env_id}: {str(e)}", exc_info=True)
Path Handling
Always use pathlib.Path:
from pathlib import Path
# Good
config_path = Path(__file__).parent / "config.json"
# Avoid
config_path = os.path.join(os.path.dirname(__file__), "config.json")
---
## Layered Architecture Rules
### API Layer (app/api/)
- Validate input using Pydantic schemas
- Return HTTP responses (JSON)
- Handle authentication via JWT dependencies
- **NO business logic here**
### Service Layer (app/services/)
- Contains all business logic
- Orchestrates repository calls
- Handles version comparison, Odoo client, sync orchestration
- Pure Python functions/classes
### Repository Layer (app/repositories/)
- Handles all database transactions
- Uses INSERT ON CONFLICT for deduplication
- Generic base class for CRUD operations
- **NO business logic here**
### Model Layer (app/models/)
- SQLAlchemy declarative models
- Database constraints (unique indexes, foreign keys)
- No methods - only data structure
---
Database Conventions
Version Storage (SQL-Native Comparison)
Store version as separate integer components for efficient SQL queries:
class SyncRecord(Base):
    version_major: Mapped[int] = mapped_column(nullable=True)
    version_minor: Mapped[int] = mapped_column(nullable=True)
    version_patch: Mapped[int] = mapped_column(nullable=True)
    version_build: Mapped[int] = mapped_column(nullable=True)
    version_string: Mapped[str] = mapped_column()  # Display only
Task Registry (SyncRecord State Machine)
class SyncStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
Constraints
class Module(Base):
    name: Mapped[str] = mapped_column(unique=True)  # Unique constraint
    
    __table_args__ = (
        Index('ix_module_version_sort', 'version_major', 'version_minor', 
              'version_patch', 'version_build'),
    )
Deduplication Pattern
# Use ON CONFLICT for upserts
stmt = insert(Module).values(name=name, shortdesc=desc)
stmt = stmt.on_conflict_do_nothing(index_elements=['name'])
await db.execute(stmt)

---
Security
Credential Handling
- Odoo passwords encrypted at rest using Fernet
- Master key from environment variable FERNET_KEY
- Never log decrypted credentials
- JWT tokens for API authentication
JWT Authentication
# All protected endpoints require:
from app.api.deps import get_current_user
@router.post("/sync/{env_name}")
def trigger_sync(env_name: str, current_user: User = Depends(get_current_user)):
    ...
Environment Variables (Required)
DATABASE_URL=postgresql://user:pass@localhost:5432/odoo_auditor
FERNET_KEY=<32-byte-base64-encoded-key>
JWT_SECRET_KEY=<random-secret>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
---
Testing Guidelines
Test Structure
tests/
├── conftest.py                 # Shared fixtures
├── test_models/
├── test_repositories/
├── test_services/
│   ├── test_comparer.py
│   └── test_odoo_client.py
└── test_api/
Fixtures Pattern
# conftest.py
@pytest.fixture
def db_session():
    # Create test database
    ...
@pytest.fixture
def sample_environment(db_session):
    return Environment(name="DEV", order=4, ...)
# Usage in tests
def test_version_comparison(db_session, sample_environment):
    assert calculate_release_action("17.0.1.10", "17.0.1.9") == "Upgrade"
Test Naming
def test_comparer_returns_upgrade_when_source_greater():
    ...
def test_sync_record_transitions_to_running_on_start():
    ...
---
## Legacy Code Migration
Current CSV-based code will be preserved in `Legacy` folder during migration.
Do not modify legacy code - it serves as reference until new system is verified.
---
Alembic Migration Guidelines
1. Structural changes: alembic revision --autogenerate -m "description"
2. Data migrations: Separate migration files with ops.execute() for data transforms
3. Never delete historical data - append-only design
4. Test migrations on a copy of production data before deploying
---

## Migration Rules (Strict Enforcement)
1. **Read-Only Zone**: The `Legacy` directory is strictly READ-ONLY. Never modify, delete, or move files in these folders.
---

## Migration Phases & Tasks

### Phase 1: Project Setup ✅ COMPLETED
**Objective**: Create the backend directory structure and establish dependencies.

**Tasks**:
- [x] Create `backend/` directory
- [x] Create `backend/requirements.txt` with all dependencies (fastapi, sqlalchemy, alembic, etc.)
- [x] Create `backend/.env.example` with required environment variables template
- [x] Create `backend/docker-compose.yml` for PostgreSQL + App services
- [x] Create `backend/Dockerfile`
- [x] Create `backend/app/__init__.py`
- [x] Create `backend/app/main.py` with FastAPI app skeleton
- [x] Verify Docker Compose starts PostgreSQL successfully

**Verification**: Run `docker-compose up -d postgres` and confirm database is accessible.
**Note**: Docker daemon must be running. Run `open -a Docker` to start Docker Desktop.

---

### Phase 2: Database Configuration ✅ COMPLETED
**Objective**: Set up database connection, session management, and Alembic.

**Tasks**:
- [x] Create `backend/app/core/config.py` - Settings from environment variables
- [x] Create `backend/app/core/database.py` - Session management with SQLAlchemy
- [x] Initialize Alembic: `alembic init alembic`
- [x] Configure `backend/alembic.ini` with database URL
- [x] Create `backend/alembic/env.py` with SQLAlchemy metadata
- [x] Create initial migration to verify setup works

**Verification**: Run `alembic current` and `alembic history` to confirm migrations are tracked.

---

### Phase 3: Database Models ✅ COMPLETED
**Objective**: Define SQLAlchemy models for all entities.

**Tasks**:
- [x] Create `backend/app/models/base.py` - SQLAlchemy declarative base
- [x] Create `backend/app/models/user.py` - User model for JWT auth
- [x] Create `backend/app/models/environment.py` - Environment with encrypted credentials
- [x] Create `backend/app/models/module.py` - Module master table
- [x] Create `backend/app/models/sync_record.py` - Sync record with state machine
- [x] Add indexes for version sorting (`ix_module_version_sort`)
- [x] Create Alembic migration: `alembic revision --autogenerate -m "Create initial tables"`
- [x] Run migration: `alembic upgrade head`

**Verification**: Run `alembic upgrade head` and check database tables exist.

---

### Phase 4: Repository Layer ✅ COMPLETED
**Objective**: Implement data access layer with CRUD operations.

**Tasks**:
- [x] Create `backend/app/repositories/base.py` - Generic base repository class
- [x] Create `backend/app/repositories/user.py` - User repository
- [x] Create `backend/app/repositories/environment.py` - Environment repository with Fernet encryption
- [x] Create `backend/app/repositories/module.py` - Module repository with INSERT ON CONFLICT
- [x] Create `backend/app/repositories/sync_record.py` - Sync record repository with state transitions
- [ ] Write unit tests for each repository

**Verification**: Run `pytest tests/test_repositories/ -v` and ensure all tests pass.

---

### Phase 5: Service Layer ✅ COMPLETED
**Objective**: Migrate business logic from legacy code to services.

**Tasks**:
- [x] Create `backend/app/services/encryption.py` - Fernet encryption utilities
- [x] Migrate `odoo_xmlprc_config.py` → `backend/app/services/odoo_client.py`
- [x] Migrate `comparison_engine.py` → `backend/app/services/comparer.py`
- [x] Create `backend/app/services/sync_service.py` - Orchestrates Odoo sync workflow
- [x] Create `backend/app/services/auth_service.py` - JWT token generation/validation
- [ ] Write unit tests for each service

**Verification**: Run `pytest tests/test_services/ -v` and ensure all tests pass.

---

### Phase 6: API Layer ✅ COMPLETED
**Objective**: Build FastAPI endpoints for frontend consumption.

**Tasks**:
- [x] Create `backend/app/api/deps.py` - JWT dependency injection
- [x] Create `backend/app/schemas/auth.py` - Token request/response schemas
- [x] Create `backend/app/schemas/sync.py` - Sync request/response schemas
- [x] Create `backend/app/schemas/report.py` - Report schemas
- [x] Create `backend/app/api/v1/auth.py` - POST `/api/v1/auth/token`
- [x] Create `backend/app/api/v1/environments.py` - CRUD for environments
- [x] Create `backend/app/api/v1/sync.py` - POST `/api/v1/sync/{env_name}`, GET `/api/v1/sync/{job_id}`
- [x] Create `backend/app/api/v1/reports.py` - GET `/api/v1/reports/comparison`
- [x] Register all routers in `backend/app/main.py`
- [ ] Write integration tests for API endpoints

**Verification**: Start server with `uvicorn app.main:app --reload` and test endpoints via Swagger UI.

---

### Phase 7: Background Task Integration ✅ COMPLETED
**Objective**: Implement async sync using FastAPI BackgroundTasks.

**Tasks**:
- [x] Integrate BackgroundTasks into sync endpoint
- [x] Implement job progress tracking via SyncRecord state machine
- [x] Add error handling and retry logic
- [ ] Write tests for background task execution

**Verification**: Trigger sync and verify job_id is returned immediately; poll status until completion.

---

### Phase 8: Data Migration
**Objective**: One-time script to migrate legacy CSV data to PostgreSQL.

**Tasks**:
- [ ] Create `backend/scripts/migrate_environments.py` - Import `environments.json` → DB
- [ ] Create `backend/scripts/migrate_modules.py` - Import `module_master.csv` → DB
- [ ] Test migration scripts on sample data
- [ ] Document migration steps for production

**Verification**: Run scripts and verify data integrity in database.

---

### Phase 9: Legacy Code Preservation
**Objective**: Archive current code to `Legacy/` folder.

**Tasks**:
- [ ] Create `Legacy/` directory
- [ ] Move `app/` directory contents to `Legacy/`
- [ ] Move `data/` directory to `Legacy/`
- [ ] Update `.gitignore` to exclude legacy data files
- [ ] Update README to reference new backend structure

**Verification**: Confirm `Legacy/` contains all original code and `data/` is not tracked.

---

### Phase 10: Final Verification & Documentation
**Objective**: Ensure system is production-ready.

**Tasks**:
- [ ] Run full test suite: `pytest --cov=app`
- [ ] Verify API endpoints work end-to-end
- [ ] Document deployment instructions
- [ ] Update AGENTS.md with any final changes

**Verification**: All tests pass, API responds correctly, deployment docs complete.

---

## Phase Completion Criteria

Each phase must be verified before proceeding:

| Phase | Verification Command |
|-------|---------------------|
| Phase 1 | `docker-compose ps` shows postgres running |
| Phase 2 | `alembic current` returns baseline |
| Phase 3 | Tables exist in PostgreSQL |
| Phase 4 | `pytest tests/test_repositories/` passes |
| Phase 5 | `pytest tests/test_services/` passes |
| Phase 6 | `curl localhost:8000/docs` shows Swagger UI |
| Phase 7 | Sync returns job_id immediately |
| Phase 8 | Data queries return correct counts |
| Phase 9 | `Legacy/` contains archived code |
| Phase 10 | All tests pass, docs complete |

---

## Commit Standards

**Branch naming**: `feature/migration-{phase-number}-{short-description}`

**Commit message format**:
```
{type}({scope}): {description}

{body}

{footer}
```

**Types**: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

**Examples**:
```
feat(phase1): add backend project structure and dependencies

- Add requirements.txt with FastAPI, SQLAlchemy, Alembic
- Add docker-compose.yml for PostgreSQL
- Add initial app skeleton with main.py

Closes #migration-phase-1
```

```
feat(phase3): create database models for environments and modules

- Add Environment model with Fernet-encrypted password field
- Add Module model with unique name constraint
- Add SyncRecord model with state machine
- Add version sorting index

Closes #migration-phase-3
```

---

## Plan Finalized
This AGENTS.md covers:
- ✅ Build/lint/test commands (including single test execution)
- ✅ Layered architecture rules (API → Service → Repository)
- ✅ Code style (naming, types, imports, docstrings, error handling)
- ✅ Database conventions (version storage, state machine, constraints)
- ✅ Security (JWT, Fernet, environment variables)
- ✅ Testing guidelines with fixtures
- ✅ Migration strategy from legacy code
- ✅ Detailed 10-phase migration plan with task checklists
- ✅ Phase verification criteria
- ✅ Git commit standards