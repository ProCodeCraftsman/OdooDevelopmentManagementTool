# Frontend Next Phase Plan

## Executive Summary

This phase addresses the highest-impact gaps in the React frontend for the Odoo Module Dependency & Version Auditor application.

| Priority | Feature | Impact | User Decision |
|----------|---------|--------|---------------|
| P1 | Dialog/Modal Transparency Fix | Critical UX | Fix immediately |
| P2 | Control Parameters Settings | High | Toggle filter, prevent if in-use |
| P3 | Add Module Lines Modal | Medium | Search from module master, editable version |
| P4 | Archive Request (Soft Delete) | Medium | Archive, cascade children |
| P5 | Dark Mode | Low | Sidebar footer toggle |

---

## User Decisions (Locked)

| Decision | Value |
|----------|-------|
| Control Parameters Archive | Toggle filter, NOT available in dropdowns once archived |
| Control Parameters In-Use | **Prevent archiving** if any requests use it |
| Module Lines Module Search | Search from **Module Master** (all-time list) |
| Module Lines Version | Initial from dev env, but **editable text field** |
| Module Lines Approach | **Search-first** (search module master) |
| Ghost Modules | Modules persist in module master forever |
| Delete Strategy | **Soft delete (archive)**, NOT hard delete |
| Archive Children | **Cascade archive** (children also archived) |
| Dark Mode Toggle | **Sidebar footer**, next to user info |
| Dev Environment | **Category = "Development" + Highest order value** |

### Primary Development Environment Identification

For module version lookup, the "primary development environment" is identified by:
1. **Category** = "Development"
2. **Order** = Highest value among Development environments

**Backend Query Logic:**
```python
# Get primary dev environment for version lookup
primary_dev_env = (
    db.query(Environment)
    .filter(
        Environment.category == "Development",
        Environment.is_active == True
    )
    .order_by(Environment.order.desc())
    .first()
)
```

**Edge Cases:**
- [ ] No Development environment exists → Show "No dev environment configured"
- [ ] Multiple Development environments → Use highest order (most "primary")
- [ ] Development environment not synced → Show "Sync dev environment to populate versions"

---

## Task Breakdown

### Task 1: Dialog/Modal Transparency Fix (P1 - FOUNDATION)

**Critical Issue:** All popups and dropdowns are transparent, making the user experience unacceptable.

**Files to Modify:**
- `frontend/src/components/ui/dialog.tsx`
- `frontend/src/components/ui/sheet.tsx`
- `frontend/src/components/ui/dropdown-menu.tsx`
- `frontend/src/components/ui/popover.tsx` (if exists)

**Required Fixes:**

```typescript
// dialog.tsx - DialogOverlay
// BEFORE: bg-black/50 or bg-black/80 (TRANSPARENT)
<DialogOverlay className="fixed inset-0 z-50 bg-black/80" />

// AFTER: bg-black/95 (OPAQUE)
<DialogOverlay className="fixed inset-0 z-50 bg-black/95" />
```

```typescript
// sheet.tsx - SheetOverlay  
// BEFORE: bg-black/50 with backdrop-blur (TRANSPARENT)
<SheetOverlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />

// AFTER: bg-black/95 NO blur (OPAQUE)
<SheetOverlay className="fixed inset-0 z-50 bg-black/95" />
```

**Edge Cases:**
- [ ] Nested sheets inside dialogs
- [ ] Mobile viewport (smaller backdrop)
- [ ] Animation flicker during transitions
- [ ] Context menu (right-click) z-index

**Acceptance Criteria:**
- [ ] All Dialog overlays at minimum `bg-black/90`
- [ ] All Sheet overlays at minimum `bg-black/90`
- [ ] No backdrop-blur causing transparency
- [ ] Test on white, gray, and colored backgrounds
- [ ] Test on dark backgrounds (dark mode ready)

---

### Task 2: Control Parameters Settings Page (P2)

**Route:** `/settings/control-parameters`

**Layout:** Tabbed interface with 4 tabs
- Request Types
- Request States  
- Priorities
- Functional Categories

**Files to Create:**

```
frontend/src/
├── pages/settings/
│   └── control-parameters.tsx      # Main page with tabs
├── api/
│   └── control-parameters.ts       # API client (new file)
└── hooks/
    └── useControlParameters.ts     # TanStack Query hooks
```

**Files to Modify:**
- `frontend/src/App.tsx` — Add route
- `frontend/src/components/layout/sidebar.tsx` — Add nav item

**Backend APIs Needed:**

```
GET  /control-parameters/types/           # List active types
GET  /control-parameters/types/all        # List all (including archived)
POST /control-parameters/types/           # Create type
PATCH /control-parameters/types/{id}/     # Update type
POST /control-parameters/types/{id}/archive/     # Archive (FAILS if in-use)
POST /control-parameters/types/{id}/restore/     # Restore from archive

GET  /control-parameters/states/         # Same pattern
GET  /control-parameters/priorities/     # Same pattern
GET  /control-parameters/categories/     # Same pattern
```

**Response Schema (for each type):**
```typescript
interface ControlParameter {
  id: number;
  name: string;
  category?: string;      // For types/states
  level?: number;         // For priorities (1-5)
  is_archived: boolean;
  usage_count: number;    // How many requests use this
  created_at: string;
  updated_at: string;
}
```

**UI Behavior:**

| Action | Behavior |
|--------|----------|
| Create | Dialog with name, category/level field |
| Edit | Pre-populated dialog, CANNOT edit archived |
| Archive | **BLOCKED** if `usage_count > 0` with error message |
| Restore | Re-enables the parameter |
| Filter | Toggle "Show Archived" at top |

**Edge Cases:**
- [ ] Empty state for each tab
- [ ] Duplicate name validation
- [ ] Prevent edit when archived
- [ ] Show usage_count before archive attempt
- [ ] 403 handling for non-admin users

**Form Schema:**
```typescript
const typeSchema = z.object({
  name: z.string().min(1, "Name required").max(100),
  category: z.string().optional(),
});

const prioritySchema = z.object({
  name: z.string().min(1, "Name required").max(50),
  level: z.number().int().min(1).max(5),
});

const stateSchema = z.object({
  name: z.string().min(1, "Name required").max(100),
  category: z.enum(["open", "in_progress", "closed", "cancelled"]),
});
```

---

### Task 3: Add Module Lines Modal (P3)

**Location:** Development Request Detail page

**Files to Create/Modify:**
```
frontend/src/
├── components/development-requests/
│   └── add-module-line-dialog.tsx   # NEW
└── pages/development-requests/
    └── detail.tsx                   # Add button + integrate dialog
```

**Backend APIs Needed:**

```
GET /modules/master/search?q={query}&limit=20
- Search modules from Module Master (all-time list)
- Returns: [{ technical_name, id }]

GET /modules/master/{technical_name}/dev-versions
- Get available versions from PRIMARY dev environment
- Returns: [{ version_string, md5_sum, last_sync }]
```

**Response Schema:**
```typescript
interface ModuleSearchResult {
  technical_name: string;
  module_master_id: number;
}

interface DevVersion {
  version_string: string;
  md5_sum: string | null;
  last_sync: string;
}
```

**UI Flow:**

```
1. User clicks "Add Module Line" button
   ↓
2. Dialog opens with search input
   ↓
3. User types module name
   ↓
4. Debounced search (300ms) against /modules/master/search
   ↓
5. Dropdown shows matching modules
   ↓
6. User selects module
   ↓
7. System fetches /modules/master/{name}/dev-versions
   ↓
8. Version field populated with latest version (editable)
   ↓
9. User optionally edits version, adds MD5, adds email zip
   ↓
10. User submits
   ↓
11. API: POST /development-requests/{id}/modules/
```

**Form Fields:**

| Field | Source | Editable |
|-------|--------|----------|
| Module Technical Name | Module Master (search) | No (select only) |
| Module Version | Dev Env (latest) | **Yes (text field)** |
| MD5 Sum | User input | Yes |
| Email Thread Zip | User input | Yes |

**Key Decision:** Version is a simple text field, pre-populated for convenience but user can override.

**Edge Cases:**
- [ ] No modules in Module Master → Show "No modules found, sync an environment first"
- [ ] Module found but no versions in dev env → Show "No versions found for this module in dev environment"
- [ ] Search returns no results → Show "No matching modules"
- [ ] Network error → Show error with retry
- [ ] Debounce search to avoid excessive API calls

**Acceptance Criteria:**
- [ ] Search input with debounced autocomplete
- [ ] Module dropdown shows technical_name
- [ ] Version pre-populated but editable
- [ ] MD5 and Email fields for manual entry
- [ ] Form validation (module required, others optional)
- [ ] Loading states for search and version fetch
- [ ] Permission check: only show if `can_add_module_lines`

---

### Task 4: Archive Request (Soft Delete) (P4)

**Changes to Detail Page:**
- Rename "Delete" button to "Archive"
- Change confirmation dialog text
- Handle cascade archive for children

**Files to Modify:**
- `frontend/src/pages/development-requests/detail.tsx`

**Backend APIs Needed:**

```
POST /development-requests/requests/{id}/archive/
- Soft delete (set is_archived = true)
- Returns: Updated request

POST /development-requests/requests/{id}/restore/
- Unarchive (set is_archived = false)
- Returns: Updated request

GET /development-requests/requests/?is_archived=true
- List archived requests (for filtering)
```

**Backend Logic (Cascade):**
```python
# When archiving request with children:
for child in request.children:
    child.is_archived = True
    child.archived_at = now()
    child.archived_by = current_user
    # Recursively archive grandchildren if needed
```

**UI Behavior:**

| Scenario | Behavior |
|----------|----------|
| Archive button | Shows if `can_delete` permission |
| Confirmation | "Archive this request? Child requests will also be archived." |
| Success | Toast + redirect to list |
| Restore | Button in detail view if archived |
| List view | Toggle "Include Archived" to show archived |

**Edge Cases:**
- [ ] No children → Simple confirmation
- [ ] Has children → Show count in warning
- [ ] Has grandchildren → Cascade warning message
- [ ] Already archived → Show "Restore" instead of "Archive"
- [ ] Network error → Show error toast

**List View Changes:**
```typescript
// Add filter state
const [includeArchived, setIncludeArchived] = useState(false);

// Add to query params
const filters = {
  ...currentFilters,
  is_archived: includeArchived ? undefined : false, // false = exclude archived
};
```

---

### Task 5: Dark Mode Implementation (P5)

**Files to Create/Modify:**
```
frontend/src/
├── components/providers/
│   └── theme-provider.tsx    # NEW (or update if exists)
├── components/layout/
│   └── sidebar.tsx           # Add toggle
└── App.tsx                   # Wrap with provider
```

**Setup Required:**

```typescript
// theme-provider.tsx
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

**Tailwind Config Update:**
```javascript
// tailwind.config.js
export default {
  darkMode: 'class', // or 'media' for system preference
  // ...
}
```

**CSS Variables (already should exist):**
```css
:root {
  --background: #ffffff;
  --foreground: #020817;
  /* ... other variables */
}

.dark {
  --background: #020817;
  --foreground: #f8fafc;
  /* ... dark variants */
}
```

**Sidebar Toggle UI:**
```
┌─────────────────────────┐
│  👤 Username            │
│     Admin               │
│  ─────────────────────  │
│  🌙 Dark Mode    [  ]    │  ← Toggle switch
│  🚪 Logout              │
└─────────────────────────┘
```

**Implementation:**
- Use `useTheme` from `next-themes`
- Toggle button with sun/moon icons
- Persists to localStorage automatically

---

## UX/UI Checklist (All Tasks)

### Transparency Fix Checklist
- [ ] Dialog: `bg-black/95` on overlay
- [ ] Sheet: `bg-black/95` on overlay, NO blur
- [ ] Dropdown: solid background, proper z-index (50+)
- [ ] Popover: solid background
- [ ] Tooltip: solid background
- [ ] Context menu: solid background
- [ ] Test on light background
- [ ] Test on dark sidebar
- [ ] Test on colored cards

### Empty States
- [ ] Control Parameters: Each tab empty state
- [ ] Module search: No results state
- [ ] Module versions: No versions in dev env state
- [ ] Archived list: Empty state

### Loading States
- [ ] Skeleton for module search dropdown
- [ ] Skeleton for version fetch
- [ ] Button loading state during submit

### Error States
- [ ] Module search error with retry
- [ ] Version fetch error
- [ ] Archive blocked (in-use) error
- [ ] Network failure with toast

---

## Backend API Requirements Summary

### New Endpoints Needed:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/control-parameters/types/` | GET, POST | List/create request types |
| `/control-parameters/types/all/` | GET | List all including archived |
| `/control-parameters/types/{id}/` | PATCH | Update type |
| `/control-parameters/types/{id}/archive/` | POST | Archive (BLOCK if in-use) |
| `/control-parameters/types/{id}/restore/` | POST | Restore from archive |
| `/control-parameters/states/*` | * | Same pattern for states |
| `/control-parameters/priorities/*` | * | Same pattern for priorities |
| `/control-parameters/categories/*` | * | Same pattern for categories |
| `/modules/master/search/` | GET | Search module master |
| `/modules/master/{name}/dev-versions/` | GET | Get versions from dev env |
| `/development-requests/requests/{id}/archive/` | POST | Soft delete |
| `/development-requests/requests/{id}/restore/` | POST | Unarchive |

### Schema Changes:

**Control Parameter Response:**
```typescript
{
  id: number;
  name: string;
  category?: string;
  level?: number;
  is_archived: boolean;
  usage_count: number;  // NEW - for archive validation
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Archive Response:**
```typescript
{
  id: number;
  is_archived: boolean;
  archived_at?: string;
  archived_by?: number;
  children_archived_count: number;  // For warning message
}
```

---

## Testing Plan

### E2E Tests (Playwright):

1. **Control Parameters CRUD**
   - Create new request type
   - Edit existing type
   - Attempt archive (with usage) → should fail
   - Archive (without usage) → should succeed
   - Restore archived type

2. **Module Lines Flow**
   - Open add module dialog
   - Search for existing module
   - Select module, verify version populated
   - Edit version manually
   - Submit and verify in list

3. **Archive Request Flow**
   - Create request with child
   - Archive parent
   - Verify child also archived
   - Restore parent, verify child restored

4. **Dark Mode**
   - Toggle dark mode
   - Verify all pages render
   - Reload page, verify persistence
   - Toggle back to light

---

## Execution Order

| Phase | Tasks | Notes |
|-------|-------|-------|
| 11-01 | Task 1 | Foundation - affects all dialogs |
| 11-02 | Task 2 | Control Parameters Settings |
| 11-03 | Tasks 3, 4 | Module Lines + Archive |
| 11-04 | Task 5 | Dark Mode |

---

## Pending Backend Decisions

1. **Module Master Table**: Ensure modules are stored in a central master table, not per-environment
2. **Primary Dev Environment**: How to identify which environment is "primary dev"? By order? By name? Config?
3. **Cascade Archive**: Verify recursive cascade for grandchildren works correctly

---

*Document Version: 2.0*
*Last Updated: 2026-04-04*
*Status: Ready for execution pending backend API confirmation*
