# Codebase Concerns

**Analysis Date:** 2026-04-05

## Missing Critical Features

### API Endpoint: Environment Modules Not Implemented

**Problem:** AGENTS.md requires `GET /api/v1/environments/{env_id}/modules/` but this endpoint does not exist in the backend.

- **Files affected:** `backend/app/api/v1/environments.py`
- **Required:** Backend endpoint returning `technical_name`, `module_name`, `installed_version`, `dependency_versions`, `state` with filtering by `status` and sorting by `technical_name`, `installed_version`
- **Impact:** Frontend has API client (`frontend/src/api/environment-modules.ts`) and hook (`frontend/src/hooks/useEnvironmentModules.ts`) ready, but calls will fail with 404
- **Fix approach:** Add route to `environments.py` with repository method to fetch module versions per environment

### API Endpoint: Module Master Search Missing Sortability Options

**Problem:** AGENTS.md specifies sorting by `technical_name` and `first_seen_date` but backend only sorts by `name` column mapping.

- **Files:** `backend/app/repositories/module.py` (line 30)
- **Impact:** Sorting by `first_seen_date` may not work correctly as it's mapped but the logic is ambiguous
- **Fix approach:** Explicitly map `first_seen_date` sort_by parameter to correct column

### Incomplete Endpoint: Module Dev Versions

**Problem:** `backend/app/api/v1/modules.py` (lines 55-71)
```python
@router.get("/master/{module_name}/dev-versions/", response_model=ModuleDevVersionsResponse)
def get_module_dev_versions(...):
    ...
    return ModuleDevVersionsResponse(
        module_name=module_name,
        versions=[],  # Always empty
    )
```

**Impact:** Endpoint always returns empty versions array regardless of module
**Fix approach:** Implement actual version retrieval from environment module data

---

## API Contract Implementation Status

### Parameter Mismatch with AGENTS.md

**Default limit discrepancy:**
- AGENTS.md: default `limit=15`
- Backend implementation: `limit=20` in `modules.py` (line 16), `development_requests.py` (line 371), `release_plans.py` (line 113)

**Missing `group_by` parameter:**
- Documented in AGENTS.md but not implemented in any endpoint
- No query parameter validation for `group_by`

**Missing `search` filtering:**
- `development_requests.py` list endpoint (line 362-394) does not support `search` parameter despite AGENTS.md requirements for all list endpoints

### Pagination Response Structure Inconsistency

**Problem:** Different endpoints return different pagination structures

- `development_requests.py`: returns `items`, `total`, `page`, `limit`, `pages`
- `modules.py`: returns `data`, `pagination` object with `total_records`, `total_pages`, `current_page`, `limit`

**AGENTS.md specifies:**
```json
{
  "data": [...records...],
  "pagination": {
    "total_records": 671,
    "total_pages": 45,
    "current_page": 1,
    "limit": 15
  }
}
```

**Files with inconsistency:** `backend/app/api/v1/development_requests.py`, `backend/app/api/v1/release_plans.py`

---

## RBAC Implementation Gaps

### No API-Level CRUD Permission Enforcement

**Problem:** AGENTS.md specifies CRUD permissions by role:
| Role | Create | Read | Update | Delete | Assign |
|------|--------|------|--------|--------|--------|
| admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| manager | ✓ | ✓ | ✓ | ✗ | ✓ |
| developer | ✓ | own | own | ✗ | ✗ |
| viewer | ✗ | ✓ | ✗ | ✗ | ✗ |

**Current state:** 
- `backend/app/core/security_matrix.py` has field-level access control only
- No `can_create()`, `can_read()`, `can_update()`, `can_delete()` functions exist
- Most endpoints only check authentication (`get_current_user`) not role-based authorization
- Only admin-specific operations use `get_current_admin_user` dependency

**Files affected:** All API endpoints in `backend/app/api/v1/`

### Line Item Ownership Verification

**Problem:** AGENTS.md mentions "Line item ownership verification" but no implementation found

- Security matrix checks field-level permissions but doesn't verify ownership of module lines
- No checks that developer can only modify their own assigned lines

### Circular Parent Detection

**Problem:** AGENTS.md mentions "circular parent detection" but implementation unclear

- Test exists: `test_4_2_circular_parent` in `test_development_requests.py`
- No clear implementation in repository or service layer
- No database-level constraint

---

## Security Considerations

### CORS Configuration

**Issue:** `backend/app/main.py` (lines 12-18)
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Risk:** `allow_credentials=True` with wildcard headers/methods is overly permissive for production. Hardcoded localhost origins won't work in containerized deployments.

**Recommendation:** Use environment-based CORS configuration

### SSL Verification Disabled

**Issue:** OdooClient uses `ssl._create_unverified_context()` which bypasses SSL certificate validation
- Files: `backend/app/services/odoo_client.py` line 26
- Impact: Man-in-the-middle attacks possible when connecting to Odoo servers
- Fix approach: Allow configurable SSL verification or use proper certificate validation

### Sensitive Data Handling

**Issue:** Environment passwords are encrypted but decrypted password retrieval exists

- `backend/app/repositories/environment.py` (lines 43-46): `get_decrypted_password()` method
- No audit trail for password access
- No role-based restriction on password viewing

**Recommendation:** Add audit logging and restrict access to admin role only

### Debug Mode Enabled by Default

**Issue:** `APP_DEBUG: bool = True` in production config
- Files: `backend/app/core/config.py` line 16
- Impact: May expose stack traces and internal details in production
- Fix approach: Default to `False`, only enable via environment variable

---

## Technical Debt

### Deduplication Pattern Not Used Consistently

**Problem:** AGENTS.md documents PostgreSQL upsert pattern but not used in module repository

- `backend/app/repositories/module.py` uses simple `get_by_name` + create pattern
- Should use `insert().on_conflict_do_nothing()` for batch operations (lines 65-69)

### Hardcoded Environment Name Dependency

**Issue:** `validate_module_version()` assumes "DEV" environment exists by name
- Files: `backend/app/services/development_request_service.py` lines 93-99
- Impact: Feature breaks if DEV environment is renamed or deleted
- Fix approach: Look up DEV environment by category field or configurable setting

### DEBUG Statements in Production Code

**Issue:** `sys.stderr.write()` debug logging left in `reports.py` lines 116-127
- Files: `backend/app/api/v1/reports.py`
- Impact: Polutes logs, exposes internal data structures in production
- Fix approach: Remove DEBUG statements or replace with proper logging

---

## Test Coverage Gaps

### Missing Backend Tests

**Not tested:**
- `/environments/{env_id}/modules/` endpoint (doesn't exist)
- `sync_service.py` - sync operations
- `odoo_client.py` - Odoo XML-RPC calls
- `encryption.py` - encryption/decryption
- Repository layer for environment and module
- API endpoints for environments CRUD (only basic test exists)

### Frontend Test Coverage

**Current state:** Only 3 test files exist
- `frontend/src/__tests__/pages/control-parameters.test.tsx`
- `frontend/src/__tests__/components/sheet.test.tsx`
- `frontend/src/__tests__/components/dialog.test.tsx`

**Missing:**
- No tests for API clients
- No tests for hooks (`useModuleMaster.ts`, `useEnvironmentModules.ts`, etc.)
- No tests for authentication flow
- No tests for RBAC UI behavior

---

## Performance Bottlenecks

### N+1 Query Potential

**Problem:** Fetches all modules then loops, calling `get_latest_sync_record` per environment per module
- Files: `backend/app/api/v1/reports.py` lines 100-104
- Cause: No batch query, sequential lookups for each module/environment combo
- Improvement path: Pre-fetch all sync records in single query, join with modules

### No Pagination on Reports Endpoint

**Problem:** Returns all modules across all environments in single response
- Files: `backend/app/api/v1/reports.py`
- Cause: Loads entire dataset for comparison matrix
- Improvement path: Add pagination or streaming response

### Synchronous Progress Updates During Sync

**Problem:** Progress commits on every module iteration
- Files: `backend/app/services/sync_service.py` lines 84-86
- Cause: `db.commit()` inside loop
- Improvement path: Batch commits or deferred updates

### Unbounded Query in get_all_with_filters

**Problem:** Uses `.count()` then separate query for results
- Files: `backend/app/repositories/development_request.py` lines 82-88
- Cause: Two queries for paginated result
- Improvement path: Use window function or single query with count

---

## Code Quality Issues

### Type Safety Issues

**Model/Response type mismatches:**
- Issue: ORM models passed where Response schemas expected
- Files: `backend/app/api/v1/development_requests.py` lines 67-70
- Impact: Runtime errors possible, not caught by type checker at runtime
- Fix approach: Use `.model_validate()` to convert models to responses

**Optional value accessed without null check:**
- Issue: Multiple places access `request_state` on potentially None values
- Files: `backend/app/api/v1/development_requests.py` lines 224, 301, 319, 365, 388
- Impact: AttributeError if request not found
- Fix approach: Add null checks or use Optional types properly

**Repository return type inconsistencies:**
- Issue: Methods return `None` but return type annotation says `DevelopmentRequest`
- Files: `backend/app/repositories/development_request.py` lines 107, 127
- Impact: Type error at runtime if called without null check
- Fix approach: Update return type to `Optional[DevelopmentRequest]`

---

## Documentation vs Implementation Gaps

### AGENTS.md Requirements Not Met

| Requirement | Status |
|-------------|--------|
| `GET /api/v1/modules/master/` | ✅ Implemented |
| `GET /api/v1/environments/{env_id}/modules/` | ❌ Missing |
| Pagination with `page`, `limit` defaults | ⚠️ Inconsistent defaults |
| `sort_by`, `sort_order`, `search` params | ⚠️ Partial |
| `group_by` param | ❌ Not implemented |
| RBAC CRUD by role | ❌ Not enforced |
| Line item ownership verification | ❌ Not implemented |
| Circular parent detection | ⚠️ Test exists, unclear implementation |

---

*Concerns audit: 2026-04-05*
