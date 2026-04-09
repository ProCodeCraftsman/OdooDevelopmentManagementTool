# Development Requests

Development Requests (DRs) are the primary mechanism for tracking feature requests, bug fixes, and other development tasks within the system.

## Core Entities

### Development Request
The `DevelopmentRequest` model represents the request itself. It includes:
- **Request Number:** A unique identifier for the request (e.g., DR-001).
- **Title and Description:** A concise title and detailed explanation of the request.
- **Categorization:** Links to `RequestType` (e.g., Development, Bugfix), `FunctionalCategory` (e.g., Sales, Inventory), `RequestState`, and `Priority`.
- **Assignment:** Tracks the assigned developer and the user who created/updated the request.
- **Hierarchy:** Supports parent/child relationships (`parent_request_id`) and many-to-many symmetric relationships (`related_requests`).
- **Archive Status:** Requests can be "Archived" (`is_archived = True`) to hide them from standard views without deleting data.

### Request Module Line
A DR can involve multiple technical modules. Each `RequestModuleLine` tracks:
- **Module:** Link to the technical `Module` record.
- **Version:** The version of the module being developed or patched.
- **MD5 Sum:** Used for verification of module integrity.
- **UAT Status:** Tracks the User Acceptance Testing progress (e.g., Open, In Progress, Passed).
- **Technical Note:** A dedicated `tec_note` field for developers to record implementation details.

### Interactions
- **Threaded Comments:** `RequestComment` allows for threaded discussions on a DR, facilitating collaboration between developers and stakeholders.
- **Attachments:** `RequestAttachment` enables uploading relevant files (logs, screenshots, specifications) directly to the DR.

## Workflows

### State Transitions
DRs follow a standard lifecycle managed via the `RequestState`:
- **Draft:** Initial creation stage.
- **In Progress:** Development is active.
- **Ready:** Development is complete and ready for testing/deployment.
- **Done:** The request has been successfully deployed and closed.
- **Rejected/Cancelled:** The request has been rejected or cancelled.

### Linking to Releases
Module lines from a DR are selected and linked to **Release Plans** for movement across environments. This ensures that only verified and required module versions are bundled in a release.

## System Validations & Business Rules

To maintain data integrity and workflow consistency, the following validations are enforced:

### Request Integrity
- **Unique Request Numbers:** Every DR is assigned a unique tracking number (e.g., DR-001) that cannot be duplicated.
- **Circular Dependency Protection:** The system prevents parent/child loops (e.g., Request A cannot be the parent of Request B if Request B is already a parent of Request A).
- **Mandatory Categorization:** A request cannot be created without a valid Type, Functional Category, and Priority.

### Workflow & State Rules
- **State-Type Compatibility:** The system uses **Development Request State Type Rules** to enforce which states are valid for a given request type. For example, a "Bugfix" might have different allowed states than a "New Feature". These rules are configurable by administrators.
- **Final State Locking:** Once a request enters a final state (`Done` or `Cancelled`), it is locked. Only users with `system:manage` permissions can modify core fields or add/remove module lines from a finalized request.
- **Reopening Logic:** Finalized requests must be explicitly "Reopened" to allow further modifications, which transitions them back to an active state.

### Module & Dependencies
- **Duplicate Prevention:** The same module cannot be added multiple times to a single Development Request.
- **Active Release Check:** A module cannot be modified or deleted if it is currently part of an **Active Release Plan** (Draft, Planned, Approved, or Executing).
- **Module Dependencies:** The system tracks dependencies between modules (`ModuleDependency`). This ensures that when a module is promoted, its required dependencies are also accounted for in the target environment.
