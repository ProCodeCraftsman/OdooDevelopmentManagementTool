# System Settings & Permissions

This document describes the core management of system parameters, environments, and user permissions within the GPS Odoo Tracker.

## Core Parameter Management

The system relies on several "Control Parameters" to drive workflows and categorization. These are managed via the **Settings** or **System Management** interface.

### Development Request Parameters
- **Request Types:** Categories like `Development`, `Bugfix`, `Support`, or `Hotfix`. Each type is linked to a macro category for logic branching.
- **Request States:** Defined lifecycle stages (e.g., Draft, In Progress, Ready, Done). States are mapped to macro categories (`Draft`, `In Progress`, `Ready`, `Done`, `Cancelled`) which trigger system-level locking and logic.
- **Functional Categories:** Business areas like `Sales`, `Inventory`, `Accounting`, or `HR`.
- **Priorities:** Urgency levels (e.g., Low, Medium, High, Critical).

### State-Type Rules
To enforce workflow consistency, the system uses **State-Type Rules**. These rules define which `RequestState` is valid for a given `RequestType`.
- **Enforcement:** If a rule is not active for a specific type/state combination, the system will block moving a request into that state.
- **Configuration:** Admins can toggle these rules on/off to adapt the workflow to changing business needs.

### Control Parameter Rules
A more generic rule engine exists to constrain the allowed values of other parameters based on the current state of a request.
- **Attributes:** Rules are defined per `request_state_name`.
- **Constraints:** Specify allowed `type_categories`, `priorities`, and `functional_categories`.
- **Usage:** These rules are typically enforced in the UI to prevent users from selecting invalid combinations during state transitions.

## Environment Management

Environments represent the Odoo instances being tracked.

- **URL & Connectivity:** Each environment must have a unique URL and valid credentials (DB name, User, Password) for the Odoo XML-RPC client to perform sync operations.
- **Environment Categories:** Environments are classified as `Development`, `Test`, or `Production`.
- **Promotion Order:** An integer field (`order`) defines the sequence of environments. A lower number represents an earlier environment in the pipeline (e.g., Dev=1, Prod=10).
- **Active Status:** Environments can be deactivated to stop monitoring and syncing without deleting historical data.
- **Cascading Deletes:** Deleting an environment will automatically clean up associated sync records and module metadata to maintain data integrity.

## Permissions and RBAC

The system uses a robust enterprise-grade Role-Based Access Control (RBAC) model managed through the `SecurityMatrixEngine`.

### Roles & Multi-Role Support
Users can be assigned one or more roles (e.g., `Developer`, `Manager`, `System Admin`).
- **Permissions Aggregation:** The system calculates the user's active permissions as the union of all permissions from their assigned roles.
- **Priority:** Roles have a numerical `priority` value. Lower numbers indicate higher authority (e.g., Admin = 10, Developer = 100). The user's effective priority is the minimum value across all their roles.
- **Active Status:** Roles can be deactivated to temporarily revoke access for all users in that role.

### Granular Permissions
The system uses canonical permission strings for fine-grained control:
- **`system:manage`:** Full access to all settings, parameters, and environment configurations. Bypasses most state-locking rules.
- **`dev_request:create/update/delete`:** Core CRUD for Development Requests.
- **`dev_request:state_change`:** Permission to transition a DR between states.
- **`dev_request:reopen`:** Permission to move a finalized request (Done/Cancelled) back to an active state.
- **`dev_request:archive`:** Permission to archive/unarchive requests.
- **`release_plan:approve`:** Permission to approve a release plan for execution.
- **`sync:trigger`:** Permission to manually initiate a module sync from an environment.
- **`uat:update`:** Permission to update UAT statuses and ticket references.

### State-Aware Enforcement (ABAC)
While permissions grant the *capability* to perform an action, the system also checks the *state* of the record in the service layer:
- **Locked States:** In `Done` or `Cancelled` states, standard `update` permissions are ignored; only users with `system:manage` can edit the record.
- **Finalized Updates:** To modify a closed record, it must be explicitly "Reopened", which resets it to an active state and requires the `dev_request:reopen` permission.
- **Production Gates:** Even with `release_plan:update` permission, the system will block a production deployment if UAT requirements are not met (all lines must be `Passed` or `Closed`).
