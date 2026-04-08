# GPS Odoo Tracker Project Summary

## Overview

GPS Odoo Tracker is a monorepo for Odoo 17 operations management. The implemented product combines environment synchronization, module/version auditing, development request tracking, release planning, saved views, reporting, and role-based access control.

The repository is split into:

- `backend/`: FastAPI application with SQLAlchemy models, service/repository layers, Alembic migrations, and PostgreSQL persistence.
- `frontend/`: React 19 + Vite SPA with TypeScript, TanStack Query, Zustand, Tailwind CSS, and shadcn-style UI components.
- `docs/`: project documentation artifacts.

The intended deployment shape is Nginx in front of FastAPI and PostgreSQL. The backend explicitly trusts `X-Forwarded-For` for rate limiting, which aligns with reverse-proxy deployment.

## Stack Summary

### Backend

- Python
- FastAPI
- SQLAlchemy 2.x
- PostgreSQL
- Alembic
- Pydantic v2
- `slowapi` for request throttling
- `python-jose` + `passlib` for authentication
- `cryptography` for encryption support

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Radix primitives via shadcn-style components
- TanStack Query v5
- Zustand
- Axios
- React Hook Form + Zod
- Recharts
- `xlsx` for client-side export flows

### Testing

- Backend: `pytest`, `pytest-asyncio`, `pytest-cov`
- Frontend: `vitest`, Testing Library, `msw`

## Architecture

### Backend structure

The backend follows the layered shape defined in the project guidance:

- API layer: `backend/app/api/v1/`
- Service layer: `backend/app/services/`
- Repository layer: `backend/app/repositories/`
- Model layer: `backend/app/models/`
- Schema layer: `backend/app/schemas/`

`backend/app/main.py` wires CORS, slowapi middleware, and the versioned API router under `/api/v1`.

### Core domain models

The current codebase centers on these persisted entities:

- `Environment`: Odoo instance connection metadata and pipeline ordering.
- `Module`: master module catalog.
- `SyncRecord`: latest synced module state/version per environment.
- `ModuleDependency`: dependency records captured during sync.
- `DevelopmentRequest`: request header, ownership, state, priority, hierarchy, and archive status.
- `RequestModuleLine`: module/version/UAT details linked to a development request.
- `RequestComment` and `RequestAttachment`: threaded collaboration artifacts on requests.
- `SavedView`: persisted JSONB query state for request list views.
- `ComparisonReport`, `ComparisonReportRow`, `VersionDriftEntry`, `ReportMetadata`: persisted comparison and drift reporting data.
- `ReleasePlan`, `ReleasePlanLine`, `ReleasePlanState`: deployment planning and gating.
- `Role`, `User`, `RefreshToken`: RBAC and stateful session management.

### Frontend structure

The SPA is centered around `frontend/src/App.tsx` and `frontend/src/components/layout/main-layout.tsx`.

Implemented route groups include:

- Authentication: `/login`, `/register`
- Dashboard: `/dashboard`
- Environments: `/environments`, `/environments/:name`
- Module master: `/modules`
- Reports: `/reports/comparison`
- Development requests: list, create, detail
- Release plans: list, create, detail, edit
- Settings: environments, users, roles, control parameters

State responsibilities are split between:

- Zustand auth store for access token and current user
- TanStack Query hooks for server data
- Axios interceptors for auth retry/refresh behavior

## Implemented Security And Auth Model

### RBAC

Authorization is permission-based, not role-level-enum based.

- Roles store permissions in a PostgreSQL `JSONB` array.
- `SecurityMatrixEngine` builds permissions by unioning all role permission arrays.
- Endpoint protection uses `require_permissions([...])` for atomic permissions such as `system:manage`, `dev_request:update`, `release_plan:create`, and `reports:read`.
- The frontend generally consumes backend-derived permission payloads for request and release-plan actions.

### Session model

The current implementation is stateful:

- Access tokens are short-lived JWTs.
- Refresh tokens are generated server-side, stored in the database by hash, and rotated on every refresh.
- Refresh tokens are issued in secure `httpOnly`, `SameSite=strict` cookies scoped to `/api/v1/auth`.
- Logout revokes the current cookie-backed refresh token; logout-all revokes every active refresh token for the user.

### Rate limiting and proxy awareness

- `slowapi` is configured in both the app and auth router.
- The limiter key function trusts the first `X-Forwarded-For` value, with fallback to client address.
- Login is stricter than refresh:
  - `/auth/token`: `5/minute`
  - `/auth/refresh`: `30/minute`

### Frontend refresh handling

The frontend uses a mutex-style Axios interceptor:

- Requests attach the in-memory/localStorage access token.
- On `401`, only one `/auth/refresh` call is made.
- Concurrent failed requests are queued until refresh resolves or fails.
- The browser sends the refresh-token cookie because the Axios client uses `withCredentials: true`.

## Implemented Product Workflows

### Environment and sync management

- Environment CRUD exists in backend and frontend settings screens.
- Environment detail pages expose module and dependency views.
- Sync records drive latest module versions and states per environment.
- Environment module lists support server-side pagination, search, sorting, filtering, and export.

### Module master list

- `GET /api/v1/modules/master/` returns the module catalog with pagination and filtering.
- Export and filter-option endpoints are implemented.
- A dev-versions endpoint exists but currently returns an empty versions list.

### Development requests

Development requests are a major implemented subsystem:

- Header metadata includes request type, functional category, priority, assignee, state, parent/child relationships, related requests, archive status, and UAT request ID.
- Request module lines capture module technical name, version, MD5, email/thread zip, UAT ticket, and UAT status.
- The request list page implements:
  - query-bar filters
  - grouped views
  - saved views
  - bulk selection
  - bulk assign
  - bulk archive
- Comments and attachments are first-class entities with dedicated endpoints.
- Reopen and reject flows add mandatory comments atomically through the service layer.

### Saved views

Saved views are implemented for development requests:

- Stored in `saved_views.query_state` as JSONB.
- Support ownership, public visibility, admin override, create/update/delete, and read-only-user restrictions.
- The frontend includes a saved view selector integrated into the request command center.

### Comparison and drift reporting

The comparison engine is implemented and persisted:

- Report generation creates a new `ComparisonReport` parent row.
- Existing report rows and drift entries are replaced through cascade deletion before the new batch is stored.
- `ComparisonReportRow` stores per-module environment version data and precomputed `action_counts`.
- `VersionDriftEntry` stores pairwise environment drift transitions.
- Consecutive environment comparisons are computed in ordered sequence.
- N/A-to-N/A pairs are skipped to reduce storage.
- CSV streaming export exists for drift data, alongside JSON export endpoints used by the frontend for XLSX workflows.

Current drift action categories in code are:

- `Upgrade`
- `Error (Downgrade)`
- `Missing Module`
- `Error (Missing in Source)`
- `No Action`

### Release plans

Release planning is implemented as a guarded deployment workflow:

- Release plans track source environment, target environment, state, dates, notes, approver/deployer, and related plans.
- `ReleasePlanLine` snapshots request-line data when linked:
  - module id
  - technical name
  - module version
  - email artifact
  - MD5 hash
  - UAT values
- Live source and target environment versions are also refreshed from sync data.
- Service-layer validation enforces:
  - create/update permissions
  - stricter modification rules for closed or failed plans
  - duplicate prevention against active plans for the same environment
  - production UAT gate
  - pre-flight revalidation before in-progress/closed transitions
  - anti-regression checks where target is ahead of source

The release plan API also includes:

- state management under `/release-plans/states/`
- eligibility checks for request module lines
- link/unlink flows for release plan lines
- environment-change confirmation behavior when a plan already has lines

### Dashboard

The dashboard is implemented as a two-tab operational summary:

- Command Center tab:
  - KPI cards
  - developer workload matrix
  - release pipeline summary
  - infra health summary
  - UAT and drift visualizations
- Version Drift tab:
  - report-driven drift detail table

Frontend query hooks cache dashboard endpoints with explicit `staleTime` values to reduce unnecessary refetches.

## API Surface Snapshot

The current backend exposes these main route groups under `/api/v1`:

- `/auth`
- `/users`
- `/roles`
- `/environments`
- `/sync`
- `/modules`
- `/reports`
- `/development-requests`
- `/release-plans`
- `/dashboard`
- `/saved-views`

Notable implemented endpoint patterns:

- list endpoints commonly support page/limit/search/sort parameters
- many resources expose export helpers for CSV or client-side XLSX generation
- admin-only management is enforced in the backend using atomic permissions, not frontend-only guards

## Known Gaps And Review Findings

This section captures important mismatches between the original architecture brief, older docs, and the current codebase.

### Existing documentation is stale

`frontend/FRONTEND_DOCUMENTATION.md` no longer matches the implemented application. It omits or understates several shipped areas, including:

- release plans
- control-parameter management
- dashboard tabs and KPI/report views
- saved views
- rotating refresh-token auth flow
- richer request-management behavior

### Registration is not self-service

The frontend exposes a public `/register` page, but the backend endpoint `/api/v1/auth/register` requires `system:manage`. In practice, account creation is admin-provisioned, not open self-registration.

### Settings access is not fully aligned in the UI

`/settings/users`, `/settings/roles`, and `/settings/control-parameters` are wrapped in `AdminRoute`, but `/settings/environments` is not. Backend CRUD protection still exists, so this is a frontend access inconsistency rather than a backend authorization gap.

### Some brief-level claims are only partially implemented

- The frontend is not completely permission-dumb. It mostly uses backend permission payloads, but some route/button visibility still checks role permissions directly from the auth store.
- The universal table pattern is not fully uniform. There is a shared data-table foundation, but several screens still use custom table compositions.
- The AGENTS pagination contract is not applied identically everywhere. For example, some endpoints default to `20` records, and some resource paths use environment names rather than ids.

### Release and module details are ahead of earlier docs

The current codebase implements more than the older documentation describes:

- saved views for request list state
- linked request-module-line and release-plan-line workflows
- release-plan state administration
- comments and attachments on development requests
- streamed drift CSV export plus JSON export endpoints

## Summary

GPS Odoo Tracker is already beyond a simple Odoo module auditor. The implemented codebase is an enterprise-style operations application with stateful auth, permission-array RBAC, request management, report persistence, release-plan gating, and a React command-center frontend. The main documentation risk is not missing architecture, but stale descriptions that no longer reflect the shipped system.
