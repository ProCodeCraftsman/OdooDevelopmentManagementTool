"""Dashboard aggregation service.

Provides two methods:
  - get_summary()       → Tab 1 Command Center KPIs, matrix, charts
  - get_version_drift() → Tab 2 module version comparison (Dev vs Prod)
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.comparison_report import ComparisonReportRow, VersionDriftEntry, ComparisonReport
from app.models.development_request import DevelopmentRequest, RequestModuleLine
from app.models.environment import Environment, EnvironmentCategory
from app.models.module import Module
from app.models.release_plan import ReleasePlan
from app.models.sync_record import SyncRecord, SyncStatus
from app.schemas.dashboard import (
    DashboardDriftResponse,
    DashboardSummaryResponse,
    DevVelocityKPI,
    FunctionalCategoryItem,
    InfraHealthKPI,
    PipelineDistributionItem,
    PriorityBreakdownItem,
    PriorityItem,
    RadarChartData,
    RadarDataPoint,
    ReleasePipelineKPI,
    RequestAnalysisResponse,
    UATActivityItem,
    UpcomingDeployment,
    UrgentDriftKPI,
    WorkloadRow,
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _latest_completed_job_id(db: Session, env_id: int) -> Optional[object]:
    """Return the job_id of the most recently completed sync for an environment."""
    row = (
        db.query(SyncRecord.job_id)
        .filter(
            SyncRecord.environment_id == env_id,
            SyncRecord.module_id.is_(None),   # job tracking row
            SyncRecord.status == SyncStatus.COMPLETED,
        )
        .order_by(SyncRecord.completed_at.desc())
        .first()
    )
    return row[0] if row else None


# ─── Summary (Tab 1) ──────────────────────────────────────────────────────────

def get_summary(db: Session) -> DashboardSummaryResponse:
    # ── 1. Dev Velocity ───────────────────────────────────────────────────────
    from app.models.control_parameters import RequestType, RequestState  # local import to avoid circular

    # Total Development-type requests (not archived)
    total_dev = (
        db.query(func.count(DevelopmentRequest.id))
        .join(RequestType, DevelopmentRequest.request_type_id == RequestType.id)
        .filter(
            RequestType.category == "Development",
            DevelopmentRequest.is_archived.is_(False),
        )
        .scalar() or 0
    )

    # Active = Draft + In Progress + Ready state category
    active_dev = (
        db.query(func.count(DevelopmentRequest.id))
        .join(RequestType, DevelopmentRequest.request_type_id == RequestType.id)
        .join(RequestState, DevelopmentRequest.request_state_id == RequestState.id)
        .filter(
            RequestType.category == "Development",
            DevelopmentRequest.is_archived.is_(False),
            RequestState.category.in_(["Draft", "In Progress", "Ready"]),
        )
        .scalar() or 0
    )

    # Completed Development requests
    closed_dev = (
        db.query(func.count(DevelopmentRequest.id))
        .join(RequestType, DevelopmentRequest.request_type_id == RequestType.id)
        .join(RequestState, DevelopmentRequest.request_state_id == RequestState.id)
        .filter(
            RequestType.category == "Development",
            DevelopmentRequest.is_archived.is_(False),
            RequestState.category == "Done",
        )
        .scalar() or 0
    )

    completion_pct = round((closed_dev / total_dev * 100), 1) if total_dev > 0 else 0.0

    # ── 2. Pending UAT ────────────────────────────────────────────────────────
    pending_uat = (
        db.query(func.count(RequestModuleLine.id))
        .filter(RequestModuleLine.uat_status.in_(["Open", "In Progress"]))
        .scalar() or 0
    )

    # ── 3. Release Pipeline ───────────────────────────────────────────────────
    from app.models.control_parameters.release_plan_state import ReleasePlanState

    active_plans_q = (
        db.query(ReleasePlan)
        .join(ReleasePlanState, ReleasePlan.state_id == ReleasePlanState.id)
        .filter(ReleasePlanState.category.in_(["Draft", "Planned", "Approved", "Executing"]))
    )
    active_plan_count = active_plans_q.count()

    # Next deployment = earliest planned_deployment_date among active plans with a date
    next_plan = (
        active_plans_q
        .filter(ReleasePlan.planned_deployment_date.isnot(None))
        .order_by(ReleasePlan.planned_deployment_date.asc())
        .first()
    )
    next_date = (
        next_plan.planned_deployment_date.isoformat() if next_plan and next_plan.planned_deployment_date else None
    )

    # ── 4. Infra Health ───────────────────────────────────────────────────────
    all_envs = db.query(Environment).filter(Environment.is_active.is_(True)).all()
    active_env_count = len(all_envs)

    cutoff_24h = datetime.utcnow() - timedelta(hours=24)
    synced_last_24h = (
        db.query(func.count(func.distinct(SyncRecord.environment_id)))
        .filter(
            SyncRecord.module_id.is_(None),
            SyncRecord.status == SyncStatus.COMPLETED,
            SyncRecord.completed_at >= cutoff_24h,
        )
        .scalar() or 0
    )

    # Pending actions: drift entries where action requires attention (not "No Action")
    latest_report = db.query(ComparisonReport).order_by(ComparisonReport.generated_at.desc()).first()
    if latest_report:
        pending_actions = (
            db.query(func.count(VersionDriftEntry.id))
            .filter(
                VersionDriftEntry.comparison_report_id == latest_report.id,
                VersionDriftEntry.action.notin_(["No Action"]),
            )
            .scalar() or 0
        )
    else:
        pending_actions = 0

    # ── 5. Urgent Drift KPI ───────────────────────────────────────────────────
    urgent_drift_count = _compute_urgent_drift_count(db)

    # ── 6. Workload Matrix ────────────────────────────────────────────────────
    workload_matrix = _compute_workload_matrix(db)

    # ── 7. Pipeline Distribution ──────────────────────────────────────────────
    pipeline_dist = _compute_pipeline_distribution(db)

    # ── 8. Upcoming Deployments ───────────────────────────────────────────────
    upcoming = _compute_upcoming_deployments(db)

    # ── 9. UAT Activity ───────────────────────────────────────────────────────
    uat_activity = _compute_uat_activity(db)

    return DashboardSummaryResponse(
        dev_velocity=DevVelocityKPI(active_count=active_dev, completion_pct=completion_pct),
        pending_uat=pending_uat,
        release_pipeline=ReleasePipelineKPI(active_count=active_plan_count, next_deployment_date=next_date),
        infra_health=InfraHealthKPI(
            active_env_count=active_env_count,
            synced_last_24h=synced_last_24h,
            pending_actions=pending_actions,
        ),
        urgent_drift=UrgentDriftKPI(count=urgent_drift_count),
        workload_matrix=workload_matrix,
        pipeline_distribution=pipeline_dist,
        upcoming_deployments=upcoming,
        uat_activity=uat_activity,
    )


def _get_drift_environments(db: Session):
    """Return (dev_env, prod_env) based on order rules."""
    dev_env = (
        db.query(Environment)
        .filter(Environment.category == EnvironmentCategory.DEVELOPMENT, Environment.is_active.is_(True))
        .order_by(Environment.order.desc())
        .first()
    )
    prod_env = (
        db.query(Environment)
        .filter(Environment.category == EnvironmentCategory.PRODUCTION, Environment.is_active.is_(True))
        .order_by(Environment.order.asc())
        .first()
    )
    return dev_env, prod_env


def _compute_urgent_drift_count(db: Session) -> int:
    """Total non-'No Action' drift entries from the latest comparison report."""
    latest_report = (
        db.query(ComparisonReport)
        .order_by(ComparisonReport.generated_at.desc())
        .first()
    )
    if not latest_report:
        return 0
    return (
        db.query(func.count(VersionDriftEntry.id))
        .filter(
            VersionDriftEntry.comparison_report_id == latest_report.id,
            VersionDriftEntry.action.notin_(["No Action"]),
        )
        .scalar() or 0
    )


def _compute_workload_matrix(db: Session) -> List[WorkloadRow]:
    from app.models.control_parameters import RequestType, RequestState

    rows = (
        db.query(
            DevelopmentRequest.assigned_developer_id,
            RequestState.category,
            func.count(DevelopmentRequest.id).label("cnt"),
        )
        .join(RequestType, DevelopmentRequest.request_type_id == RequestType.id)
        .join(RequestState, DevelopmentRequest.request_state_id == RequestState.id)
        .filter(
            RequestType.category == "Development",
            DevelopmentRequest.is_archived.is_(False),
            RequestState.category.in_(["Draft", "In Progress", "Ready", "Done"]),
        )
        .group_by(DevelopmentRequest.assigned_developer_id, RequestState.category)
        .all()
    )

    # Load developer usernames
    from app.models.user import User
    dev_ids = {r.assigned_developer_id for r in rows if r.assigned_developer_id is not None}
    users = {}
    if dev_ids:
        users = {
            u.id: u.username
            for u in db.query(User).filter(User.id.in_(dev_ids)).all()
        }

    # Pivot into per-developer dict
    matrix: Dict[str, Dict[str, int]] = {}
    for row in rows:
        dev_name = users.get(row.assigned_developer_id, "Unassigned") if row.assigned_developer_id else "Unassigned"
        if dev_name not in matrix:
            matrix[dev_name] = {"Draft": 0, "In Progress": 0, "Ready": 0, "Done": 0}
        matrix[dev_name][row.category] = row.cnt

    # Ensure "Unassigned" is always present last
    result = []
    for dev, counts in sorted(matrix.items(), key=lambda x: (x[0] == "Unassigned", x[0])):
        result.append(WorkloadRow(
            developer=dev,
            open=counts.get("Draft", 0),
            in_progress=counts.get("In Progress", 0),
            closed=counts.get("Done", 0),
        ))
    return result


def _compute_pipeline_distribution(db: Session) -> List[PipelineDistributionItem]:
    from app.models.control_parameters import RequestType, RequestState

    rows = (
        db.query(RequestState.category, func.count(DevelopmentRequest.id).label("cnt"))
        .join(RequestType, DevelopmentRequest.request_type_id == RequestType.id)
        .join(RequestState, DevelopmentRequest.request_state_id == RequestState.id)
        .filter(
            RequestType.category == "Development",
            DevelopmentRequest.is_archived.is_(False),
            RequestState.category.in_(["Draft", "In Progress", "Ready", "Done"]),
        )
        .group_by(RequestState.category)
        .all()
    )

    order = ["Draft", "In Progress", "Ready", "Done"]
    counts = {r.category: r.cnt for r in rows}
    return [
        PipelineDistributionItem(category=cat, count=counts.get(cat, 0))
        for cat in order
    ]


def _compute_upcoming_deployments(db: Session) -> List[UpcomingDeployment]:
    plans = (
        db.query(ReleasePlan)
        .filter(ReleasePlan.planned_deployment_date.isnot(None))
        .order_by(ReleasePlan.planned_deployment_date.asc())
        .limit(5)
        .all()
    )
    result = []
    for p in plans:
        target_name = p.target_environment.name if p.target_environment else None
        result.append(UpcomingDeployment(
            id=p.id,
            plan_number=p.plan_number,
            target_env=target_name,
            planned_deployment_date=(
                p.planned_deployment_date.isoformat() if p.planned_deployment_date else None
            ),
        ))
    return result


def _compute_uat_activity(db: Session) -> List[UATActivityItem]:
    rows = (
        db.query(
            func.coalesce(RequestModuleLine.uat_status, "Not Set").label("status"),
            func.count(RequestModuleLine.id).label("cnt"),
        )
        .group_by(func.coalesce(RequestModuleLine.uat_status, "Not Set"))
        .all()
    )
    return [UATActivityItem(status=r.status, count=r.cnt) for r in rows]


# ─── Dashboard Drift Summary ──────────────────────────────────────────────────

def get_version_drift(db: Session) -> DashboardDriftResponse:
    """Return aggregate drift counts from the latest stored report for the dashboard card."""
    latest_report = (
        db.query(ComparisonReport)
        .order_by(ComparisonReport.generated_at.desc())
        .first()
    )
    if not latest_report:
        return DashboardDriftResponse(
            total_drifts=0, upgrades=0, downgrades=0, missing=0, has_report=False
        )

    rows = (
        db.query(VersionDriftEntry.action, func.count(VersionDriftEntry.id).label("cnt"))
        .filter(
            VersionDriftEntry.comparison_report_id == latest_report.id,
            VersionDriftEntry.action.notin_(["No Action"]),
        )
        .group_by(VersionDriftEntry.action)
        .all()
    )
    counts: Dict[str, int] = {r.action: r.cnt for r in rows}
    total = sum(counts.values())
    upgrades = counts.get("Upgrade", 0)
    downgrades = counts.get("Error (Downgrade)", 0)
    missing = counts.get("Missing Module", 0) + counts.get("Error (Missing in Source)", 0)
    nomenclature_errors = counts.get("Error (Version Structure Mismatch)", 0)

    return DashboardDriftResponse(
        total_drifts=total,
        upgrades=upgrades,
        downgrades=downgrades,
        missing=missing,
        nomenclature_errors=nomenclature_errors,
        has_report=True,
    )


# ─── Request Analysis (Tab 3) ──────────────────────────────────────────────────

MACRO_STATE_COLORS: dict[str, str] = {
    "Draft": "#94a3b8",
    "In Progress": "#3b82f6",
    "Ready": "#06b6d4",
    "Done": "#22c55e",
}

PRIORITY_COLORS: dict[str, str] = {
    "Critical": "#ef4444",
    "High": "#f97316",
    "Medium": "#eab308",
    "Low": "#22c55e",
}

MACRO_STATES_ORDER = ["Draft", "In Progress", "Ready", "Done"]

PRIORITIES_ORDER = ["Critical", "High", "Medium", "Low"]


def get_request_analysis(
    db: Session, category_ids: list[int] | None = None
) -> RequestAnalysisResponse:
    from app.models.control_parameters import (
        FunctionalCategory,
        Priority,
        RequestState,
        RequestType,
    )

    all_categories_query = db.query(FunctionalCategory).filter(FunctionalCategory.is_active.is_(True))
    if category_ids:
        all_categories_query = all_categories_query.filter(FunctionalCategory.id.in_(category_ids))
    all_categories = all_categories_query.order_by(FunctionalCategory.display_order.asc()).all()
    categories = [c.name for c in all_categories]

    base_query = (
        db.query(DevelopmentRequest)
        .join(RequestType, DevelopmentRequest.request_type_id == RequestType.id)
        .join(RequestState, DevelopmentRequest.request_state_id == RequestState.id)
        .join(Priority, DevelopmentRequest.priority_id == Priority.id)
        .join(FunctionalCategory, DevelopmentRequest.functional_category_id == FunctionalCategory.id)
        .filter(
            RequestType.category == "Development",
            DevelopmentRequest.is_archived.is_(False),
            RequestState.category.in_(MACRO_STATES_ORDER),
        )
    )

    if category_ids:
        base_query = base_query.filter(FunctionalCategory.id.in_(category_ids))

    rows = (
        base_query.with_entities(
            FunctionalCategory.name.label("category"),
            RequestState.category.label("macro_state"),
            Priority.name.label("priority"),
            func.count(DevelopmentRequest.id).label("count"),
        )
        .group_by(
            FunctionalCategory.name,
            RequestState.category,
            Priority.name,
        )
        .all()
    )

    priorities = (
        db.query(Priority)
        .filter(Priority.is_active.is_(True))
        .order_by(Priority.level.asc())
        .all()
    )
    priority_names = [p.name for p in priorities]

    macro_state_data: dict[str, dict[str, dict[str, int]]] = {
        ms: {cat: {} for cat in categories} for ms in MACRO_STATES_ORDER
    }
    priority_data: dict[str, dict[str, dict[str, int]]] = {
        p: {cat: {} for cat in categories} for p in PRIORITIES_ORDER
    }

    for row in rows:
        macro_state_data[row.macro_state][row.category][row.priority] = row.count
        priority_data[row.priority][row.category][row.priority] = row.count

    def build_priority_breakdown(breakdown_dict: dict[str, int]) -> list[PriorityBreakdownItem]:
        return [
            PriorityBreakdownItem(name=p_name, count=breakdown_dict.get(p_name, 0))
            for p_name in priority_names
        ]

    def build_chart_series(
        series_dict: dict[str, dict[str, dict[str, int]]],
        colors: dict[str, str],
    ) -> list[RadarChartData]:
        result = []
        for name, cat_data in series_dict.items():
            if name not in colors:
                continue
            data_points = [
                RadarDataPoint(
                    category=cat,
                    value=sum(breakdown.values()),
                    priority_breakdown=build_priority_breakdown(breakdown),
                )
                for cat, breakdown in sorted(cat_data.items())
            ]
            result.append(RadarChartData(
                name=name,
                color=colors[name],
                data=data_points,
            ))
        return result

    macro_state_chart = build_chart_series(macro_state_data, MACRO_STATE_COLORS)
    priority_chart = build_chart_series(priority_data, PRIORITY_COLORS)

    functional_category_items = [
        FunctionalCategoryItem(id=c.id, name=c.name)
        for c in all_categories
    ]

    priority_items = [
        PriorityItem(id=p.id, name=p.name, level=p.level)
        for p in priorities
    ]

    return RequestAnalysisResponse(
        macro_state_chart=macro_state_chart,
        priority_chart=priority_chart,
        functional_categories=functional_category_items,
        priorities=priority_items,
    )
