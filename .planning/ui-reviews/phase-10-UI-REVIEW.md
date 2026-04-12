# Phase 10 — UI Review

**Audited:** 2026-04-04
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md exists)
**Screenshots:** captured (.planning/ui-reviews/phase-10-20260404-130536/)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Minor issues with generic labels, mostly user-facing copy is good |
| 2. Visuals | 3/4 | Good visual hierarchy, but detail page lacks proper left/right column layout |
| 3. Color | 4/4 | Proper use of design tokens, no hardcoded colors |
| 4. Typography | 3/4 | Multiple font sizes (5+) and weights (3+) in use, could be more consistent |
| 5. Spacing | 4/4 | Consistent use of Tailwind spacing scale, no arbitrary values |
| 6. Experience Design | 2/4 | Missing server-side pagination, permission checks incomplete, reopen not wired |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **Server-side pagination missing** — Current implementation fetches ALL requests client-side, causing performance issues with large datasets. Add `page`/`limit` params and Shadcn pagination controls.

2. **Permission checks incomplete** — Detail page form inputs don't check `data?.permissions?.can_update` before enabling editing. Add `disabled={!data?.permissions?.can_update}` to all interactive inputs.

3. **Reopen workflow not wired** — The reopen modal exists but doesn't call the API (lines 286-288 in detail.tsx are no-ops). Wire up actual `useReopenDevelopmentRequest` mutation.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- **Status**: Generally good, uses descriptive labels
- **Issues Found**:
  - Generic "Cancel" button labels (detail.tsx:284, form.tsx:284) - could be more specific like "Cancel Changes"
  - Empty state uses generic "No development requests found" (list.tsx:180) - acceptable
- **Evidence**: Found 31 "Submit/Cancel/Save" patterns, 3 "Empty" patterns
- **Recommendation**: Minor improvements only, not blocking

### Pillar 2: Visuals (3/4)
- **Status**: Good visual hierarchy with badges for state/priority
- **Issues Found**:
  - Detail page (detail.tsx) lacks proper left/right column layout as specified
    - Current: Single column with cards stacked
    - Expected: Left column (main form), Right column (metadata), Bottom sections (module lines, release plans)
  - No visual focal point on main list page beyond table
- **Evidence**: Screenshots show desktop (1440x900), mobile (375x812), tablet (768x1024)
- **Recommendation**: Restructure detail.tsx to match 3-section layout

### Pillar 3: Color (4/4)
- **Status**: Excellent - uses design tokens properly
- **Evidence**:
  - 13 uses of `text-primary`, `bg-primary`, `border-primary` - all in appropriate contexts
  - No hardcoded colors found (no hex codes or rgb() in code)
  - Uses semantic color for badges (state/priority)
- **Recommendation**: None needed

### Pillar 4: Typography (3/4)
- **Status**: Works but could be more consistent
- **Evidence**:
  - 146 text-size classes used across codebase
  - 5 distinct sizes: text-xs, text-sm, text-base, text-lg, text-2xl, text-3xl, text-xl
  - 3 font weights: font-medium, font-semibold, font-bold
- **Issues Found**:
  - Inconsistent usage - some headers use text-2xl, others text-xl
  - Mix of font-medium and font-semibold for similar elements
- **Recommendation**: Create typography token scale in tailwind.config.js

### Pillar 5: Spacing (4/4)
- **Status**: Excellent - consistent Tailwind spacing
- **Evidence**:
  - 237 spacing classes used consistently
  - Uses standard scale: space-y-6, gap-4, p-6, etc.
  - No arbitrary values like `[10px]` or `[1rem]`
- **Recommendation**: None needed

### Pillar 6: Experience Design (2/4)
- **Status**: Multiple gaps in UX
- **Critical Issues**:
  1. **No server-side pagination** (list.tsx:56)
     - `useDevelopmentRequests(filters)` fetches all records
     - No `page`/`limit` params passed to API
     - No Shadcn Pagination component
     - TanStack Query `placeholderData: keepPreviousData` not used
  
  2. **Permission checks incomplete** (detail.tsx)
     - Lines 84-85 check `canEdit` and `canReopen` for buttons
     - BUT form inputs don't check permission before enabling
     - Every Select/Input should have `disabled={!data?.permissions?.can_update}`
  
  3. **Reopen workflow not wired** (detail.tsx:286-288)
     - Clicking "Reopen Request" just calls `setShowReopenDialog(false)`
     - Doesn't call API or pass comment
     - Should use `useReopenDevelopmentRequest` mutation
  
  4. **Missing control parameter settings page**
     - No `/settings/control-parameters` route
     - No tabs for Request Types, States, Categories, Priorities
     - No archive functionality
  
  5. **No onError 403 handling in hooks** (useDevelopmentRequests.ts)
     - Missing `onError` callback to detect 403 and invalidate queries
  
- **Positive**:
  - Skeleton loading states present
  - Error states displayed
  - Error boundary exists (main.tsx:17)
- **Recommendation**: Implement all items above in priority order

---

## Files Audited

| File | Lines | Issues |
|------|-------|--------|
| `frontend/src/pages/development-requests/list.tsx` | 245 | No pagination, filters not debounced |
| `frontend/src/pages/development-requests/detail.tsx` | 294 | Permission checks incomplete, reopen not wired |
| `frontend/src/pages/development-requests/form.tsx` | 297 | OK |
| `frontend/src/hooks/useDevelopmentRequests.ts` | 104 | Missing onError handlers |
| `frontend/src/api/development-requests.ts` | 199 | Types exist, need pagination params |
| `frontend/src/App.tsx` | 74 | Missing control-parameters route |

---

## Screenshots

| Viewport | File |
|----------|------|
| Desktop | `.planning/ui-reviews/phase-10-20260404-130536/desktop.png` |
| Mobile | `.planning/ui-reviews/phase-10-20260404-130536/mobile.png` |
| Tablet | `.planning/ui-reviews/phase-10-20260404-130536/tablet.png` |

---

## Next Steps

Based on the audit, execute the enhancement plan created at `.opencode/DEV_REQUEST_UI_ENHANCEMENT_PLAN.md` with these priority fixes:

1. **P0**: Add onError callback with 403 handling in React Query hooks
2. **P0**: Implement server-side pagination with Shadcn controls
3. **P1**: Add permission checks to all form inputs in detail view
4. **P1**: Create Control Parameters Settings page
5. **P2**: Wire up reopen workflow API call
