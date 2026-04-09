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

## Environment Management

Environments represent the Odoo instances being tracked.

- **URL & Connectivity:** Each environment must have a unique URL and valid credentials (DB name, User, Password) for the Odoo XML-RPC client to perform sync operations.
- **Environment Categories:** Environments are classified as `Development`, `Test`, or `Production`.
- **Promotion Order:** An integer field (`order`) defines the sequence of environments. A lower number represents an earlier environment in the pipeline (e.g., Dev=1, Prod=10).
- **Active Status:** Environments can be deactivated to stop monitoring and syncing without deleting historical data.

## Permissions and RBAC

The system uses a robust Role-Based Access Control (RBAC) model managed through a **Security Matrix**.

### Roles
Users are assigned one or more roles (e.g., `Developer`, `Manager`, `System Admin`). Each role has:
- **Priority:** A numerical value where lower numbers indicate higher authority (e.g., Admin = 10, Developer = 100).
- **Permissions:** A list of granular permission strings that grant access to specific actions.

### Granular Permissions
Some of the key permissions include:
- **`system:manage`:** Full access to all settings, parameters, and environment configurations. Bypasses most state-locking rules.
- **`dev_request:create/update/delete`:** Core CRUD for Development Requests.
- **`dev_request:state_change`:** Permission to transition a DR between states.
- **`release_plan:approve`:** Permission to approve a release plan for execution.
- **`sync:trigger`:** Permission to manually initiate a module sync from an environment.
- **`uat:update`:** Permission to update UAT statuses and ticket references.

### State-Aware Enforcement
While permissions grant the *capability* to perform an action, the system also checks the *state* of the record:
- **Locked States:** In `Done` or `Cancelled` states, standard `update` permissions are ignored; only users with `system:manage` can edit the record.
- **Production Gates:** Even with `release_plan:update` permission, the system will block a production deployment if UAT requirements are not met.
