# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## duplicate-group-headers — Group by shows duplicate headers for every group
- **Date:** 2026-04-10
- **Error patterns:** duplicate group headers, group by, development requests list, assigned_developer
- **Root cause:** groupHeaders useMemo was deriving group headers by iterating over DATA items instead of using the groups array from the API. The algorithm detected key transitions (key !== lastKey) to create headers, but this is fragile - it doesn't correctly use the unique group keys already provided by the API in the groups array.
- **Fix:** Changed groupHeaders useMemo to iterate over the groups array directly using groups.map(), and fixed the fallback code path similarly. Both now use the unique group keys from the API (groups array) instead of deriving them from data items.
- **Files changed:** frontend/src/components/development-requests/requests-command-table.tsx
---