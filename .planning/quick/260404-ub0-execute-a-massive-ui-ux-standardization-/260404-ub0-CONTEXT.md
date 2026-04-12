# Quick Task 260404-ub0: Execute a massive UI/UX standardization and bug-fix pass across the frontend - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Task Boundary

Execute a massive UI/UX standardization and bug-fix pass across the frontend. Focus strictly on solving the visual and structural issues listed below. Do not implement backend Python changes; build the frontend components to anticipate the updated API contracts listed at the end.

</domain>

<decisions>
## Implementation Decisions

### Scope Decision
- All tables in the application must be upgraded to Universal Table Pattern (not just specific pages)

### API Strategy
- Build frontend with API calls ready, even if backend not implemented yet
- Frontend should anticipate: page/limit pagination, sort_by/order sorting, filter parameters

### Testing Approach
- Add automated visual regression tests where feasible
- Primary verification through manual testing across affected pages

### UI Fixes Priority
- Dropdown/Popover visibility - fully opaque, legible in both modes
- Table header overlap - strict visual boundary, scrolling content behind headers

</decisions>

<specifics>
## Specific Ideas

**Universal Table Pattern Requirements:**
- Server-side pagination: 15 records per page default
- Column sorting: Shadcn table sorting UI indicators
- Advanced filtering: Multi-column filter inputs
- Group-by views: Toggle for grouping by primary categories

**Module Master Page:**
- Display first_seen_date column
- Technical Name filter
- Universal Table Pattern

**Environment Details Page:**
- Add new table beneath summary cards
- Module Details, Installed Versions, Dependency Versions
- Universal Table Pattern (15 records/page, sorting, filters, group-by)

</specifics>

<canonical_refs>
## Canonical References

- Shadcn table components for implementation
- AGENTS.md for project conventions and API contract specs

</canonical_refs>