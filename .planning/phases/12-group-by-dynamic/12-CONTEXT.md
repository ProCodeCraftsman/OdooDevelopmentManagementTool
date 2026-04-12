# Phase 12: Dynamic Group By for Development Request Line View

## Phase Overview

**Objective:** Implement a dynamic Group By functionality for the Development Request Line View. Transform a flat list of items into an organized, collapsible structure where rows are clustered under attribute-specific headings, mirroring the UX of OpenProject.

---

## Functional Requirements

### Grouping Attributes

The user must be able to group the entire view by the following fields:

1. **Type** (e.g., Bug, Feature, Task)
2. **State** (e.g., New, In Progress, Resolved)
3. **Category** (Functional area)
4. **Priority** (Low, Medium, High, Urgent)
5. **Assignee** (Individual developer or "Unassigned")

---

## Implementation Context

### Existing Code

**Frontend:**
- Main view: `frontend/src/pages/development-requests/lines-list.tsx`
- API types: `frontend/src/api/development-requests.ts` (lines 121-130)
  - `RequestModuleLineWithRequest` extends `RequestModuleLine` with `request: DevelopmentRequestBrief`
  - `DevelopmentRequestLineFilters` includes `group_by?: "module" | "uat_status"` (currently limited)
- Hooks: `frontend/src/hooks/useDevelopmentRequests.ts`
- API client: `frontend/src/api/development-requests.ts`

**Backend:**
- API endpoint: `/development-requests/lines/all` in `backend/app/api/v1/development_requests.py`
- Current filter options: `module_names`, `uat_statuses`, `search`
- The API currently supports grouping by "module" and "uat_status" in the filter

### Data Structure

From the API types, each line contains:
- `request_id`, `request` (DevelopmentRequestBrief with type/state/category/priority/assignee)
- `module_technical_name`, `module_version`, `module_md5_sum`
- `uat_status`, `uat_ticket`, `tec_note`

The `request` object includes:
- `request_type_id`, `request_type: RequestTypeBrief`
- `functional_category_id`, `functional_category: FunctionalCategoryBrief`
- `request_state_id`, `request_state: RequestStateBrief`
- `priority_id`, `priority: PriorityBrief`
- `assigned_developer_id`, `assigned_developer: UserBrief | null`

---

## Design Decisions

1. **OpenProject-style UX** — Collapsible group headers with row counts, expand/collapse all, smooth animations

2. **Group state persistence** — Remember expanded/collapsed state in localStorage or URL params

3. **Multiple grouping options** — Single grouping at a time (Type OR State OR Category OR Priority OR Assignee)

4. **Unassigned handling** — When grouping by Assignee, show "Unassigned" as a group for null assignee

5. **Backend support** — Extend existing `group_by` filter to support new values (request_type, request_state, functional_category, priority, assigned_developer)

6. **Empty group handling** — Groups with 0 items should be hidden or shown as collapsed

---

## Scope Boundaries

**In Scope:**
- Group by dropdown/selector in the lines-list page
- Backend grouping support via API filter
- Collapsible group headers with item counts
- Expand all / Collapse all controls
- Preserve group state in URL or localStorage

**Out of Scope:**
- Multi-level grouping (multiple fields at once)
- Drag-and-drop reordering within groups
- Group-based filtering within a group