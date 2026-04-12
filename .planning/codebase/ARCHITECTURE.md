# Architecture

**Analysis Date:** 2026-04-05

## Pattern Overview

**Overall:** Layered Architecture with Repository Pattern (Backend) + Feature-based Organization with Custom Hooks (Frontend)

**Key Characteristics:**
- Backend follows strict 4-layer architecture: API → Service → Repository → Model
- Frontend follows React Query + Zustand pattern with feature-based organization
- RBAC enforced at both API and service layers via SecurityMatrixEngine
- State-aware field-level permissions based on request lifecycle state

## Layers

**API Layer:**
- Purpose: HTTP request handling, input validation, authentication, response serialization
- Location: `backend/app/api/v1/`
- Contains: FastAPI routers with endpoint definitions
- Depends on: Services, Schemas
- Used by: Frontend API clients

**Service Layer:**
- Purpose: Business logic, complex validation, orchestration, RBAC enforcement
- Location: `backend/app/services/`
- Contains: Business logic classes (DevelopmentRequestService, SyncService, AuthService, OdooClient)
- Depends on: Repositories, Models, Security Matrix
- Used by: API layer

**Repository Layer:**
- Purpose: Database CRUD operations, query building, data access abstraction
- Location: `backend/app/repositories/`
- Contains: Repository classes extending BaseRepository[ModelType]
- Depends on: Models, Database session
- Used by: Service layer

**Model Layer:**
- Purpose: SQLAlchemy ORM models, database schema definitions
- Location: `backend/app/models/`
- Contains: Entity classes (Module, User, Environment, DevelopmentRequest, etc.)
- Depends on: Base declarative class
- Used by: Repository layer

## Data Flow

**Development Request Creation Flow:**

1. Frontend sends POST to `/api/v1/development-requests/requests/`
2. `development_requests.py` router receives request
3. `get_current_user` dependency validates JWT token
4. `DevelopmentRequestService.create()` is called
5. Service validates intra-parameter rules (request type constraints)
6. `DevelopmentRequestRepository.create_with_number()` inserts to DB
7. Response schema serializes result with permissions
8. Frontend React Query receives response

**Odoo Sync Flow:**

1. Frontend calls `/api/v1/sync/sync/` with environment name
2. `SyncService.create_sync_job()` creates SyncRecord job
3. `execute_sync()` is called (can be async or background task)
4. `OdooClient` connects to Odoo XML-RPC endpoint
5. `fetch_modules()` retrieves module data
6. Each module upserted via `ModuleRepository.upsert()`
7. Version components parsed and stored in `SyncRecord`

## Key Abstractions

**BaseRepository[ModelType]:**
- Purpose: Generic CRUD operations for all entities
- Examples: `backend/app/repositories/module.py`, `backend/app/repositories/environment.py`
- Pattern: Template Method with generic type parameter

**SecurityMatrixEngine:**
- Purpose: Centralized RBAC enforcement for development requests
- Examples: `backend/app/core/security_matrix.py`
- Pattern: Strategy/Policy pattern with role-based field access

**OdooClient:**
- Purpose: XML-RPC client for Odoo server communication
- Examples: `backend/app/services/odoo_client.py`
- Pattern: Adapter pattern for external API

**useQuery Hook Wrappers (Frontend):**
- Purpose: Data fetching with caching, loading/error states
- Examples: `frontend/src/hooks/useModules.ts`, `frontend/src/hooks/useDevelopmentRequests.ts`
- Pattern: Custom Hook pattern wrapping React Query

**Zustand Store:**
- Purpose: Global state management (auth, theme)
- Examples: `frontend/src/store/auth-store.ts`, `frontend/src/store/theme-store.ts`
- Pattern: Flux-like unidirectional store

## Entry Points

**Backend API:**
- Location: `backend/app/main.py`
- Triggers: HTTP requests to FastAPI application
- Responsibilities: CORS setup, router mounting, health checks

**Frontend Application:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads SPA
- Responsibilities: React root rendering, router initialization

**Router Configuration:**
- Location: `frontend/src/App.tsx`
- Triggers: Route navigation
- Responsibilities: Route definitions, auth guards (PrivateRoute, AdminRoute)

## Error Handling

**Backend Strategy:**
- `HTTPException` for user-facing errors (4xx)
- Try/except blocks for external calls (Odoo XML-RPC)
- Database transaction rollback on failures

**Frontend Strategy:**
- React Query error handling via onError callback
- `sonner` toast notifications for user feedback
- ErrorBoundary component for component tree failures

## Cross-Cutting Concerns

**Logging:** Python standard `logging` module; console.error for frontend network issues

**Validation:** Pydantic BaseModel schemas for request/response validation; FastAPI Query parameters for input validation

**Authentication:** JWT Bearer tokens via HTTPAuthorizationCredentials; Zustand + localStorage for frontend token persistence

**RBAC:** SecurityMatrixEngine class enforces field-level permissions based on RoleLevel enum and StateCategory

---

*Architecture analysis: 2026-04-05*