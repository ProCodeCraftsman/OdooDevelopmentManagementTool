# CONTROL.md - Protected File Guidelines

This document specifies files that require **explicit consultation** before making changes. These files are critical to the project's architecture, security, or stability.

## Why This Document?

As the project grows, certain files become foundational. Changes to these files can have cascading effects across the codebase. This document ensures:

1. **Critical decisions are discussed** before implementation
2. **Knowledge transfer** happens when team members work on these files
3. **Breaking changes are avoided** without proper planning

---

## File Categories

### 1. Security-Critical Files

| File | Reason for Protection | Consultation Required |
|------|----------------------|---------------------|
| `backend/app/core/security_matrix.py` | RBAC implementation, access control | ✅ Mandatory |
| `backend/app/core/deps.py` | Authentication dependencies | ✅ Mandatory |
| `backend/app/services/auth_service.py` | Authentication logic | ✅ Mandatory |
| `backend/app/core/encryption.py` | Credential encryption | ✅ Mandatory |
| `backend/app/models/user.py` | User model with auth fields | ✅ Mandatory |
| `frontend/src/store/auth-store.ts` | Authentication state management | ✅ Mandatory |

### 2. Database Schema Files

| File | Reason for Protection | Consultation Required |
|------|----------------------|---------------------|
| `backend/app/models/*.py` | SQLAlchemy models define DB schema | ✅ Mandatory |
| `backend/alembic/versions/*.py` | Database migrations | ✅ Mandatory |
| `backend/app/repositories/base.py` | Base repository pattern | ✅ Recommended |

### 3. API Architecture

| File | Reason for Protection | Consultation Required |
|------|----------------------|---------------------|
| `backend/app/main.py` | FastAPI application entry | ✅ Recommended |
| `backend/app/api/v1/__init__.py` | API router aggregation | ✅ Recommended |
| `frontend/src/App.tsx` | React router setup | ✅ Recommended |

### 4. UI Foundation

| File | Reason for Protection | Consultation Required |
|------|----------------------|---------------------|
| `frontend/src/components/ui/*` | Base UI components | ✅ Recommended |
| `frontend/src/lib/api.ts` | API client configuration | ✅ Mandatory |
| `frontend/src/lib/utils.ts` | Utility functions | ⚠️ Use caution |
| `frontend/tailwind.config.js` | Theme configuration | ✅ Recommended |

### 5. Authentication & Authorization

| File | Reason for Protection | Consultation Required |
|------|----------------------|---------------------|
| `backend/app/api/v1/auth.py` | Login, register, token endpoints | ✅ Mandatory |
| `backend/app/core/config.py` | Environment configuration | ✅ Mandatory |
| `frontend/src/hooks/useAuth.ts` | Auth hooks | ✅ Recommended |

---

## Consultation Process

### When You MUST Consult Before Changes

1. **Breaking API Changes**
   - Changing request/response schemas
   - Modifying endpoint URLs
   - Removing functionality

2. **Security-Related Changes**
   - Modifying RBAC rules
   - Changing authentication flow
   - Updating password/credential handling

3. **Database Schema Changes**
   - Adding new tables/columns
   - Modifying relationships
   - Adding indices or constraints

4. **UI Architecture Changes**
   - Modifying routing structure
   - Changing component hierarchy
   - Updating theme system

### How to Consult

1. **Create a Discussion Issue** describing:
   - What change is needed
   - Why the change is needed
   - What alternatives were considered
   - Potential impact on existing functionality

2. **Wait for Acknowledgment** from project maintainer

3. **Document the Change** after approval in:
   - Commit message
   - CHANGELOG.md
   - User-facing documentation

---

## Exceptions

### Emergency Fixes

If a **critical bug or security vulnerability** requires immediate changes:

1. Make the minimal necessary fix
2. Document the change clearly
3. Notify the team immediately
4. Create follow-up issue for review

### Test Files

Test files (`*test*.py`, `*test*.tsx`) can be modified freely, but:
- Don't skip existing tests without justification
- Add tests for new functionality
- Update tests when behavior intentionally changes

---

## Maintenance

| Action | Frequency | Responsible |
|--------|-----------|-------------|
| Review this file | Monthly | Project Lead |
| Add new protected files | As needed | Project Lead |
| Remove files no longer protected | Quarterly | Project Lead |

---

## Quick Reference

**Always consult before modifying:**
- `security_matrix.py` - Access control
- `deps.py` - Auth dependencies
- `models/*.py` - Database schema
- `migrations/` - Database changes
- `main.py` - App entry point

**Consult before modifying:**
- UI components
- API endpoints
- Repository patterns
- Store/state management

**Modify freely:**
- Test files
- Documentation
- Scripts
- Page components (non-core)

---

*Last Updated: 2026-04-04*
*Version: 1.0*
