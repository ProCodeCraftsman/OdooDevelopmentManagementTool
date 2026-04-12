---
phase: 12-group-by-dynamic
plan: 01
subsystem: backend-api, frontend-api
tags: [group-by, grouping-filter, API-extensions]
dependency_graph:
  requires: []
  provides:
    - backend/app/repositories/request_module_line.py
  affects:
    - backend/app/api/v1/development_requests.py
    - frontend/src/api/development-requests.ts
tech_stack:
  added:
    - RequestType, RequestState, FunctionalCategory, Priority, User model imports
  patterns:
    - SQLAlchemy JOINs with outerjoin for nullable relationships
    - Type-safe group_by parameter handling
key_files:
  created: []
  modified:
    - backend/app/repositories/request_module_line.py
    - frontend/src/api/development-requests.ts
decisions:
  - Use COALESCE for null handling in assigned_developer grouping
  - Order priority groups by level desc, then name
metrics:
  duration: ~60s
  completed: 2026-04-11
---

# Phase 12 Plan 01: Group By API Support Summary

## One-Liner

Extended backend and frontend API to support grouping DR Module Lines view by request Type, State, Category, Priority, or Assignee attributes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|-------|-------|
| 1 | Extend backend group_by support | c623a63 | backend/app/repositories/request_module_line.py |
| 2 | Update frontend API types | c623a63 | frontend/src/api/development-requests.ts |

## Implementation Details

### Backend Changes (Task 1)

Extended `get_group_counts()` in `backend/app/repositories/request_module_line.py`:

- **New group_by values supported:**
  - `request_type`: JOIN with RequestType, group by name, ordered by display_order
  - `request_state`: JOIN with RequestState, group by name and category
  - `functional_category`: JOIN with FunctionalCategory, group by name
  - `priority`: JOIN with Priority, ordered by level desc (highest first)
  - `assigned_developer`: LEFT JOIN with User, COALESCE for null → "Unassigned"

- **Returns:** `{key, label, count}` format for each group

### Frontend Changes (Task 2)

Updated `DevelopmentRequestLineFilters` interface in `frontend/src/api/development-requests.ts`:

```typescript
group_by?: "module" | "uat_status" | "request_type" | "request_state" | "functional_category" | "priority" | "assigned_developer";
```

## Verification

- Backend: Python imports OK
- Frontend: TypeScript compiles without errors

## Deviations from Plan

None - plan executed exactly as written.

## Auth Gates

None in this plan.

## Self-Check: PASSED

- 12-01-SUMMARY.md created at: `.planning/phases/12-group-by-dynamic/12-01-SUMMARY.md`