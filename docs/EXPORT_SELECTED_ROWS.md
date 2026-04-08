# Export Selected Rows — Extension Pattern

This document describes how to add "export selected rows" capability to any table in
the application. The pattern is already implemented for Development Requests and can be
replicated for Release Plans, Modules, Users, etc.

---

## How It Works (Development Requests reference implementation)

### Backend contract

```
GET /api/v1/development-requests/requests/export
```

| Query param | Type   | Behaviour                                                                |
|-------------|--------|--------------------------------------------------------------------------|
| `ids`       | string | Comma-separated record IDs. **When present, all other filters are ignored** and only these specific records are exported. |
| (filters)   | mixed  | `request_type_ids`, `request_state_ids`, etc. Used when `ids` is absent. |

The endpoint returns a flat JSON array (`List[Dict]`). The frontend converts it to `.xlsx`
using the `xlsx` library (already a dependency).

### Frontend API function

```typescript
// api/development-requests.ts
exportRequestsXlsx: async (
  filters?,          // used when no ids provided
  filename?,
  selectedIds?,      // when provided → exports only these records
): Promise<void>
```

---

## Extending to a new table — step-by-step

### 1. Backend: accept `ids` in the export endpoint

```python
# In your existing export GET handler, add:
ids: Optional[str] = Query(None, description="Comma-separated IDs for selective export")

# At the top of the handler body:
explicit_ids = _parse_csv(ids)   # reuse the existing helper
if explicit_ids:
    items = repo.get_by_ids([int(i) for i in explicit_ids if i.isdigit()])
else:
    items, _, _ = repo.get_all_with_filters(...existing filters...)
```

Add `get_by_ids(ids: List[int])` to the repository:

```python
def get_by_ids(self, ids: List[int]) -> List[MyModel]:
    if not ids:
        return []
    return (
        self.db.query(MyModel)
        .options(joinedload(MyModel.relationship_1), ...)
        .filter(MyModel.id.in_(ids))
        .all()
    )
```

### 2. Backend: all-ids endpoint (for "select all N records" banner)

```python
@router.get("/my-resource/all-ids")
def get_all_ids(
    # same filter params as list endpoint …
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    ids = repo.get_all_ids_with_filters(...)  # returns List[int]
    return {"ids": ids, "total": len(ids)}
```

```python
# In repository:
def get_all_ids_with_filters(self, ...filters...) -> List[int]:
    query = self.db.query(MyModel.id)
    # apply same filters as get_all_with_filters
    return [row.id for row in query.all()]
```

### 3. Frontend: update the API function

```typescript
// api/my-resource.ts
exportMyResourceXlsx: async (
  filters?: MyResourceFilters,
  filename?: string,
  selectedIds?: number[]    // <-- add this param
): Promise<void> => {
  const params = new URLSearchParams();
  if (selectedIds && selectedIds.length > 0) {
    params.append("ids", selectedIds.join(","));
  } else if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.append(k, String(v));
    });
  }
  const url = `${API_BASE_URL}/my-resource/export?${params.toString()}`;
  const rows = await _fetchExport(url);          // _fetchExport is in the same file
  _downloadXlsx(rows, "Sheet Name", filename ?? "export.xlsx");
},

getAllIds: async (filters?: MyResourceFilters): Promise<{ ids: number[]; total: number }> => {
  // build params from filters
  const res = await api.get(`/my-resource/all-ids?${params}`);
  return res.data;
},
```

### 4. Frontend: wire up BulkActionsToolbar or an Export button

For a simple "Export selected" button:

```tsx
const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

// In the toolbar:
<Button onClick={() => myResourceApi.exportMyResourceXlsx(
  undefined,                         // no filters
  "my_export.xlsx",
  Array.from(selectedIds)            // explicit IDs
)}>
  Export {selectedIds.size} selected
</Button>
```

For the full "select all N records" banner pattern, see `RequestsCommandTable` and the
`handleSelectAllRecords` callback in `list.tsx` as the reference implementation.

---

## UX rules

| Scenario | Behaviour |
|----------|-----------|
| No rows selected | Export button exports all rows matching current filters (existing behaviour) |
| 1–N rows selected on current page | Exports exactly those N rows; ignores filters |
| "Select all N records" activated | Fetches all matching IDs via `/all-ids`, exports all of them |
| User has no permission on some rows | BulkActionsToolbar warns and skips those rows; export still includes them (export is read-only) |

---

## Tables with this pattern implemented

| Table | Export endpoint | all-ids endpoint | Bulk assign | Bulk archive |
|-------|----------------|-----------------|-------------|--------------|
| Development Requests | ✅ `GET /development-requests/requests/export` | ✅ | ✅ | ✅ |
| Release Plans | ❌ pending | ❌ pending | n/a | n/a |
| Modules | ❌ pending | ❌ pending | n/a | n/a |
