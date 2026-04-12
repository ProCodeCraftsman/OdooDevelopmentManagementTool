# Codebase Structure

**Analysis Date:** 2026-04-05

## Directory Layout

```
opencode code migration/
├── backend/                    # FastAPI Python backend
│   ├── app/
│   │   ├── api/v1/           # API route handlers
│   │   ├── core/             # Database, config, security matrix
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── repositories/      # Data access layer
│   │   ├── schemas/          # Pydantic request/response models
│   │   └── services/         # Business logic layer
│   ├── alembic/              # Database migrations
│   ├── scripts/              # Seed and migration scripts
│   └── tests/                # Backend pytest tests
├── frontend/                  # React + Vite frontend
│   └── src/
│       ├── api/              # API client functions
│       ├── components/        # React components
│       ├── hooks/             # Custom React hooks
│       ├── lib/               # Utilities, API config
│       ├── pages/             # Page components
│       ├── store/             # Zustand state stores
│       └── types/             # TypeScript type definitions
├── Legacy/                    # Legacy code (not active)
└── migration/                # Migration utilities
```

## Directory Purposes

**Backend - `backend/app/`:**
- Purpose: Main application code
- Contains: All Python modules following layered architecture

**Backend API - `backend/app/api/v1/`:**
- Purpose: HTTP endpoint definitions
- Contains: `auth.py`, `modules.py`, `environments.py`, `sync.py`, `reports.py`, `development_requests.py`, `users.py`, `roles.py`, `release_plans.py`
- Key files: `backend/app/api/v1/__init__.py` (aggregates all routers)

**Backend Core - `backend/app/core/`:**
- Purpose: Shared infrastructure code
- Contains: `database.py` (SQLAlchemy setup), `config.py` (Settings), `security_matrix.py` (RBAC engine)

**Backend Models - `backend/app/models/`:**
- Purpose: SQLAlchemy ORM entity definitions
- Contains: `base.py`, `module.py`, `user.py`, `role.py`, `environment.py`, `development_request.py`, `sync_record.py`, `release_plan.py`, `control_parameter_rule.py`
- Subdirectories: `control_parameters/` (RequestType, RequestState, FunctionalCategory, Priority, ReleasePlanState)

**Backend Repositories - `backend/app/repositories/`:**
- Purpose: Data access abstraction layer
- Contains: `base.py` (generic BaseRepository), plus one file per model
- Key files: `module.py`, `environment.py`, `user.py`, `development_request.py`, `sync_record.py`, `release_plan.py`, `release_plan_state.py`

**Backend Schemas - `backend/app/schemas/`:**
- Purpose: Pydantic models for API request/response validation
- Contains: `module.py`, `auth.py`, `environment.py`, `development_request.py`, `control_parameters.py`, `release_plan.py`, `sync.py`, `report.py`

**Backend Services - `backend/app/services/`:**
- Purpose: Business logic orchestration
- Contains: `auth_service.py`, `sync_service.py`, `development_request_service.py`, `release_plan_service.py`, `comparer.py`, `encryption.py`, `odoo_client.py`

**Frontend API - `frontend/src/api/`:**
- Purpose: API client functions for each domain
- Contains: `auth.ts`, `modules.ts`, `environments.ts`, `environment-modules.ts`, `module-master.ts`, `sync.ts`, `reports.ts`, `users.ts`, `roles.ts`, `control-parameters.ts`, `development-requests.ts`, `release-plans.ts`

**Frontend Components - `frontend/src/components/`:**
- Purpose: Reusable React components
- Contains: `ui/` (shadcn/ui components), `layout/` (sidebar, header, main-layout), `sync/` (sync-button, sync-status), `development-requests/` (add-module-line-dialog)

**Frontend Hooks - `frontend/src/hooks/`:**
- Purpose: Custom hooks wrapping React Query for data fetching
- Contains: `useModules.ts`, `useEnvironments.ts`, `useEnvironmentModules.ts`, `useModuleMaster.ts`, `useDevelopmentRequests.ts`, `useSync.ts`, `useReports.ts`, `useUsers.ts`, `useRoles.ts`, `useControlParameters.ts`, `useReleasePlans.ts`

**Frontend Pages - `frontend/src/pages/`:**
- Purpose: Page-level components
- Contains: `dashboard.tsx`, `modules.tsx`, `login.tsx`, `register.tsx`
- Subdirectories: `environments/`, `development-requests/`, `reports/`, `settings/`, `release-plans/`

**Frontend Store - `frontend/src/store/`:**
- Purpose: Global state management (Zustand)
- Contains: `auth-store.ts`, `theme-store.ts`

## Key File Locations

**Backend Entry Points:**
- `backend/app/main.py`: FastAPI app initialization, CORS, router mounting
- `backend/app/api/deps.py`: Dependency injection (get_current_user, get_current_admin_user)

**Frontend Entry Points:**
- `frontend/src/main.tsx`: React root render
- `frontend/src/App.tsx`: Router configuration, auth guards

**Configuration:**
- `backend/app/core/config.py`: Settings with pydantic BaseSettings
- `backend/app/core/database.py`: SQLAlchemy engine and session
- `frontend/vite.config.ts`: Vite bundler config
- `frontend/tsconfig.json`: TypeScript configuration

**Core Business Logic:**
- `backend/app/services/development_request_service.py`: Development request CRUD and validation
- `backend/app/services/sync_service.py`: Odoo sync job management
- `backend/app/services/release_plan_service.py`: Release plan management
- `backend/app/core/security_matrix.py`: RBAC permission engine

**Data Models:**
- `backend/app/models/development_request.py`: DevelopmentRequest, RequestModuleLine, RequestReleasePlanLine
- `backend/app/models/module.py`: Module entity
- `backend/app/models/environment.py`: Environment entity with encrypted credentials
- `backend/app/models/release_plan.py`: ReleasePlan, ReleasePlanLine

## Naming Conventions

**Files:**
- Python: `snake_case.py` (e.g., `development_request.py`, `odoo_client.py`)
- TypeScript: `camelCase.ts` for utilities, `PascalCase.tsx` for components (e.g., `useModules.ts`, `ModuleCard.tsx`)
- Directories: `kebab-case` for frontend feature directories

**Classes (Python):**
- PascalCase: `DevelopmentRequestService`, `ModuleRepository`, `SecurityMatrixEngine`

**Functions/Variables (Python):**
- snake_case: `get_current_user`, `create_sync_job`, `hashed_password`

**TypeScript:**
- camelCase: `useModuleSearch`, `searchModules`, `login`
- PascalCase for React components and types: `UserResponse`, `DevelopmentRequestsListPage`

**Constants:**
- UPPER_SNAKE_CASE: `FORBIDDEN_STATES_FOR_NON_DEV`, `RoleLevel.ADMIN`

## Where to Add New Code

**New API Endpoint (Backend):**
1. Add route in `backend/app/api/v1/{resource}.py` or existing file
2. Add schema in `backend/app/schemas/{resource}.py` if needed
3. Import and include router in `backend/app/api/v1/__init__.py`

**New Service (Backend):**
1. Create `backend/app/services/{service_name}.py`
2. Instantiate repositories/services in constructor
3. Call from API layer endpoints

**New Repository (Backend):**
1. Create `backend/app/repositories/{model}.py`
2. Extend `BaseRepository[ModelType]`
3. Add custom query methods

**New React Component:**
1. UI components: `frontend/src/components/ui/{ComponentName}.tsx` (shadcn/ui)
2. Feature components: `frontend/src/components/{feature}/`
3. Page components: `frontend/src/pages/{feature}/`

**New API Client (Frontend):**
1. Create `frontend/src/api/{resource}.ts`
2. Use `api` from `@/lib/api` for requests
3. Add type exports for request/response

**New Custom Hook (Frontend):**
1. Create `frontend/src/hooks/use{Resource}.ts`
2. Wrap `@tanstack/react-query` useQuery/useMutation
3. Export typed hook for components

## Special Directories

**alembic/versions:**
- Purpose: Database migration files
- Generated: Yes (via `alembic revision --autogenerate`)
- Committed: Yes

**frontend/src/__tests__:**
- Purpose: Test files (Vitest)
- Generated: No
- Committed: Yes

**backend/tests/:**
- Purpose: pytest test files
- Generated: No
- Committed: Yes

**node_modules/ (frontend) and venv/ (backend):**
- Purpose: Dependencies
- Generated: Yes (via npm install / pip install)
- Committed: No (typically in .gitignore)

---

*Structure analysis: 2026-04-05*