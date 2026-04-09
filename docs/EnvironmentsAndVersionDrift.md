# Environments & Version Drift Monitoring

Environments are the core Odoo instances tracked by the system. Version drift monitoring ensures that changes are promoted correctly and that all environments stay in sync with the desired state.

## Environment Configuration

- **URL and Credentials:** Each environment record contains the Odoo URL and the database credentials needed for XML-RPC authentication.
- **Environment Category:** Classified as `Development`, `Test`, or `Production`.
- **Order:** An integer defining the deployment sequence (e.g., Dev=1, Prod=10).
- **Active Status:** Deactivating an environment stops all automated sync and monitoring operations.
- **Data Retention:** Deleting an environment will also remove its associated sync records and module metadata through cascading deletes.

## Sync Records & Metadata

Sync records (`SyncRecord`) are generated whenever the system scans an environment for module versions and metadata.
- **Job Identifiers:** Each sync operation is assigned a unique `job_id`.
- **Status Tracking:** Tracks the progress from `Pending` to `Completed` or `Failed`.
- **Module Metadata:** Captures the current `version_string` and MD5 sum of each module.
- **Dependency Tracking:** Sync records also capture a module's dependencies at the time of the sync, storing them in a `dependencies` JSON field.

## Module Dependencies

To maintain environment stability, the system explicitly tracks and monitors module dependencies.
- **Structure:** A `ModuleDependency` record links a module to its required dependency name and version.
- **Comparison:** When comparing environments, the system also identifies drifts in the underlying dependencies, not just the primary modules.

## Version Drift Analysis

The drift engine compares module versions across environments to identify discrepancies.

### Comparison Reports
A `ComparisonReport` is generated to summarize the state of modules across multiple environments. It highlights:
- **`VersionDriftEntry`:** Each entry represents a module's version in a specific environment compared to a reference or baseline.
- **Drift Actions:**
  - **Upgrade:** The target environment has a lower version than the source.
  - **Downgrade:** The target environment has a higher version (potentially a regression).
  - **Missing:** The module is not present in the target environment.
  - **Match:** Versions are identical.

## Monitoring Workflows

1. **Auto-Sync:** The system periodically triggers sync operations for all active environments.
2. **Analysis:** The drift engine processes the latest sync records to update the version drift metrics.
3. **Reporting:** Users can generate and export comparison reports to identify modules that need to be included in the next release plan.
