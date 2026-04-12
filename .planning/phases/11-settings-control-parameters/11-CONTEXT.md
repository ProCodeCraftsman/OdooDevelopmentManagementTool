# Phase 11: Settings Menu & Control Parameters Enhancement

## Phase Overview

**Objective:** Enhance the settings menu with control parameter editing capabilities and implement configurable control parameter rules for request state transitions.

---

## Requirements

### 1. UI Enhancements - Control Parameters Screen

**Current State:**
- Control parameters screen displays a "Usage" column showing usage count per parameter
- No edit functionality exists - parameters can only be created and archived/restored

**Required Changes:**

1. **Remove Usage Column** - Remove the "Usage" column from all control parameter tables (Request Types, Request States, Priorities, Functional Categories)

2. **Add Edit Functionality** - Add edit capability for control parameters with restrictions:
   - **ALLOW editing:** description only
   - **DO NOT allow editing:** name, category (for Request Types/Request States), level (for Priorities)
   - This prevents changing the "type" of a parameter while keeping historical integrity

### 2. Backend - Control Parameter Rules

Implement configurable rules that define which combinations of request type, state, priority, and functional category are allowed based on the request's current state.

**Rule Matrix:**

| Request State | Allowed Request Type Category | Allowed Priority | Functional Category |
|---------------|-------------------------------|-------------------|---------------------|
| Open - Request under Review | ALL | All Priorities | All Functional Categories |
| Accepted - On Hold | ALL | All Priorities | All Functional Categories |
| In Progress | ALL | All Priorities | All Functional Categories |
| Testing (Dev) | Development | All Priorities | All Functional Categories |
| Closed - Development | Development | All Priorities | All Functional Categories |
| Deployed to Staging | Development | All Priorities | All Functional Categories |
| UAT - Initiated | Development | All Priorities | All Functional Categories |
| UAT - Completed | Development | All Priorities | All Functional Categories |
| UAT - Failed | Development | All Priorities | All Functional Categories |
| Deployed to Production | Development | All Priorities | All Functional Categories |
| Closed - Configuration | Non Development | All Priorities | All Functional Categories |
| Rejected/Cancelled | ALL | All Priorities | All Functional Categories |

**Implementation Requirements:**
- Store rules in database (new `ControlParameterRule` model)
- Admin UI to configure rules (enable/disable rule enforcement)
- Default to the above rules when system is first initialized
- Service layer validates requests against rules before state transitions

---

## Technical Context

### Existing Code Structure

**Backend:**
- Control parameters in: `backend/app/models/control_parameters/`
- API endpoints in: `backend/app/api/v1/development_requests.py` (lines 56-197)
- Schemas in: `backend/app/schemas/control_parameters.py`
- Service validation in: `backend/app/services/development_request_service.py`

**Frontend:**
- Control parameters page: `frontend/src/pages/settings/control-parameters.tsx`
- API client: `frontend/src/api/control-parameters.ts`
- Hooks: `frontend/src/hooks/useControlParameters.ts`

### Key Interfaces

From `backend/app/schemas/control_parameters.py`:
```python
class RequestTypeResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: str
    is_active: bool
    display_order: int
    created_at: datetime
```

From `frontend/src/api/control-parameters.ts`:
```typescript
interface ControlParameterWithUsage {
  id: number;
  name: string;
  description: string | null;
  category?: string;
  level?: number;
  is_active: boolean;
  display_order: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}
```

---

## Design Decisions

1. **Edit restrictions** - Name/category/level are locked because changing them could break historical data integrity and existing rules. Description is editable as it's metadata.

2. **Rules storage** - Store in database to allow admin configuration, not hardcoded. This aligns with "configurable for admin" requirement.

3. **Usage column removal** - The usage column adds visual clutter for information that's not actionable (archive is already disabled when in use). Simplifies the UI.

---

## Scope Boundaries

**In Scope:**
- Remove usage column from UI
- Add edit button with inline/sheet edit form
- Backend edit endpoint with field restrictions
- Control Parameter Rules model and API
- Admin UI to manage rules

**Out of Scope:**
- Changing the name/category/level of control parameters (intentionally restricted)
- Advanced rule conditions beyond the matrix
- Bulk operations on parameters
