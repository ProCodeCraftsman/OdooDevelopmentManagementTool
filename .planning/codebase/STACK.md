# Technology Stack

**Analysis Date:** 2026-04-05

## Languages

**Primary (Backend):**
- Python 3.x - Core backend development

**Primary (Frontend):**
- TypeScript 5.9.3 - Type-safe frontend development
- JavaScript (ES2020) - Frontend runtime target

## Runtime

**Backend:**
- Python 3 with FastAPI ASGI server
- Uvicorn ASGI server for production/development

**Frontend:**
- Vite 8.0.1 - Build tool and dev server
- Node.js (implicit, via npm)

**Package Manager:**
- npm (frontend)
- pip (backend)

## Frameworks

**Backend:**
- FastAPI >= 0.109.0 - REST API framework
- SQLAlchemy >= 2.0.0 - ORM
- Alembic >= 1.13.0 - Database migrations

**Frontend:**
- React 19.2.4 - UI framework
- React Router 7.14.0 - Client-side routing
- React Query 5.96.2 - Server state management
- Zustand 5.0.12 - Client state management

**Styling:**
- Tailwind CSS 3.4.19 - Utility-first CSS
- Radix UI (multiple packages) - Headless UI components
- Tailwind CSS Animate 1.0.7 - Animation utilities

**Form Handling:**
- React Hook Form 7.72.1 - Form state management
- Zod 4.3.6 - Schema validation
- @hookform/resolvers 5.2.2 - Integration layer

**Build/Dev Tools:**
- TypeScript ESLint 8.57.0 - Linting
- Vitest 4.1.2 - Unit testing (frontend)
- Playwright 1.59.1 - E2E testing
- MSW 2.12.14 - API mocking

## Key Dependencies

**Database:**
- psycopg2-binary >= 2.9.9 - PostgreSQL adapter for Python
- SQLAlchemy >= 2.0.0 - ORM

**Authentication & Security:**
- python-jose >= 3.3.0 - JWT token handling
- passlib >= 1.7.4 - Password hashing
- cryptography >= 42.0.0 - Encryption (Fernet)
- bcrypt - Password hashing backend

**Validation:**
- Pydantic >= 2.5.0 - Data validation
- pydantic-settings >= 2.1.0 - Environment configuration

**API Integration:**
- httpx >= 0.26.0 - HTTP client
- xmlrpc.client (stdlib) - Odoo server communication

**Frontend UI:**
- Lucide React 1.7.0 - Icon library
- Sonner 2.0.7 - Toast notifications
- class-variance-authority 0.7.1 - Component variants
- clsx 2.1.1 - Conditional classnames
- next-themes 0.4.6 - Dark mode support

**Frontend HTTP:**
- Axios 1.14.0 - HTTP client

**Testing:**
- pytest >= 8.0.0 - Backend testing
- pytest-asyncio >= 0.23.0 - Async test support
- pytest-cov >= 4.1.0 - Coverage reporting
- @testing-library/react 16.3.2 - Component testing
- @testing-library/user-event 14.6.1 - User interaction simulation

## Configuration

**Environment:**
- `.env` file via pydantic-settings
- `.env.example` for documentation

**Key env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `FERNET_KEY` - Encryption key for credential storage
- `JWT_SECRET_KEY` - Token signing secret
- `JWT_ALGORITHM` - Token algorithm (HS256)
- `JWT_EXPIRATION_HOURS` - Token lifetime (24)

**Frontend env:**
- `VITE_API_URL` - Backend API URL (defaults to localhost:8000)

**Build Config:**
- `vite.config.ts` - Vite bundler configuration
- `tsconfig.json` - TypeScript base config
- `eslint.config.js` - ESLint flat config
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS processing

## Platform Requirements

**Development:**
- Node.js 18+ (for frontend)
- Python 3.9+ (for backend)
- PostgreSQL 16
- Docker & Docker Compose (optional)

**Production:**
- Linux server with Docker support
- PostgreSQL 16 database
- Odoo 17 server instances (for module sync)

---

*Stack analysis: 2026-04-05*
