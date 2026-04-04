# Frontend Documentation - Odoo Auditor

## Overview

React + TypeScript + Vite frontend for the Odoo Module Dependency & Version Auditor application. Features authentication, environment management, module sync, development request tracking, and role-based access control.

---

## Tech Stack

| Category | Technology |
|---------|------------|
| Framework | React 19 |
| Build Tool | Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | Radix UI (via shadcn/ui patterns) |
| State (Server) | TanStack Query v5 |
| State (Auth) | Zustand |
| Forms | React Hook Form + Zod |
| Routing | React Router v7 |
| HTTP Client | Axios |
| Notifications | Sonner |
| Icons | Lucide React |

---

## Project Structure

```
frontend/src/
├── api/                    # API client functions
│   ├── auth.ts           # Authentication (login, register, getMe)
│   ├── development-requests.ts  # Dev request CRUD + modules
│   ├── environments.ts   # Environment CRUD
│   ├── reports.ts        # Comparison reports
│   ├── roles.ts          # Role management
│   ├── sync.ts           # Sync job triggers
│   └── users.ts          # User management
├── components/
│   ├── layout/           # Layout components
│   │   ├── main-layout.tsx
│   │   └── sidebar.tsx
│   ├── sync/             # Sync-related components
│   │   ├── sync-button.tsx
│   │   └── sync-status.tsx
│   └── ui/               # Base UI components (shadcn patterns)
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── empty-state.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── pagination.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── skeleton.tsx
│       ├── sonner.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       ├── textarea.tsx
│       ├── toast.tsx
│       ├── toaster.tsx
│       └── tooltip.tsx
├── hooks/                 # React Query hooks
│   ├── use-toast.ts
│   ├── useDevelopmentRequests.ts
│   ├── useEnvironments.ts
│   ├── useReports.ts
│   ├── useRoles.ts
│   ├── useSync.ts
│   └── useUsers.ts
├── pages/
│   ├── dashboard.tsx
│   ├── development-requests/
│   │   ├── detail.tsx
│   │   ├── form.tsx
│   │   └── list.tsx
│   ├── environments/
│   │   ├── details.tsx
│   │   └── list.tsx
│   ├── login.tsx
│   ├── modules.tsx
│   ├── register.tsx
│   ├── reports/
│   │   └── comparison.tsx
│   └── settings/
│       ├── environments.tsx
│       ├── roles.tsx
│       └── users.tsx
├── store/                 # Zustand stores
│   └── auth-store.ts
├── types/
│   └── api.ts            # TypeScript interfaces
├── lib/
│   ├── api.ts            # Axios instance + interceptors
│   └── utils.ts          # Utility functions (cn)
├── App.tsx               # Router configuration
├── main.tsx              # Entry point
└── index.css             # Global styles
```

---

## Routes

| Path | Component | Access |
|------|-----------|--------|
| `/login` | LoginPage | Public |
| `/register` | RegisterPage | Public |
| `/dashboard` | DashboardPage | Private |
| `/modules` | ModulesPage | Private |
| `/environments` | EnvironmentsPage | Private |
| `/environments/:name` | EnvironmentDetailPage | Private |
| `/reports/comparison` | ComparisonPage | Private |
| `/development-requests` | DevelopmentRequestsListPage | Private |
| `/development-requests/new` | DevelopmentRequestsFormPage | Private |
| `/development-requests/:id` | DevelopmentRequestsDetailPage | Private |
| `/development-requests/:id/edit` | DevelopmentRequestsFormPage | Private |
| `/settings/environments` | SettingsEnvironmentsPage | Admin |
| `/settings/users` | SettingsUsersPage | Admin |
| `/settings/roles` | SettingsRolesPage | Admin |

### Route Guards

- **PrivateRoute**: Redirects to `/login` if not authenticated
- **AdminRoute**: Redirects to `/dashboard` if not admin

---

## Features Implemented

### 1. Authentication

| Feature | Status | Notes |
|---------|--------|-------|
| Login | ✅ | JWT token stored in localStorage + Zustand |
| Logout | ✅ | Clears token and user from store |
| Auto-redirect | ✅ | 401 interceptor redirects to login |
| User profile | ✅ | `getMe()` called after login |
| Persistent auth | ✅ | localStorage persistence via Zustand |

**Login Flow:**
1. User submits credentials
2. Token stored in Zustand BEFORE calling `getMe()`
3. User profile fetched and stored
4. Navigate to dashboard

### 2. Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| Stats cards | ✅ | Total modules, environments, synced, attention needed |
| Quick actions | ✅ | Links to environments, reports, modules |
| Loading states | ✅ | Skeleton loaders |
| Empty states | ✅ | Placeholder content |

### 3. Environments

| Feature | Status | Notes |
|---------|--------|-------|
| List view | ✅ | Grid of environment cards |
| Detail view | ✅ | Shows environment info + sync status |
| Sync trigger | ✅ | Manual sync button |
| Sync status | ✅ | Real-time status polling (3s interval) |
| Add environment | ✅ | Admin only via settings |
| Edit environment | ✅ | Admin only via settings |
| Delete environment | ✅ | Admin only via settings |

### 4. Modules

| Feature | Status | Notes |
|---------|--------|-------|
| List all modules | ✅ | From comparison report data |
| Search/filter | ✅ | By technical name or description |
| Loading states | ✅ | Skeleton loaders |

### 5. Reports - Comparison

| Feature | Status | Notes |
|---------|--------|-------|
| Version matrix | ✅ | All modules × all environments |
| Action badges | ✅ | Upgrade, downgrade, missing, synced |
| Filter view | ✅ | Show only items needing attention |
| Refresh | ✅ | Manual refetch button |
| Sticky header | ✅ | Column headers stay visible on scroll |

### 6. Development Requests

| Feature | Status | Notes |
|---------|--------|-------|
| List view | ✅ | Paginated (20 per page) |
| Filters | ✅ | Type, state, priority, category |
| Pagination | ✅ | Next/prev + page numbers |
| Create form | ✅ | Full form with validation |
| Edit form | ✅ | Pre-populated form |
| Detail view | ✅ | Full request info + related data |
| Reopen | ✅ | Dialog with required comment |
| Module lines | ✅ | Read-only display |
| Release plan | ✅ | Read-only display |
| Permission checks | ✅ | Based on backend `permissions` object |

**Permissions Used:**
- `can_update` - Show edit button
- `can_reopen` - Show reopen button (closed requests only)
- `can_add_module_lines` - (API exists, UI not implemented)
- `can_delete_module_lines` - (API exists, UI not implemented)

### 7. Settings

| Feature | Status | Notes |
|---------|--------|-------|
| Environment management | ✅ | CRUD operations |
| User management | ✅ | View, edit, delete users |
| Role management | ✅ | CRUD with permissions |
| Create environment | ✅ | Sheet dialog with form |
| Edit environment | ✅ | Pre-populated sheet |
| Delete environment | ✅ | Confirmation dialog |
| User edit | ✅ | Dialog with role assignment |
| User delete | ✅ | Confirmation dialog |
| Role create | ✅ | Dialog with permission checkboxes |
| Role edit | ✅ | Pre-populated dialog |
| Role delete | ✅ | Confirmation dialog |

### 8. Sidebar

| Feature | Status | Notes |
|---------|--------|-------|
| Main navigation | ✅ | Dashboard, Modules, Environments, Reports, Dev Requests |
| Settings section | ✅ | Admin only, collapsible |
| Collapsed mode | ✅ | Shows icons only |
| Mobile view | ✅ | Sheet/menu drawer |
| Active state | ✅ | Highlights current route |
| Tooltips | ✅ | On collapsed items |

---

## API Integration

### API Client (`lib/api.ts`)

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
});

// Automatically adds Bearer token
// Auto-logout on 401
```

### Authentication API (`api/auth.ts`)

```typescript
authApi.login(data)      // POST /auth/token → TokenResponse
authApi.getMe()          // GET /users/me → User
authApi.register(data)    // POST /auth/register → User
```

### Development Requests API (`api/development-requests.ts`)

```typescript
developmentRequestsApi.getControlParameters()     // GET /control-parameters/
developmentRequestsApi.list(filters, page, limit) // GET /requests/?page&limit&filters
developmentRequestsApi.get(id)                    // GET /requests/{id}
developmentRequestsApi.create(data)               // POST /requests/
developmentRequestsApi.update(id, data)           // PATCH /requests/{id}
developmentRequestsApi.reopen(id, comment)        // POST /requests/{id}/reopen
developmentRequestsApi.addModuleLine(id, data)    // POST /requests/{id}/modules
developmentRequestsApi.deleteModuleLine(reqId, lineId) // DELETE /requests/{reqId}/modules/{lineId}
```

### Environments API (`api/environments.ts`)

```typescript
environmentsApi.list()   // GET /
environmentsApi.get(name)// GET /{name}
environmentsApi.create()// POST /
environmentsApi.update() // PATCH /{name}
environmentsApi.delete()// DELETE /{name}
```

### Sync API (`api/sync.ts`)

```typescript
syncApi.trigger(envName)     // POST /{envName}
syncApi.getStatus(jobId)     // GET /{jobId}
syncApi.triggerAll()         // POST /sync-all
```

### Reports API (`api/reports.ts`)

```typescript
reportsApi.getComparison()    // GET /comparison
```

### Users API (`api/users.ts`)

```typescript
usersApi.list()    // GET /
usersApi.get(id)   // GET /{id}
usersApi.update()  // PATCH /{id}
usersApi.delete()  // DELETE /{id}
```

### Roles API (`api/roles.ts`)

```typescript
rolesApi.list()    // GET /
rolesApi.listAll() // GET /all
rolesApi.get(id)   // GET /{id}
rolesApi.create()  // POST /
rolesApi.update()  // PATCH /{id}
rolesApi.delete()  // DELETE /{id}
```

---

## State Management

### TanStack Query Patterns

```typescript
// Query Keys
const queryKeys = {
  developmentRequests: (filters, page, limit) => ["requests", "list", filters, page, limit],
  developmentRequest: (id) => ["requests", "detail", id],
  controlParameters: ["control-params"],
};

// Pagination with keepPreviousData
const { data } = useQuery({
  queryKey: queryKeys.developmentRequests(filters, page, limit),
  queryFn: () => developmentRequestsApi.list(filters, page, limit),
  placeholderData: keepPreviousData,  // Smooth pagination transitions
});
```

### Zustand (Auth Store)

```typescript
interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

// Persisted to localStorage
```

---

## Form Handling

- **Library**: React Hook Form + Zod
- **Validation**: Client-side with server-side error display
- **Patterns**:
  - Zod schemas for type inference
  - `zodResolver` for integration
  - Async validation via mutations
  - Error state display via `form.formState.errors`

---

## Error Handling

| Pattern | Implementation |
|---------|----------------|
| API errors | TanStack Query `onError` callbacks |
| Form validation | React Hook Form + Zod |
| Toast notifications | Sonner `toast.error()` / `toast.success()` |
| 401 handling | Axios interceptor auto-logout |
| 403 handling | Per-mutation error handling with `queryClient.invalidateQueries()` |
| Loading states | Skeleton components |
| Error boundaries | Inline error states in pages |

---

## UI Components

### Shadcn/UI Patterns Used

| Component | Usage |
|-----------|-------|
| Button | Actions, forms, navigation |
| Card | Content containers |
| Input | Form fields |
| Select | Dropdown selects |
| Dialog | Modals for confirmations, forms |
| Sheet | Slide-out panels |
| Table | Data grids |
| Badge | Status indicators |
| Skeleton | Loading placeholders |
| Tabs | Tabbed content |
| Tooltip | Hover info |
| Separator | Dividers |
| Avatar | User avatars |
| Textarea | Multi-line text input |
| Label | Form labels |

---

## Known Gaps / Missing Features

### Development Requests
- [ ] Add module lines UI (API exists: `useAddModuleLine`, `useDeleteModuleLine`)
- [ ] Delete request button (API endpoint missing from backend)
- [ ] Child requests list display
- [ ] Related requests display
- [ ] Parent request navigation from child

### Control Parameters
- [ ] Settings page for managing request types, states, priorities, categories
- [ ] Archive functionality for control parameters
- [ ] Custom ordering of priorities

### Environments
- [ ] View sync history
- [ ] Module-level sync

### Reports
- [ ] Export to CSV/PDF
- [ ] Version comparison details modal
- [ ] Module dependency view

### UI/UX
- [ ] Debounced search for request number
- [ ] Ghost data handling for soft-deleted references
- [ ] Bulk actions for development requests
- [ ] Activity/audit log view
- [ ] Dark mode toggle (next-themes installed but not used)

---

## Testing

### Test Stack
- Vitest for unit tests
- React Testing Library for component tests
- Playwright for E2E tests

### Commands
```bash
npm run build      # Type check + build
npm run lint       # ESLint
nohup npm run build &   # Long build with nohup
nohup npm run lint &     # Long lint with nohup
nohup npx vitest &       # Run tests with nohup
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000/api/v1` | Backend API base URL |

---

## Future Enhancements (Next Phase)

1. **Control Parameter Settings Page**
   - `/settings/control-parameters` with tabs
   - CRUD for request types, states, priorities, categories
   - Archive/restore functionality

2. **Development Request Enhancements**
   - Add module lines modal
   - Request assignment workflow
   - Request timeline/audit log
   - Child request creation

3. **Reporting Enhancements**
   - CSV export
   - Scheduled report generation
   - Module dependency graph

4. **UI Improvements**
   - Dark mode implementation
   - Keyboard shortcuts
   - Toast notification history
   - Loading skeleton animations

5. **Performance**
   - Virtual scrolling for large lists
   - Query deduplication
   - Optimistic updates

6. **E2E Testing**
   - Playwright tests for critical flows
   - Login → Dashboard → Create Request
   - Environment sync flow
   - Permission-based UI behavior

---

## Cross-Check: Functional Requirements

| Requirement | Implemented | Notes |
|-------------|-------------|-------|
| User authentication | ✅ | JWT + Zustand |
| Role-based access | ✅ | Admin-only routes, permission checks in UI |
| Environment management | ✅ | Full CRUD |
| Module sync | ✅ | Trigger + status polling |
| Version comparison | ✅ | Matrix view with actions |
| Development requests CRUD | ✅ | List, create, edit, detail |
| Development request filters | ✅ | Type, state, priority, category |
| Development request pagination | ✅ | Server-side with 20/page |
| Development request permissions | ✅ | Backend-driven `permissions` object |
| Control parameters | ✅ | API ready, UI settings page pending |
| Settings pages | ✅ | Environments, Users, Roles |
| Responsive design | ✅ | Mobile-friendly layouts |
| Loading states | ✅ | Skeleton components |
| Error handling | ✅ | Toast notifications + inline errors |

---

*Document Version: 1.0*
*Last Updated: 2026-04-04*
