# Searchable Multi-Select Filter + Excel Export — Global Table Pattern

**Purpose**: Canonical guide for adding column-level searchable multi-select filters and Excel export to any server-paginated table in this application.

---

## 1. Pattern Overview

Every data table that supports filtering must follow this pattern:

| Concern | Rule |
|---|---|
| Filter options source | **Server filter-options endpoint** — returns ALL unique values across the entire dataset, not just the current page |
| Filter UI component | `SearchableMultiSelect` — Radix Popover with internal search, checkbox list, badge count |
| Filter encoding | Comma-separated string query param (e.g. `state=installed,to+upgrade`) |
| Filter application | **Server-side** — filters are passed to the backend and applied before pagination |
| Excel export | Client-side via `xlsx` (SheetJS): hit a dedicated `/export` endpoint (no pagination) with the same active filters, then generate and download `.xlsx` |

### Why not client-side filtering?
When data is paginated on the server, client-side filtering only affects the current page. Users would see "10 results after filter" when really there are hundreds. All filters must be server-side.

### Why a separate `/export` endpoint?
The paginated endpoint has a `limit` cap. The export endpoint removes that cap, accepts the same filter params, and returns the full matching dataset as a JSON array. The frontend converts this to `.xlsx` without a server-side Excel library.

---

## 2. Backend Contract

### 2a. Filter-Options Endpoint

Every resource that supports column filtering must expose:

```
GET /resource/filter-options
```

Returns a flat object whose keys are `{column}_options` (or equivalent) containing sorted arrays of ALL unique values across the entire dataset for that environment/resource:

```json
{
  "module_names":   ["account", "base", "sale", ...],
  "module_states":  ["installed", "to upgrade", "uninstalled"],
  "module_versions": ["17.0.1.0.0", "17.0.2.0.0"],
  "dep_names":      [...],
  "dep_versions":   [...],
  "dep_states":     [...]
}
```

**Rule**: options must reflect the full dataset, never filtered by current pagination or other active filters.

### 2b. Paginated Endpoint — Multi-Value Filter Params

Accept comma-separated strings for every filterable column:

```python
state: Optional[str] = Query(None, description="Comma-separated states")
technical_names: Optional[str] = Query(None)
versions: Optional[str] = Query(None)
```

Parse with the shared helper:

```python
def _parse_csv(value: Optional[str]) -> Optional[List[str]]:
    if not value:
        return None
    parts = [v.strip() for v in value.split(",") if v.strip()]
    return parts if parts else None
```

Apply with `.in_()`:

```python
if state_list := _parse_csv(state):
    q = q.filter(Model.state.in_(state_list))
```

For FK-resolved filters (e.g. filtering dependencies by module technical name), resolve module IDs first via a subquery before applying:

```python
module_id_filter = _resolve_module_ids(db, env.id, module_names_list, ...)
if module_id_filter is not None:
    q = q.filter(ModuleDependency.module_id.in_(module_id_filter))
```

### 2c. Export Endpoint

```
GET /resource/export
```

- Accepts the **same filter params** as the paginated endpoint
- No `page` / `limit` params
- Returns `List[Dict[str, Any]]` — flat row objects with human-readable keys
- Example:
  ```json
  [
    {"technical_name": "account", "module_name": "Accounting", "version": "17.0.1.0.0", "state": "installed"},
    ...
  ]
  ```

---

## 3. Frontend Contract

### 3a. SearchableMultiSelect Component

**Location**: `frontend/src/components/ui/searchable-multi-select.tsx`

```tsx
<SearchableMultiSelect
  options={filterOptions.module_states}  // ALL unique values from server
  selected={selectedStates}              // string[] from useState
  onChange={(v) => { setSelectedStates(v); setPageIndex(0); }}
  allLabel="State"                       // shown when nothing selected
  searchPlaceholder="Search states..."
  triggerWidth="w-[130px]"
/>
```

**Rules**:
- `options` MUST come from the server filter-options endpoint, never computed from the current page's data.
- `onChange` must also reset `pageIndex` to 0 so the user sees page 1 after filtering.
- The trigger shows a count badge + first selection name when items are selected, or `allLabel` grayed out when nothing is selected.
- An ×-button inside the trigger clears the selection without opening the popover.

### 3b. Filter State Pattern

```tsx
// One string[] per filterable column
const [modStates, setModStates] = useState<string[]>([]);
const [modVersions, setModVersions] = useState<string[]>([]);
const [modTechNames, setModTechNames] = useState<string[]>([]);
```

Convert to query params:

```ts
function joinFilter(values: string[]): string | undefined {
  return values.length > 0 ? values.join(",") : undefined;
}

const params = {
  state: joinFilter(modStates),
  versions: joinFilter(modVersions),
  technical_names: joinFilter(modTechNames),
};
```

### 3c. API Client

The API client (`api/environments.ts`) exposes filter params as typed fields:

```ts
export interface GetEnvironmentModulesParams {
  state?: string;           // comma-separated
  technical_names?: string; // comma-separated
  versions?: string;        // comma-separated
  ...
}
```

Export functions accept the same param shape minus `page`/`limit`, fetch from `/export`, then call `_downloadXlsx`:

```ts
exportModulesXlsx: async (name, params?, filename?) => {
  const rows = await _fetchExport(buildUrl(`/environments/${name}/modules/export`, params));
  _downloadXlsx(rows, "Installed Modules", filename ?? `${name}_modules.xlsx`);
}
```

`_downloadXlsx` uses dynamic import so SheetJS is not in the critical bundle:

```ts
function _downloadXlsx(rows, sheetName, filename) {
  import("xlsx").then((XLSX) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  });
}
```

### 3d. Export Button

Place the Export button at the end of the `filterBar`, disabled when there is no data:

```tsx
<Button
  variant="outline"
  size="sm"
  className="h-8 gap-1.5"
  onClick={handleExport}
  disabled={isExporting || !data?.pagination.total_records}
>
  <Download className="h-3.5 w-3.5" />
  Export
</Button>
```

Show `sonner` toasts on success/error:

```ts
toast.success("Exported successfully");
toast.error("Export failed");
```

---

## 4. Checklist for Adding to a New Table

**Backend:**
- [ ] Filter-options endpoint returns all unique values for every filterable column
- [ ] Paginated endpoint accepts comma-separated params for every filterable column
- [ ] Export endpoint (`/export`) accepts same params, returns `List[Dict]` with no pagination cap

**Frontend:**
- [ ] Filter state: `const [xFilter, setXFilter] = useState<string[]>([])`
- [ ] `joinFilter()` converts state to comma-separated string for API call
- [ ] Reset `pageIndex` to 0 in every `onChange`
- [ ] `SearchableMultiSelect` options come from filter-options, not current page data
- [ ] Export button in filterBar, disabled when no data, shows loading state
- [ ] Export handler calls `api.exportXxxx()` and shows toast

---

## 5. File Reference

| File | Role |
|---|---|
| `frontend/src/components/ui/searchable-multi-select.tsx` | Reusable SearchableMultiSelect component |
| `frontend/src/api/environments.ts` | API client with multi-value params + export functions |
| `backend/app/api/v1/environments.py` | `_parse_csv()`, `_resolve_module_ids()`, export endpoints |
| `backend/app/repositories/module_dependency.py` | `.in_()` filters, `export=True` no-limit mode |
