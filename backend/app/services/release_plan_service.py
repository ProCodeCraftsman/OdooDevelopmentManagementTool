from typing import Optional, List, Tuple
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import User
from app.models.release_plan import ReleasePlan, ReleasePlanLine
from app.models.environment import Environment
from app.models.development_request import DevelopmentRequest, RequestModuleLine
from app.models.sync_record import SyncRecord, SyncStatus
from app.models.module import Module
from app.models.control_parameters.release_plan_state import ReleasePlanState
from app.models.control_parameters import RequestState
from app.services.comparer import calculate_drift_action

from app.repositories.release_plan import ReleasePlanRepository, ReleasePlanLineRepository
from app.repositories.release_plan_state import ReleasePlanStateRepository
from app.repositories.development_request import DevelopmentRequestRepository

from app.schemas.release_plan import (
    ReleasePlanCreate,
    ReleasePlanUpdate,
    ReleasePlanLineCreate,
    ReleasePlanLineUpdate,
)
from app.core.security_matrix import SecurityMatrixEngine, Permission

# Macro state categories for release plans
MACRO_DRAFT = "Draft"
MACRO_PLANNED = "Planned"
MACRO_APPROVED = "Approved"
MACRO_EXECUTING = "Executing"
MACRO_CLOSED = "Closed"
MACRO_FAILED = "Failed"

# UAT status values for production gate check
UAT_STATUS_CLOSED = "Closed"

# Environment categories
ENV_CAT_PRODUCTION = "Production"
ENV_CAT_TEST = "Test"
ENV_CAT_DEVELOPMENT = "Development"


def _parse_version(version_str: Optional[str]) -> Tuple[int, ...]:
    """Parse a version string like '17.0.1.2.3' into a tuple of ints for comparison."""
    if not version_str:
        return (0,)
    try:
        parts = version_str.split(".")
        return tuple(int(p) for p in parts if p.isdigit())
    except Exception:
        return (0,)


def _compute_release_action(
    module_technical_name: str,
    source_version: Optional[str],
    target_version: Optional[str],
    source_state: Optional[str] = None,
) -> str:
    """
    Compute the release action for a line.
    - If source version is None/missing → "Not Okay" (uninstalled block)
    - If target version is None → first deployment to target, allow → "All Okay"
    - If target version > source version → "Not Okay" (anti-regression)
    - Otherwise → "All Okay"
    """
    if not source_version or (source_state and source_state.lower() == "uninstalled"):
        return "Not Okay"
    if not target_version:
        # First deployment to target — allowed
        return "All Okay"
    src = _parse_version(source_version)
    tgt = _parse_version(target_version)
    if tgt > src:
        return "Not Okay"
    return "All Okay"


class ReleasePlanService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ReleasePlanRepository(db)
        self.line_repo = ReleasePlanLineRepository(db)
        self.state_repo = ReleasePlanStateRepository(db)
        self.dr_repo = DevelopmentRequestRepository(db)

    # ─── Helpers ─────────────────────────────────────────────────────────────

    def _get_plan_or_404(self, plan_id: int) -> ReleasePlan:
        plan = self.repo.get_with_relations(plan_id)
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release plan not found")
        return plan

    def _get_env_or_404(self, env_id: int) -> Environment:
        env = self.db.query(Environment).filter(Environment.id == env_id).first()
        if not env:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Environment {env_id} not found")
        return env

    def _get_state_or_404(self, state_id: int) -> ReleasePlanState:
        s = self.state_repo.get(state_id)
        if not s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release plan state not found")
        return s

    def _macro_state(self, plan: ReleasePlan) -> str:
        return plan.state.category if plan.state else MACRO_DRAFT

    def _check_create_permission(self, user: User) -> None:
        if not SecurityMatrixEngine.has_permission(user, Permission.RELEASE_PLAN_CREATE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to create release plans",
            )

    def _check_modify_permission(self, user: User, plan: ReleasePlan) -> None:
        if not SecurityMatrixEngine.has_permission(user, Permission.RELEASE_PLAN_UPDATE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to modify release plans",
            )
        macro = self._macro_state(plan)
        # Closed/Failed plans can only be modified by system admins
        if macro in [MACRO_CLOSED, MACRO_FAILED] and not SecurityMatrixEngine.has_permission(user, Permission.SYSTEM_MANAGE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only system administrators can modify a closed or failed/cancelled release plan",
            )

    def _validate_environment_order(self, source: Environment, target: Environment) -> None:
        if source.order <= target.order:
            # Source order should be > target order (source is "lower/earlier" env)
            # Actually per spec: Source Environment's order > Target Environment's order → warning
            # But we raise a warning-level validation, not a hard block
            # Based on spec: raise warning if source.order <= target.order
            # We'll raise HTTP 422 with a descriptive message to surface as warning
            pass  # This is a warning, not a hard block — surface via a field on response
        # The spec says warn if source.order < target.order (source earlier than target which is wrong)
        # The intent is source should have higher order than target to be "going up" the chain
        # We raise a warning but allow creation

    def _validate_env_change_clears_lines(self, plan: ReleasePlan) -> None:
        """Called before changing environments — all lines should be cleared."""
        # Handled in the update path by checking if env IDs changed

    def _get_latest_sync_version(
        self, environment_id: int, module_technical_name: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Return (version_string, state) for a module in an environment from the latest completed sync.
        """
        record = (
            self.db.query(SyncRecord)
            .join(Module, Module.id == SyncRecord.module_id)
            .filter(
                SyncRecord.environment_id == environment_id,
                Module.name == module_technical_name,
                SyncRecord.status == SyncStatus.COMPLETED,
            )
            .order_by(SyncRecord.completed_at.desc())
            .first()
        )
        if record:
            return record.version_string, record.state
        return None, None

    def _populate_line_env_versions(self, line: ReleasePlanLine, plan: ReleasePlan) -> None:
        """Fetch live sync data and compute release_action for a line."""
        if not line.module_technical_name:
            return

        src_version, src_state = self._get_latest_sync_version(
            plan.source_environment_id, line.module_technical_name
        )
        tgt_version, _ = self._get_latest_sync_version(
            plan.target_environment_id, line.module_technical_name
        )

        line.source_env_version = src_version
        line.target_env_version = tgt_version
        line.release_action = _compute_release_action(
            line.module_technical_name, src_version, tgt_version, src_state
        )

    def _refresh_all_line_versions(self, plan: ReleasePlan) -> None:
        """Refresh env versions for all lines of a plan (used when env changes or sync update)."""
        for line in plan.lines:
            self._populate_line_env_versions(line, plan)
        self.db.commit()

    # ─── Validation gates ─────────────────────────────────────────────────────

    def _validate_transition_to_inprogress_or_closed(
        self, plan: ReleasePlan, new_state: ReleasePlanState
    ) -> None:
        """
        Validates gates before transitioning to macro state In Progress or Closed.
        Pre-flight check: refreshes versions and blocks on No Action, regression, uninstalled.
        """
        new_macro = new_state.category
        if new_macro not in [MACRO_EXECUTING, MACRO_CLOSED]:
            return

        target_env = plan.target_environment
        target_category = target_env.category if target_env else ""
        src_env_name = plan.source_environment.name if plan.source_environment else "source"
        tgt_env_name = target_env.name if target_env else "target"

        ineligible_modules = []

        for line in plan.lines:
            module_name = line.module_technical_name or "unknown"

            # Re-fetch live versions for pre-flight check
            src_ver, src_state = self._get_latest_sync_version(
                plan.source_environment_id, module_name
            )
            tgt_ver, _ = self._get_latest_sync_version(
                plan.target_environment_id, module_name
            )

            # Update the line's live versions
            line.source_env_version = src_ver
            line.target_env_version = tgt_ver
            line.release_action = _compute_release_action(module_name, src_ver, tgt_ver, src_state)

            # Comparison gate: "No Action" means versions match → ineligible
            drift_action, _ = calculate_drift_action(src_ver, tgt_ver, src_env_name, tgt_env_name)
            if drift_action == "No Action":
                ineligible_modules.append(f"'{module_name}' (No Action — versions already match)")

            # Anti-Regression Block: target version > source version
            if src_ver and tgt_ver:
                src_parsed = _parse_version(src_ver)
                tgt_parsed = _parse_version(tgt_ver)
                if tgt_parsed > src_parsed:
                    ineligible_modules.append(
                        f"'{module_name}' (Downgrade blocked: target {tgt_ver} > source {src_ver})"
                    )

            # Uninstalled source block (Production targets only)
            if src_state and src_state.lower() == "uninstalled" and target_category == ENV_CAT_PRODUCTION:
                ineligible_modules.append(f"'{module_name}' (uninstalled in source environment)")

        if ineligible_modules:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Pre-flight check failed. The following module(s) are ineligible: "
                       f"{'; '.join(ineligible_modules)}",
            )

        # Production UAT gate: DR line uat_status must be 'Closed'
        if target_category == ENV_CAT_PRODUCTION:
            for line in plan.lines:
                if line.uat_status and line.uat_status != UAT_STATUS_CLOSED:
                    module_name = line.module_technical_name or "unknown"
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Module '{module_name}' UAT status must be 'Closed' for Production deployment. "
                               f"Current: '{line.uat_status}'.",
                    )


    def _check_skip_level_warning(self, source: Environment, target: Environment) -> Optional[str]:
        """Returns a warning string if deploying from Development directly to Production."""
        if (
            source.category == ENV_CAT_DEVELOPMENT
            and target.category == ENV_CAT_PRODUCTION
        ):
            return (
                f"Warning: Deploying directly from Development ({source.name}) "
                f"to Production ({target.name}) without a Staging/Test step."
            )
        return None

    # ─── CRUD ─────────────────────────────────────────────────────────────────

    def create(self, user: User, data: ReleasePlanCreate) -> Tuple[ReleasePlan, Optional[str]]:
        self._check_create_permission(user)

        source = self._get_env_or_404(data.source_environment_id)
        target = self._get_env_or_404(data.target_environment_id)

        if source.id == target.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source and target environments must be different.",
            )

        warning = None
        if source.order <= target.order:
            warning = (
                f"Warning: Source environment '{source.name}' (order={source.order}) "
                f"should have a higher order than target '{target.name}' (order={target.order})."
            )

        skip_warning = self._check_skip_level_warning(source, target)
        if skip_warning:
            warning = skip_warning

        # Resolve state — default to Draft
        if data.state_id:
            state = self._get_state_or_404(data.state_id)
        else:
            state = self.state_repo.get_draft_state()
            if not state:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No 'Draft' release plan state found. Please seed release plan states.",
                )

        plan = self.repo.create_with_number(
            release_version=data.release_version,
            source_environment_id=data.source_environment_id,
            target_environment_id=data.target_environment_id,
            state_id=state.id,
            planned_deployment_date=data.planned_deployment_date,
            release_notes=data.release_notes,
            comments=data.comments,
            approved_by_id=data.approved_by_id,
            deployed_by_id=data.deployed_by_id,
            related_release_plan_id=data.related_release_plan_id,
            created_by_id=user.id,
        )

        # Reload with relations
        plan = self.repo.get_with_relations(plan.id)
        return plan, warning

    def update(self, user: User, plan_id: int, data: ReleasePlanUpdate) -> Tuple[ReleasePlan, Optional[str]]:
        plan = self._get_plan_or_404(plan_id)
        self._check_modify_permission(user, plan)

        update_dict = data.model_dump(exclude_unset=True)
        warning = None

        # Check if environments are changing — must clear lines
        env_changed = (
            ("source_environment_id" in update_dict and update_dict["source_environment_id"] != plan.source_environment_id)
            or ("target_environment_id" in update_dict and update_dict["target_environment_id"] != plan.target_environment_id)
        )

        if env_changed:
            # Clearing is confirmed by the caller; delete all lines
            for line in plan.lines:
                self.db.delete(line)
            self.db.flush()

        # Validate environment order if changing envs
        new_src_id = update_dict.get("source_environment_id", plan.source_environment_id)
        new_tgt_id = update_dict.get("target_environment_id", plan.target_environment_id)
        if env_changed:
            new_src = self._get_env_or_404(new_src_id)
            new_tgt = self._get_env_or_404(new_tgt_id)
            if new_src.id == new_tgt.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Source and target environments must be different.",
                )
            if new_src.order <= new_tgt.order:
                warning = (
                    f"Warning: Source environment '{new_src.name}' (order={new_src.order}) "
                    f"should have a higher order than target '{new_tgt.name}' (order={new_tgt.order})."
                )
            skip_warning = self._check_skip_level_warning(new_src, new_tgt)
            if skip_warning:
                warning = skip_warning

        # State transition validation
        if "state_id" in update_dict and update_dict["state_id"] != plan.state_id:
            new_state = self._get_state_or_404(update_dict["state_id"])
            # Reload plan lines for validation
            plan_for_validation = self.repo.get_with_relations(plan_id)
            self._validate_transition_to_inprogress_or_closed(plan_for_validation, new_state)

            # Auto-set actual_deployment_date when moving to Deployed
            if new_state.name == "Deployed" and not plan.actual_deployment_date:
                update_dict["actual_deployment_date"] = datetime.utcnow()

            # Take snapshot when closing
            if new_state.category in [MACRO_CLOSED, MACRO_FAILED]:
                update_dict["is_snapshot_taken"] = True

        # Apply updates
        for field, value in update_dict.items():
            setattr(plan, field, value)

        self.db.commit()
        self.db.refresh(plan)
        plan = self.repo.get_with_relations(plan_id)

        # Refresh env versions if envs changed
        if env_changed:
            self._refresh_all_line_versions(plan)
            plan = self.repo.get_with_relations(plan_id)

        return plan, warning

    def get(self, plan_id: int) -> ReleasePlan:
        plan = self._get_plan_or_404(plan_id)
        # Refresh live env versions if plan is not snapshotted
        if not plan.is_snapshot_taken:
            self._refresh_all_line_versions(plan)
            plan = self._get_plan_or_404(plan_id)
        return plan

    def list(
        self,
        state_id: Optional[int] = None,
        source_environment_id: Optional[int] = None,
        target_environment_id: Optional[int] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[ReleasePlan], int]:
        skip = (page - 1) * limit
        return self.repo.get_all_with_filters(
            state_id=state_id,
            source_environment_id=source_environment_id,
            target_environment_id=target_environment_id,
            skip=skip,
            limit=limit,
        )

    def delete(self, user: User, plan_id: int) -> None:
        if not SecurityMatrixEngine.has_permission(user, Permission.RELEASE_PLAN_DELETE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete release plans.",
            )
        plan = self._get_plan_or_404(plan_id)
        macro = self._macro_state(plan)
        if macro in [MACRO_EXECUTING, MACRO_CLOSED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete an in-progress or closed release plan.",
            )
        self.db.delete(plan)
        self.db.commit()

    # ─── Line management ──────────────────────────────────────────────────────

    # ─── Eligible-modules wizard ──────────────────────────────────────────────

    def _is_module_version_in_active_plan(
        self, module_technical_name: str, module_version: Optional[str],
        target_environment_id: int, exclude_plan_id: int
    ) -> bool:
        """Return True if the same module+version is already in another active plan
        targeting the same environment."""
        q = (
            self.db.query(ReleasePlanLine)
            .join(ReleasePlan, ReleasePlanLine.release_plan_id == ReleasePlan.id)
            .join(ReleasePlanState, ReleasePlan.state_id == ReleasePlanState.id)
            .filter(
                ReleasePlanLine.module_technical_name == module_technical_name,
                ReleasePlan.target_environment_id == target_environment_id,
                ReleasePlan.id != exclude_plan_id,
                ReleasePlanState.category.in_(
                    [MACRO_DRAFT, MACRO_PLANNED, MACRO_APPROVED, MACRO_EXECUTING]
                ),
            )
        )
        if module_version:
            q = q.filter(ReleasePlanLine.module_version == module_version)
        return q.count() > 0

    def get_eligible_modules(self, plan_id: int, request_id: int) -> List[dict]:
        """
        Return all DR module lines with eligibility metadata for the wizard.
        Eligible lines first, then disabled ones. Checks:
          1. DR state must be "In Progress"
          2. UAT gate (Production target only: ml.uat_status == 'Closed')
          3. Comparison gate: live drift action must not be "No Action"
          4. Active plan lock: same module+version not in another active plan
             targeting same target environment
          5. Already in this plan
        """
        plan = self._get_plan_or_404(plan_id)
        target_env = plan.target_environment
        target_category = target_env.category if target_env else ""
        src_env_name = plan.source_environment.name if plan.source_environment else "source"
        tgt_env_name = target_env.name if target_env else "target"

        dr = self.db.query(DevelopmentRequest).filter(DevelopmentRequest.id == request_id).first()
        if not dr:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")

        dr_state = self.db.query(RequestState).filter(RequestState.id == dr.request_state_id).first()

        module_lines = (
            self.db.query(RequestModuleLine)
            .filter(RequestModuleLine.request_id == request_id)
            .all()
        )

        results = []
        for ml in module_lines:
            is_eligible = True
            disable_reason: Optional[str] = None

            # Gate 0: DR must be "In Progress"
            if not dr_state or dr_state.category != "In Progress":
                is_eligible = False
                disable_reason = f"DR state must be 'In Progress' (current: '{dr_state.category if dr_state else 'unknown'}')"

            # Gate 1: UAT (Production only)
            if is_eligible and target_category == ENV_CAT_PRODUCTION:
                if ml.uat_status != UAT_STATUS_CLOSED:
                    is_eligible = False
                    disable_reason = f"UAT status not 'Closed' (current: '{ml.uat_status or 'none'}')"

            # Gate 2: Live comparison — No Action means versions match
            src_ver, src_state_str = self._get_latest_sync_version(
                plan.source_environment_id, ml.module_technical_name
            )
            tgt_ver, _ = self._get_latest_sync_version(
                plan.target_environment_id, ml.module_technical_name
            )
            drift_action, _ = calculate_drift_action(src_ver, tgt_ver, src_env_name, tgt_env_name)

            if is_eligible and drift_action == "No Action":
                is_eligible = False
                disable_reason = "No Action needed — versions already match in target environment"

            # Gate 3: Already in this plan (by request_module_line_id)
            already_in_plan = (
                self.db.query(ReleasePlanLine)
                .filter(
                    ReleasePlanLine.release_plan_id == plan_id,
                    ReleasePlanLine.request_module_line_id == ml.id,
                )
                .first()
            )
            if is_eligible and already_in_plan:
                is_eligible = False
                disable_reason = "Already linked to this Release Plan"

            # Gate 4: Module+version in another active plan for same target env
            if is_eligible and self._is_module_version_in_active_plan(
                ml.module_technical_name, ml.module_version, plan.target_environment_id, plan_id
            ):
                is_eligible = False
                disable_reason = "Already in another active Release Plan for this environment"

            results.append({
                "id": ml.id,
                "module_id": ml.module_id,
                "module_technical_name": ml.module_technical_name,
                "module_version": ml.module_version,
                "module_md5_sum": ml.module_md5_sum,
                "uat_status": ml.uat_status,
                "uat_ticket": ml.uat_ticket,
                "source_env_version": src_ver,
                "target_env_version": tgt_ver,
                "drift_action": drift_action,
                "is_eligible": is_eligible,
                "disable_reason": disable_reason,
            })

        # Eligible lines first, then disabled
        results.sort(key=lambda x: (not x["is_eligible"], x["module_technical_name"]))
        return results

    def link_module_lines(
        self, user: User, plan_id: int, module_line_ids: List[int]
    ) -> Tuple[List[ReleasePlanLine], List[str], List[str]]:
        """
        Link specific RequestModuleLines to this Release Plan.
        Validates each line against all gates before inserting.
        """
        plan = self._get_plan_or_404(plan_id)
        self._check_modify_permission(user, plan)

        macro = self._macro_state(plan)
        if macro != MACRO_DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Module lines can only be linked when the plan is Draft (current: '{macro}').",
            )

        target_env = plan.target_environment
        target_category = target_env.category if target_env else ""
        src_env_name = plan.source_environment.name if plan.source_environment else "source"
        tgt_env_name = target_env.name if target_env else "target"

        added: List[ReleasePlanLine] = []
        skipped: List[str] = []
        errors: List[str] = []

        for ml_id in module_line_ids:
            ml = self.db.query(RequestModuleLine).filter(RequestModuleLine.id == ml_id).first()
            if not ml:
                errors.append(f"Module line {ml_id} not found")
                continue

            dr = self.db.query(DevelopmentRequest).filter(DevelopmentRequest.id == ml.request_id).first()
            if not dr:
                errors.append(f"DR for module line {ml_id} not found")
                continue

            dr_state = self.db.query(RequestState).filter(RequestState.id == dr.request_state_id).first()
            if not dr_state or dr_state.category != "In Progress":
                errors.append(f"'{ml.module_technical_name}': DR must be In Progress")
                continue

            # UAT gate
            if target_category == ENV_CAT_PRODUCTION and ml.uat_status != UAT_STATUS_CLOSED:
                errors.append(f"'{ml.module_technical_name}': UAT status not Closed")
                continue

            # Comparison gate
            src_ver, src_state_str = self._get_latest_sync_version(
                plan.source_environment_id, ml.module_technical_name
            )
            tgt_ver, _ = self._get_latest_sync_version(
                plan.target_environment_id, ml.module_technical_name
            )
            drift_action, _ = calculate_drift_action(src_ver, tgt_ver, src_env_name, tgt_env_name)
            if drift_action == "No Action":
                errors.append(f"'{ml.module_technical_name}': No Action needed, versions already match")
                continue

            # Already in this plan
            existing = (
                self.db.query(ReleasePlanLine)
                .filter(
                    ReleasePlanLine.release_plan_id == plan_id,
                    ReleasePlanLine.request_module_line_id == ml.id,
                )
                .first()
            )
            if existing:
                skipped.append(f"'{ml.module_technical_name}' already in this plan")
                continue

            # Module uniqueness per plan (by technical name)
            existing_by_name = self.line_repo.get_by_plan_and_module(plan_id, ml.module_technical_name)
            if existing_by_name:
                skipped.append(f"'{ml.module_technical_name}' already in this plan (duplicate module)")
                continue

            # Cross-plan module+version uniqueness
            if self._is_module_version_in_active_plan(
                ml.module_technical_name, ml.module_version, plan.target_environment_id, plan_id
            ):
                errors.append(
                    f"'{ml.module_technical_name}' v{ml.module_version}: already in an active plan for this environment"
                )
                continue

            line = ReleasePlanLine(
                release_plan_id=plan_id,
                request_module_line_id=ml.id,
                development_request_id=dr.id,
                module_id=ml.module_id,
                module_technical_name=ml.module_technical_name,
                module_version=ml.module_version,
                module_email=ml.email_thread_zip,
                module_md5_hash=ml.module_md5_sum,
                uat_ticket=ml.uat_ticket,
                uat_status=ml.uat_status,
            )
            self._populate_line_env_versions(line, plan)
            self.db.add(line)
            self.db.flush()
            self.db.refresh(line)
            added.append(line)

        self.db.commit()
        for line in added:
            self.db.refresh(line)
        return added, skipped, errors

    def get_linked_plans_for_dr(self, request_id: int) -> List[dict]:
        """Return all release plan lines linked to any module line of this DR."""
        lines = (
            self.db.query(ReleasePlanLine)
            .join(ReleasePlan, ReleasePlanLine.release_plan_id == ReleasePlan.id)
            .join(ReleasePlanState, ReleasePlan.state_id == ReleasePlanState.id)
            .filter(ReleasePlanLine.development_request_id == request_id)
            .all()
        )
        results = []
        for line in lines:
            plan = line.release_plan
            if not plan:
                continue
            results.append({
                "release_plan_line_id": line.id,
                "module_technical_name": line.module_technical_name,
                "module_version": line.module_version,
                "plan_id": plan.id,
                "plan_number": plan.plan_number,
                "source_env_name": plan.source_environment.name if plan.source_environment else "—",
                "target_env_name": plan.target_environment.name if plan.target_environment else "—",
                "state_name": plan.state.name if plan.state else "—",
                "state_category": plan.state.category if plan.state else "—",
                "planned_deployment_date": plan.planned_deployment_date,
                "actual_deployment_date": plan.actual_deployment_date,
            })
        return results

    def update_line(
        self, user: User, plan_id: int, line_id: int, data: ReleasePlanLineUpdate
    ) -> ReleasePlanLine:
        plan = self._get_plan_or_404(plan_id)
        self._check_modify_permission(user, plan)

        line = self.line_repo.get(line_id)
        if not line or line.release_plan_id != plan_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release plan line not found")

        update_dict = data.model_dump(exclude_unset=True)

        # If dev request or module is changed, reset related fields
        if "development_request_id" in update_dict or "module_id" in update_dict:
            line.module_version = None
            line.module_email = None
            line.module_md5_hash = None
            line.uat_status = None
            line.uat_ticket = None
            line.source_env_version = None
            line.target_env_version = None
            line.release_action = None

        for field, value in update_dict.items():
            setattr(line, field, value)

        # Recalculate env versions and action
        if not plan.is_snapshot_taken:
            self._populate_line_env_versions(line, plan)

        self.db.commit()
        self.db.refresh(line)
        return line

    def delete_line(self, user: User, plan_id: int, line_id: int) -> None:
        plan = self._get_plan_or_404(plan_id)
        self._check_modify_permission(user, plan)

        macro = self._macro_state(plan)
        if macro != MACRO_DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lines can only be unlinked when the plan is Draft. Current: '{macro}'.",
            )

        line = self.line_repo.get(line_id)
        if not line or line.release_plan_id != plan_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release plan line not found")

        self.db.delete(line)
        self.db.commit()

    def get_permissions_payload(self, user: User, plan: ReleasePlan) -> dict:
        macro = self._macro_state(plan)
        has = lambda p: SecurityMatrixEngine.has_permission(user, p)  # noqa: E731

        can_create = has(Permission.RELEASE_PLAN_CREATE)
        can_modify = has(Permission.RELEASE_PLAN_UPDATE)
        can_delete = has(Permission.RELEASE_PLAN_DELETE)
        can_manage_lines = can_modify and macro in [MACRO_DRAFT, MACRO_PLANNED]
        can_transition_state = can_modify
        can_approve = has(Permission.RELEASE_PLAN_APPROVE)
        can_deploy = has(Permission.SYNC_TRIGGER)

        top_role = max(user.roles, key=lambda r: r.priority, default=None) if user.roles else None

        return {
            "can_create": can_create,
            "can_modify": can_modify,
            "can_delete": can_delete,
            "can_manage_lines": can_manage_lines,
            "can_transition_state": can_transition_state,
            "can_approve": can_approve,
            "can_deploy": can_deploy,
            "current_role_level": top_role.priority if top_role else 0,
            "current_role_name": top_role.name if top_role else "unknown",
            "macro_state": macro,
        }
