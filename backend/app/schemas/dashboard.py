from typing import List, Optional
from pydantic import BaseModel


# ─── Tab 1: Command Center ────────────────────────────────────────────────────

class DevVelocityKPI(BaseModel):
    active_count: int
    completion_pct: float


class ReleasePipelineKPI(BaseModel):
    active_count: int
    next_deployment_date: Optional[str]


class InfraHealthKPI(BaseModel):
    active_env_count: int
    synced_last_24h: int
    pending_actions: int


class UrgentDriftKPI(BaseModel):
    count: int


class WorkloadRow(BaseModel):
    developer: str
    open: int
    in_progress: int
    closed: int


class PipelineDistributionItem(BaseModel):
    category: str
    count: int


class UpcomingDeployment(BaseModel):
    id: int
    plan_number: str
    target_env: Optional[str]
    planned_deployment_date: Optional[str]


class UATActivityItem(BaseModel):
    status: str
    count: int


class DashboardSummaryResponse(BaseModel):
    dev_velocity: DevVelocityKPI
    pending_uat: int
    release_pipeline: ReleasePipelineKPI
    infra_health: InfraHealthKPI
    urgent_drift: UrgentDriftKPI
    workload_matrix: List[WorkloadRow]
    pipeline_distribution: List[PipelineDistributionItem]
    upcoming_deployments: List[UpcomingDeployment]
    uat_activity: List[UATActivityItem]


# ─── Dashboard Drift Summary ──────────────────────────────────────────────────

class DashboardDriftResponse(BaseModel):
    """Summary counts surfaced on the dashboard, linking out to the full drift report."""
    total_drifts: int
    upgrades: int
    downgrades: int
    missing: int
    has_report: bool  # False if no report has been generated yet


# ─── Tab 3: Request Analysis (Radar Charts) ──────────────────────────────────

class PriorityBreakdownItem(BaseModel):
    name: str
    count: int


class RadarDataPoint(BaseModel):
    category: str
    value: int
    priority_breakdown: list[PriorityBreakdownItem]


class RadarChartData(BaseModel):
    name: str
    color: str
    data: list[RadarDataPoint]


class FunctionalCategoryItem(BaseModel):
    id: int
    name: str


class PriorityItem(BaseModel):
    id: int
    name: str
    level: int


class RequestAnalysisResponse(BaseModel):
    macro_state_chart: list[RadarChartData]
    priority_chart: list[RadarChartData]
    functional_categories: list[FunctionalCategoryItem]
    priorities: list[PriorityItem]
