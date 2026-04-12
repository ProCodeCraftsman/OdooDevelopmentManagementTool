---
phase: 11
slug: settings-control-parameters
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-10
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Frontend ↔ Backend API | React UI calls PATCH /control-parameters/{type}/{id} | ControlParameterUpdate schema |
| API Service Layer | update_control_parameter uses repo.get() then manual updates | Domain object mutation |
| Database Repository | DevelopmentRequestStateTypeRuleRepository performs CRUD | ControlParameterRule model |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-11-01 | Spoofing | PATCH endpoint | mitigate | Permission check via `require_permissions([Permission.SYSTEM_MANAGE])` at line 258 | CLOSED |
| T-11-02 | Tampering | Control parameter updates | mitigate | Input validation via ControlParameterUpdate schema, field restrictions at lines 266-273 | CLOSED |
| T-11-03 | Repudiation | Rule creation/updates | mitigate | created_at/updated_at timestamps on DevelopmentRequestStateTypeRule model | CLOSED |
| T-11-04 | Information Disclosure | PATCH endpoint response | mitigate | Returns typed response models (RequestTypeResponse, etc.), not raw DB objects | CLOSED |
| T-11-05 | Denial of Service | Rules list endpoint | mitigate | Seed runs once on first GET, pagination not required at current scale | CLOSED |
| T-11-06 | Elevation of Privilege | Rules toggle endpoint | mitigate | require_permissions([Permission.SYSTEM_MANAGE]) at line 381 | CLOSED |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

*No accepted risks.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-10 | 6 | 6 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval: verified 2026-04-10**