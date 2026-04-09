# Release Plans

Release Plans coordinate the movement of developed modules between environments (e.g., from Development to Staging, or Staging to Production).

## Core Entities

### Release Plan
The `ReleasePlan` entity acts as a container for a deployment event. Key attributes include:
- **Plan Number:** Unique identifier (e.g., RP-101).
- **Release Version:** Version string for the overall release.
- **Environment Context:** Specifies the `source_environment` and the `target_environment`.
- **Status:** Tracks the progress of the release through `ReleasePlanState` (e.g., Draft, Planned, Approved, Executing, Closed, Failed).
- **Audit Information:** Records who approved and deployed the release.

### Release Plan Line
A `ReleasePlanLine` links specific module changes from a **Development Request** to the release.
- **Linkage:** Direct FK to a `RequestModuleLine`.
- **Snapshots:** Captures the module version, MD5 hash, and email thread ZIP at the time of linking, ensuring immutability once linked.
- **Drift Comparison:** Stores the current version in the source and target environments at the time of plan creation to identify the `release_action` (e.g., Upgrade, Downgrade, No Action).

## Key Workflows

### Plan Creation and Snapshotting
1.  **Selection:** Developers select one or more module lines from completed DRs to include in a plan.
2.  **Validation:** The system compares the version of the selected module against what is currently running in the source and target environments.
3.  **Freezing:** When a plan's state is finalized (e.g., moved to Closed or Failed), a snapshot is taken (`is_snapshot_taken = True`), and the lines become immutable records of what was intended for deployment.

### Execution and Closing
- **Execution:** Once approved, the plan is executed. The `actual_deployment_date` and the user performing the deployment are recorded.
- **Rollback Coordination:** The `related_release_plan_id` can be used to link a release plan to its corresponding rollback or follow-up plan if needed.

## Release Plan Validations & Gates

Release Plans are subject to several technical and process-based gates to ensure stable production environments.

### Deployment Path Validations
- **Environment Order:** The system compares the source and target environment's defined `order`. Promoting from a higher-order environment to a lower-order one (e.g., Prod → Dev) generates a warning.
- **Environment Context:** A release plan must have both a source and target environment specified before it can be moved out of the `Draft` state.

### Production Gate Checks
Before a release can be promoted to a **Production** environment, the following criteria must be met:
- **UAT Closure:** All module lines within the release plan must have a `UAT Status` of `Closed` or `Passed`. The system blocks production deployments if any associated DR module line is still in testing.
- **Snapshot Requirement:** Once a plan moves to an executing or terminal state, its module list is frozen. No further lines can be added or removed without creating a new plan or rolling back.

### Version Safety
- **Anti-Regression Check:** The system compares the version of each module in the source environment against the target environment. If the target environment already has a *higher* version than the source, the line is flagged as "Not Okay" to prevent downgrades.
- **Missing Source Module:** If a module is included in a release plan but is not installed in the source environment, the plan line is flagged for attention.

### State Transitions & Permissions
- **Approval Flow:** Plans can only be marked as `Approved` by users with specific `release_plan:approve` permissions.
- **Modification Restrictions:** Once a plan reaches the `Executing`, `Closed`, or `Failed` macro states, modification is restricted to system administrators to preserve audit trails.
