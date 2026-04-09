# Environments and Version Drift

The system tracks and monitors various environments to ensure that all modules are at the correct versions and to identify any discrepancies.

## Core Entities

### Environment
The `Environment` record represents a physical instance of the application (e.g., Odoo).
- **Categorization:** Classified as Development, Staging, or Production.
- **Connectivity:** Stores connection details (e.g., URL) used by the `OdooClient` to sync data.
- **Ordering:** The `order` field defines the promotion sequence (e.g., Dev=1, Staging=2, Prod=3).

### Sync Record
A `SyncRecord` stores the result of a module discovery run on an environment.
- **Job Tracking:** Tracks the `job_id`, `status` (Started, Completed, Failed), and timestamps.
- **Module Versioning:** Stores the version and MD5 hash of each discovered module.

### Comparison and Drift
The `ComparisonReport` model manages the results of drift analysis runs.
- **Report Row:** A `ComparisonReportRow` represents a single module across all tracked environments, with its version data pre-computed in a JSONB blob.
- **Drift Entry:** A `VersionDriftEntry` captures a discrepancy between two environments for a specific module.

## Version Drift Monitoring

### Sliding-Window Comparison
The system performs a sliding-window comparison (Source → Target) across environments based on their defined `order`. For example:
- Dev → Staging
- Staging → Production

### Categorized Actions
Discrepancies are categorized into the following actions:
- **Upgrade:** The source environment has a newer version than the target.
- **Error (Downgrade):** The target environment has a newer version than the source (unexpected).
- **Missing Module:** A module exists in one environment but not the other.
- **No Action:** Versions are identical.

## Reporting
- **Automated Discovery:** The system periodically syncs from Odoo instances to keep environment data fresh.
- **Comparison Engine:** A drift engine processes `SyncRecord` data to generate `ComparisonReports`, providing a birds-eye view of the system's health.
