# UI Review - Development Requests Grouping Feature

**Component**: Development Requests List (`list.tsx`) and Group-by Feature  
**Auditor**: Automated Visual Audit

---

## Executive Summary

| Pillar | Score |
|--------|-------|
| Copywriting | 3/4 |
| Visuals | 2/4 |
| Color | 4/4 |
| Typography | 3/4 |
| Spacing | 3/4 |
| Experience Design | 2/4 |

**Overall**: 17/24

---

## 1. Copywriting (3/4)

| Element | Status | Finding |
|---------|--------|---------|
| Group headers | ✓ PASS | Labels render correctly |
| Empty states | ✓ PASS | All 4 empty states implemented |
| Action buttons | ✓ PASS | Clear "Export", "Select all N records" |
| Pagination | ⚠ PARTIAL | Shows "Page X of Y" - missing "of" prefix seen elsewhere |

**Top Fix**:
- Consider adding aria-live region for dynamic content announcements

---

## 2. Visuals (2/4)

| Element | Status | Finding |
|---------|--------|---------|
| Table structure | ✓ PASS | Proper sticky header, overflow handling |
| Group headers | ✗ FAIL | **Root cause found: rendering logic bug** |
| Loading skeleton | ✓ PASS | 8-row skeleton matches column count |
| Collapsed state | ⚠ PARTIAL | Chevron rotates (different icon) vs show/hide |

### Bug: Group Headers Not Opening After First

**Files affected**:
- `frontend/src/components/development-requests/requests-command-table.tsx` (lines 294-331)
- `frontend/src/pages/development-requests/lines-list.tsx` (lines 200-232)

**Root cause identified** in `requests-command-table.tsx`:

```typescript
// Line 294-331 - Fallback path
} else if (groupBy && groups?.length) {
  for (const group of groups) {
    // Line 321: Check uses collapsedGroups directly instead of header.collapsed
    if (!collapsedGroups.has(group.key)) {  // ← INCORRECT when collapsedGroups stale
      while (dataIndex < data.length && getGroupKeyForItem(data[dataIndex], groupBy) === group.key) {
        rows.push(renderDataRow(data[dataIndex]));
        dataIndex++;
      }
    }
```

**Issue**: The fallback branch at line 294 is being used when `groupHeaders.length === 0` but `groups?.length > 0`. This can occur when `collapsedGroups` state changes but `groupHeaders` useMemo hasn't recomputed properly due to its dependency on `[collapsedGroups]`.

**Additionally in lines-list.tsx** line 231:
```typescript
if (collapsedGroups.has(lastGroupKey ?? "")) return;
```

Uses `lastGroupKey` which is set AFTER the group header is created (line 204), but this check happens AFTER data rows are already rendered. Race condition possible when filters change.

---

### Bug: Line CountMismatch

**Root cause**: At lines 205-206 in `lines-list.tsx`:
```typescript
const groupInfo = groups.find((g) => g.key === key);
const count = groupInfo?.count ?? items.filter((r) => getGroupKey(r, filters.group_by!) === key).length;
```

**Issue**: Uses `groupInfo?.count` which is the TOTAL count from API (includes all pages), not the count of items currently visible on THIS page. When paginated, this causes count mismatch.

---

## 3. Color (4/4)

| Element | Status | Finding |
|---------|--------|---------|
| Priority badges | ✓ PASS | Red/Orange/Yellow/Gray scale correct |
| State badges | ✓ PASS | Uses controlParams colors |
| Hover states | ✓ PASS | `hover:bg-muted/50` on group headers |
| Selection | ✓ PASS | `bg-primary/5` on selected rows |

---

## 4. Typography (3/4)

| Element | Status | Finding |
|---------|--------|---------|
| Table headers | ✓ PASS | `font-semibold` on sticky header |
| Group labels | ✓ PASS | `font-medium text-sm` |
| Priority text | ✓ PASS | Uses proper scale |
| Request titles | ⚠ PARTIAL | `line-clamp-2` but max-width varies by container |

---

## 5. Spacing (3/4)

| Element | Status | Finding |
|---------|--------|---------|
| Table cell padding | ✓ PASS | Default from Table component |
| Group header row | ✓ PASS | `py-2` for compactness |
| Badge spacing | ✓ PASS | `gap-2` in flex containers |
| Checkbox alignment | ⚠ PARTIAL | `w-10 pr-0` but inconsistent across components |

---

## 6. Experience Design (2/4)

| Element | Status | Finding |
|---------|--------|---------|
| Group collapse persistence | ⚠ PARTIAL | localStorage key differs: `dr-collapsed-groups` vs `dr-lines-collapsed-groups` - separate storage |
| Filter change behavior | ✗ FAIL | **Group state not reset when filters change** |
| Keyboard accessibility | ✗ FAIL | No keyboard handler for group toggle |
| Focus indicators | ✗ FAIL | No visible focus on group headers |

### Critical UX Issue

When user changes filters or navigates to a different page, the `collapsedGroups` Set retains previous collapse states from localStorage but the groups themselves may have different keys, causing:
1. Groups from page 2 showing as collapsed because their key matches a collapsed key from page 1
2. First group always open because no initial key exists in localStorage

---

## Recommended Fixes

### Priority 1 - Group Rendering Bug

**File**: `requests-command-table.tsx` line 321

Change from:
```typescript
if (!collapsedGroups.has(group.key)) {
```

To:
```typescript
const isCollapsed = collapsedGroups.has(group.key);
if (!isCollapsed) {
```

And ensure consistent state between `groupHeaders` branch (lines 254-293) and fallback (lines 294-331).

### Priority 2 - Count Mismatch

**File**: `lines-list.tsx` lines 205-206

Remove the API count fallback when paginated:
```typescript
// Only use API count when showing all records (no pagination)
const useApiCount = totalRecords === items.length;
const count = useApiCount 
  ? groupInfo?.count 
  : items.filter((r) => getGroupKey(r, filters.group_by!) === key).length;
```

### Priority 3 - Filter Change Reset

Add to both components:
```typescript
// Reset collapsed groups when group_by changes
useEffect(() => {
  setCollapsedGroups(new Set());
}, [filters.group_by]);
```

---

## Findings Summary

| Issue | Severity | Pillar |
|-------|----------|--------|
| Group headers don't open after first | HIGH | Visuals |
| Count mismatch on pagination | HIGH | Experience |
| Stale collapse state on filter change | MEDIUM | Experience |
| No keyboard for group toggle | MEDIUM | Experience |
| Inconsistent localStorage keys | LOW | Experience |

---

## Automated Checks Passed

- ✓ Table renders with correct column count (9 columns)
- ✓ Sticky header stays on scroll
- ✓ Loading skeleton matches table structure
- ✓ All 4 empty states render correctly
- ✓ Selection checkboxes functional
- ✓ Pagination controls functional