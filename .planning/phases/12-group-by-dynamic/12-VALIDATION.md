---
phase: 12
slug: group-by-dynamic
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-11
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | none — defaults used |
| **Quick run command** | `cd backend && source venv/bin/activate && pytest tests/ -v -k "group"` |
| **Full suite command** | `cd backend && source venv/bin/activate && pytest -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/ -v -k "group"` 
- **After every plan wave:** Run `pytest -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | get_group_counts("request_type") returns grouped by type name | — | N/A | unit | `pytest tests/test_repositories/test_request_module_line.py::TestGetGroupCounts::test_group_counts_request_type -v` | ✅ | ⚠️ test setup issue |
| 12-01-02 | 01 | 1 | get_group_counts("request_state") returns grouped by state name | — | N/A | unit | `pytest tests/test_repositories/test_request_module_line.py::TestGetGroupCounts::test_group_counts_request_state -v` | ✅ | ⚠️ test setup issue |
| 12-01-03 | 01 | 1 | get_group_counts("functional_category") returns grouped by category | — | N/A | unit | `pytest tests/test_repositories/test_request_module_line.py::TestGetGroupCounts::test_group_counts_functional_category -v` | ✅ | ⚠️ test setup issue |
| 12-01-04 | 01 | 1 | get_group_counts("priority") returns grouped with level sorting | — | N/A | unit | `pytest tests/test_repositories/test_request_module_line.py::TestGetGroupCounts::test_group_counts_priority -v` | ✅ | ⚠️ test setup issue |
| 12-01-05 | 01 | 1 | get_group_counts("assigned_developer") returns "Unassigned" for null | — | N/A | unit | `pytest tests/test_repositories/test_request_module_line.py::TestGetGroupCounts::test_group_counts_assigned_developer -v` | ✅ | ⚠️ test setup issue |
| 12-02-01 | 02 | 2 | DrGroupHeader component renders correctly | — | N/A | manual | N/A | N/A | ⬜ pending |
| 12-02-02 | 02 | 2 | Group dropdown in lines-list page | — | N/A | manual | N/A | N/A | ⬜ pending |
| 12-02-03 | 02 | 2 | Grouped rows with collapsible headers | — | N/A | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky / test issue*

---

## Wave 0 Requirements

- [x] `backend/tests/test_repositories/test_request_module_line.py` — tests for get_group_counts (created but need fixture fixes)
- [ ] Extend conftest.py with better fixtures for complex model relationships

*Note: No frontend test framework detected (no Jest/Vitest). Frontend verification is manual-only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DrGroupHeader component | 12-02-01 | No frontend test framework | 1. Open `frontend/src/components/development-requests/dr-group-header.tsx`<br>2. Verify props: label, count, isExpanded, onToggle<br>3. Check ChevronRight/ChevronDown icons render<br>4. Verify bg-secondary/50 styling |
| Group dropdown UI | 12-02-02 | No frontend test framework | 1. Run `npm run dev` in frontend<br>2. Navigate to DR Module Lines page<br>3. Verify "Group by:" dropdown appears with options |
| Grouped rows rendering | 12-02-03 | No frontend test framework | 1. Select "Type" from group dropdown<br>2. Verify collapsible group headers appear<br>3. Click expand/collapse to verify toggle works |
| API endpoint: group_by=request_type | 12-01-01 | Test fixture complexity | `curl "http://localhost:8000/api/v1/development-requests/lines/all?group_by=request_type"` with auth |
| API endpoint: group_by=assigned_developer | 12-01-05 | Test fixture complexity | `curl "http://localhost:8000/api/v1/development-requests/lines/all?group_by=assigned_developer"` - verify "Unassigned" group |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [x] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending