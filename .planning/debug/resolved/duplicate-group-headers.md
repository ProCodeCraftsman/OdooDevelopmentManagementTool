---
status: resolved
trigger: "Group by in development request list view shows duplicate group headers for every group"
created: 2026-04-10
updated: 2026-04-10
---

## Current Focus

hypothesis: "groupHeaders useMemo was iterating over DATA items instead of groups array, causing duplicates"
test: "Use groups array directly (from API) instead of deriving headers from data items"
expecting: "Each group appears exactly once in the group headers list"
next_action: "Need user to verify the fix works in their browser"

## Symptoms

expected: "Each developer/category should appear once as a group header when using group by"
actual: "Every group appears multiple times in the group headers list"
errors: []
reproduction: "Go to development requests list, select group by -> assigned_developer"
started: "Recently (after group by fix was attempted)"

## Eliminated

- hypothesis: "Backend returns duplicate groups"
  evidence: "User verified backend returns correct unique groups"
  timestamp: "2026-04-10"

- hypothesis: "React Query cache returning stale data"
  evidence: "Issue manifests even with fresh data, not a cache issue"
  timestamp: "2026-04-10"

- hypothesis: "localStorage collapsedGroups interfering"
  evidence: "localStorage stores collapsed state, not duplicates"
  timestamp: "2026-04-10"

## Evidence

- timestamp: "2026-04-10"
  checked: "requests-command-table.tsx groupHeaders useMemo (original lines 138-158)"
  found: "Code was iterating over data items (for const item of data) and detecting key transitions to create headers"
  implication: "This fragile approach depends on data being perfectly sorted contiguously. Instead should use groups array directly."

- timestamp: "2026-04-10"
  checked: "requests-command-table.tsx fallback path (lines 302-341)"
  found: "Same buggy logic - derives headers from data items instead of using groups array"
  implication: "Both code paths had the same fundamental bug"

## Resolution

root_cause: "groupHeaders useMemo was deriving group headers by iterating over DATA items instead of using the groups array from the API. The algorithm detected key transitions (key !== lastKey) to create headers, but this is fragile - it doesn't correctly use the unique group keys already provided by the API in the groups array."

fix: "Changed groupHeaders useMemo to iterate over the groups array directly using groups.map(), and fixed the fallback code path similarly. Both now use the unique group keys from the API (groups array) instead of deriving them from data items."

verification: "TypeScript build passes. Need user to test in browser to confirm groups appear once."

files_changed:
- "frontend/src/components/development-requests/requests-command-table.tsx"