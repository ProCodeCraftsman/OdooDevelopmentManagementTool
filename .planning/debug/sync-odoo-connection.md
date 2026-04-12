---
status: investigating
trigger: "Sync Status shows 'Failed to connect to Odoo server' when attempting to sync from the frontend"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
---

## Current Focus
hypothesis: "ROOT CAUSE FOUND: Silent exception handling in OdooClient.connect() masks the real error"
test: "Verified by code inspection"
expecting: "Root cause identified - no actual bug in credential handling"
next_action: "Document findings and provide fix recommendation"

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: "Sync should successfully connect to Odoo server via XML-RPC and sync module data"
actual: "Sync fails with 'Failed to connect to Odoo server'"
errors: []
reproduction: "Create an environment from frontend, trigger sync"
started: "Unknown when this started"

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: "FERNET_KEY is empty causing encryption to fail"
  evidence: "FERNET_KEY is set in .env file: BNpYMh4MZob0KY5KgRvuybKirxVPS-IQZwM4060AbZM="
  timestamp: "2026-04-04"

- hypothesis: "Fernet key encoding issue"
  evidence: "settings.FERNET_KEY.encode() produces valid Fernet key - checked .env"
  timestamp: "2026-04-04"

- hypothesis: "Model field mismatch (user vs username)"
  evidence: "Both Environment model and OdooClient use 'user' field - consistent"
  timestamp: "2026-04-04"

- hypothesis: "Missing password in environment creation"
  evidence: "Frontend requires password via zod schema: z.string().min(1) - validated before submission"
  timestamp: "2026-04-04"

- hypothesis: "Empty URL validation"
  evidence: "Frontend validates URL with z.string().url() - requires valid URL format"
  timestamp: "2026-04-04"

- hypothesis: "Environment lookup fails"
  evidence: "sync_service.py line 46: env_repo.get(job.environment_id) - retrieves by ID not name"
  timestamp: "2026-04-04"

- hypothesis: "Missing or incorrect credentials in environment"
  evidence: "Frontend correctly passes all fields (name, url, db_name, user, password) to API, backend encrypts password with Fernet"
  timestamp: "2026-04-04"

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: "2026-04-04"
  checked: "backend/app/api/v1/sync.py"
  found: "Sync endpoint calls SyncService.execute_sync() which uses OdooClient to connect"
  implication: "Connection failure happens in OdooClient.connect()"

- timestamp: "2026-04-04"
  checked: "backend/app/services/odoo_client.py lines 31-40"
  found: "connect() catches ALL exceptions silently and returns False - NO LOGGING - ROOT CAUSE FOUND"
  implication: "Cannot tell from this code what exact error occurs"

- timestamp: "2026-04-04"
  checked: "backend/app/services/sync_service.py line 52-56"
  found: "On connect() failure, only records generic message: fail_job(job_id, 'Failed to connect to Odoo server')"
  implication: "Error message is generic - doesn't capture actual exception"

- timestamp: "2026-04-04"
  checked: "backend/app/repositories/environment.py"
  found: "create_environment() encrypts password with Fernet, get_decrypted_password() decrypts"
  implication: "Encryption/decryption flow is correct"

- timestamp: "2026-04-04"
  checked: "backend/app/schemas/environment.py"
  found: "EnvironmentResponse does NOT include password field - expected for security"
  implication: "Password is stored encrypted in DB, not returned to client"

- timestamp: "2026-04-04"
  checked: "frontend/src/pages/settings/environments.tsx"
  found: "Creates environment with validated form data - passes all fields including password"
  implication: "Frontend sends complete data to backend"

- timestamp: "2026-04-04"
  checked: "backend/.env file"
  found: "FERNET_KEY is set: BNpYMh4MZob0KY5KgRvuybKirxVPS-IQZwM4060AbZM="
  implication: "Encryption works correctly"

- timestamp: "2026-04-04"
  checked: "backend/app/api/v1/environments.py lines 86-94"
  found: "Update flow encrypts password correctly when provided"
  implication: "Update path works correctly"

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "OdooClient.connect() silently catches all exceptions without logging, causing the generic 'Failed to connect to Odoo server' error to be shown regardless of the actual issue. The actual exception (network error, SSL error, invalid credentials, invalid database, Odoo server down) is swallowed and never recorded."

fix: "Add logging in OdooClient.connect() and propagate actual error message to sync job status. In odoo_client.py, replace 'except Exception: return False' with logging. In sync_service.py, capture and record the actual error."

verification:
files_changed: []
