# Coding Conventions

**Analysis Date:** 2026-04-05

## Naming Patterns

### Python (Backend)

**Files:**
- snake_case.py for all modules (`comparer.py`, `auth_service.py`, `development_request.py`)

**Classes/Types:**
- PascalCase (`Module`, `User`, `DevelopmentRequestService`, `BaseRepository`)
- Suffix patterns: `*Repository` for data access, `*Service` for business logic

**Functions/Variables:**
- snake_case (`get_current_user`, `hash_password`, `compare_versions`)

**Constants:**
- UPPER_SNAKE_CASE (`INVALID_VERSIONS`, `JWT_SECRET_KEY`)

**Private Methods:**
- `_prefix` underscore convention (`_normalize_tuple`, `_compare_tuples`)

### TypeScript/React (Frontend)

**Files:**
- PascalCase.tsx for React components (`LoginPage.tsx`, `Button.tsx`, `MainLayout.tsx`)
- camelCase.ts for utilities/hooks/stores (`auth-store.ts`, `utils.ts`)

**Components:**
- PascalCase (`function LoginPage()`, `const DashboardPage = () => {}`)

**Variables/Functions:**
- camelCase (`useAuthStore`, `onSubmit`, `isAuthenticated`)

**Types:**
- PascalCase with descriptive suffixes (`LoginForm`, `ModuleSearchResult`, `ButtonProps`)

**Constants:**
- UPPER_SNAKE_CASE or camelCase depending on scope (`MAX_LIMIT`, `apiPrefix`)

## Code Style

### Python

**Formatting:**
- Black formatter implied by clean formatting patterns
- 4-space indentation
- Single blank line between top-level definitions

**Linting:**
- No explicit config found (implied by AGENTS.md conventions)

**Type Hints:**
- Required using `typing` module (`Optional[str]`, `List[int]`, `Tuple[int, ...]`)
- SQLAlchemy uses `Mapped[type]` pattern with `mapped_column`

### TypeScript

**Formatting:**
- Prettier not explicitly configured (eslint.config.js found)
- ESLint flat config with TypeScript ESLint

**Linting:**
- ESLint flat config (`eslint.config.js`)
- Extends: `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`

**TypeScript:**
- Strict mode assumed (typescript-eslint recommended config)
- Zod for runtime validation (`z.object()`, `z.infer<typeof schema>`)

## Import Organization

### Python (Backend)

Import order in `app/api/v1/modules.py`:
```python
# 1. Standard library
from typing import List

# 2. Third-party
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

# 3. Local application
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.repositories.module import ModuleRepository
from app.schemas.module import ModuleSearchResult, ModuleDevVersionsResponse
```

### TypeScript (Frontend)

Import order in `frontend/src/pages/login.tsx`:
```typescript
// 1. External libraries
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// 2. UI components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 3. Internal app modules
import { useAuthStore } from "@/store/auth-store";
import { authApi } from "@/api/auth";
import { toast } from "sonner";
```

**Path Aliases:**
- `@/` maps to `./src/` (defined in `vite.config.ts` and `tsconfig.json`)

## Error Handling

### Python (Backend)

**API Layer:**
- FastAPI `HTTPException` for user-facing errors
```python
from fastapi import HTTPException, status

if not module:
    return ModuleDevVersionsResponse(module_name=module_name, versions=[])
```

**Service Layer:**
- Try/except for external calls (Odoo XML-RPC, database operations)
- JWT errors caught with `JWTError` from `python-jose`

**Repository Layer:**
- Returns `None` for not-found scenarios
- Commits handled explicitly (`db.commit()`)

**Error Response Pattern:**
```python
raise HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="Invalid operation",
)
```

### TypeScript (Frontend)

**API Errors:**
```typescript
try {
  const response = await authApi.login(data);
  login(response.access_token, userProfile);
  toast.success("Login successful");
} catch {
  setError("password", { message: "Invalid username or password" });
  toast.error("Login failed");
}
```

**React Query Error Handling:**
- Error boundaries for component tree
- React Query `onError` callbacks for API failures

**Sonner Toasts:**
- `toast.success()`, `toast.error()` for user feedback

## Logging

### Python

- Standard `logging` module (not explicitly shown but standard practice)
- **Never log decrypted credentials or secrets** (AGENTS.md rule)

### TypeScript

- No explicit logging framework
- `console` for development debugging
- `sonner` for user-facing notifications

## Comments

### Python

**When to Comment:**
- Docstrings for public functions (`"""Parse semantic version string into tuple for comparison."""`)
- Complex logic explanations

**Docstring Format:**
```python
def parse_semver(version_string: Optional[str]) -> Optional[Tuple[int, ...]]:
    """Parse semantic version string into tuple for comparison.
    
    Args:
        version_string: Version string like '17.0.1.10'
        
    Returns:
        Tuple of integers (major, minor, patch, build) or None if invalid
    """
```

### TypeScript

**When to Comment:**
- Complex component logic
- Type definitions
- MSW handlers and mocks

## Function Design

### Python

**Size:** Functions kept under 50-100 lines; complex logic extracted to helper functions

**Parameters:** Type hints required, use `Optional` for nullable parameters

**Return Values:**
- Explicit return types
- Return `None` for not-found, raise `HTTPException` for errors

### TypeScript

**Component Size:** Components typically 50-150 lines; complex forms may be longer

**Hooks:**
- Custom hooks for reusable logic (`useAuthStore`, React Query hooks)
- React Query for server state

**Return Values:**
- Components return JSX
- Functions return typed values

## Module Design

### Python

**Exports:**
- Classes/functions explicitly imported
- `__init__.py` for package exports

**Barrel Files:**
- `app/api/v1/__init__.py` exports router
- `app/models/__init__.py` exports models

### TypeScript

**Exports:**
- Named exports (`export function Button()`)
- Default export in App.tsx (`export default App;`)

**Path Aliases:**
- `@/` for src imports
- Relative for sibling imports

---

*Convention analysis: 2026-04-05*
