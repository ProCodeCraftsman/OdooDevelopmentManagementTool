# Dashboards

The Dashboard provides a centralized view of development activity, release progress, and infrastructure health.

## Core Metrics and KPIs

### Development Velocity
- **Active Requests:** Count of Development Requests currently in Draft, In Progress, or Ready states.
- **Completion Percentage:** Calculated as `Closed Requests / Total Requests`.

### Release Pipeline
- **Active Plans:** Total count of Release Plans in non-terminal states (Draft, Planned, Approved, Executing).
- **Next Deployment:** The earliest `planned_deployment_date` among all active release plans.

### Infrastructure Health
- **Active Environments:** Total count of environments currently marked as active.
- **Synced Last 24h:** Count of unique environments that have successfully completed a sync within the last 24 hours.
- **Pending Actions:** Count of version drift entries that require attention (excluding "No Action").

## Aggregated Reports

### Developer Workload Matrix
A matrix displaying the distribution of requests (Draft, In Progress, Ready, Done) across assigned developers. This helps identify bottlenecks or unassigned tasks.

### Pipeline Distribution
A summary chart showing the number of requests in each category (Draft, In Progress, Ready, Done) to visualize the flow of the development pipeline.

### Upcoming Deployments
A prioritized list of the next 5 scheduled release plans, showing their target environments and planned deployment dates.

### UAT Activity
A summary of the current status of all module-level User Acceptance Tests (e.g., Open, In Progress, Not Set).

### Version Drift Summary
A card-based summary highlighting the total number of identified drifts, categorized by:
- **Upgrades:** Modules ready for promotion.
- **Downgrades/Errors:** Potential version conflicts.
- **Missing:** Modules that are absent in a target environment but present in the source.
