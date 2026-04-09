# Dashboards & Analytics

The dashboard provides a high-level overview of the system's health, development velocity, and release progress.

## KPI Modules

### Development Velocity
Tracks the speed at which development requests are moving through the pipeline.
- **Cycle Time:** Average time taken from "In Progress" to "Ready".
- **Lead Time:** Average time from "Draft" to "Done".
- **Throughput:** Number of requests closed in a given period.

### Release Pipeline
Provides visibility into the status of active and historical release plans.
- **Success Rate:** Percentage of releases that closed successfully vs. those that failed.
- **Deployment Frequency:** How often releases are being pushed to production.
- **Open Releases:** Count of releases in Draft, Planned, or Executed states.

### Infrastructure Health
Monitors the connectivity and status of Odoo environments.
- **Environment Status:** Real-time indicator of whether the XML-RPC connection is active for each environment.
- **Sync History:** Log of recent module sync operations, including errors and durations.

### Workload Matrix
Analyzes the distribution of development tasks across the team.
- **Assigned per Developer:** Heatmap of open DRs assigned to each developer.
- **Functional Area Split:** Breakdown of requests by functional category (e.g., 40% Sales, 30% Inventory).

## Saved Views & Customization

Users can customize their experience by creating and managing **Saved Views**.

- **Creation:** Users can apply filters (e.g., by developer, state, or functional category), search terms, and grouping options to a list view and save it for future use.
- **Public vs. Private:** Views can be marked as "Public" to be shared with the team or kept private for individual use.
- **Persisted State:** Each saved view stores the exact query state, including applied filters, search terms, and whether archived records are shown.
- **Management:** Users can easily switch between views, update existing ones, or delete those that are no longer needed.

## Data Aggregation

The dashboard service aggregates data from several core models:
- **`DevelopmentRequest`:** For velocity and workload metrics.
- **`ReleasePlan`:** For pipeline success rates.
- **`SyncRecord`:** For infrastructure health and environment sync history.
- **`ComparisonReport`:** To highlight critical version drifts across the infrastructure.
