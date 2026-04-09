import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DevVelocityKPI {
  active_count: number;
  completion_pct: number;
}

export interface ReleasePipelineKPI {
  active_count: number;
  next_deployment_date: string | null;
}

export interface InfraHealthKPI {
  active_env_count: number;
  synced_last_24h: number;
  pending_actions: number;
}

export interface UrgentDriftKPI {
  count: number;
}

export interface WorkloadRow {
  developer: string;
  open: number;
  in_progress: number;
  closed: number;
}

export interface PipelineDistributionItem {
  category: string;
  count: number;
}

export interface UpcomingDeployment {
  id: number;
  plan_number: string;
  target_env: string | null;
  planned_deployment_date: string | null;
}

export interface UATActivityItem {
  status: string;
  count: number;
}

export interface DashboardSummaryResponse {
  dev_velocity: DevVelocityKPI;
  pending_uat: number;
  release_pipeline: ReleasePipelineKPI;
  infra_health: InfraHealthKPI;
  urgent_drift: UrgentDriftKPI;
  workload_matrix: WorkloadRow[];
  pipeline_distribution: PipelineDistributionItem[];
  upcoming_deployments: UpcomingDeployment[];
  uat_activity: UATActivityItem[];
}

export interface DashboardDriftResponse {
  total_drifts: number;
  upgrades: number;
  downgrades: number;
  missing: number;
  nomenclature_errors: number;
  has_report: boolean;
}

export interface PriorityBreakdownItem {
  name: string;
  count: number;
}

export interface RadarDataPoint {
  category: string;
  value: number;
  priority_breakdown: PriorityBreakdownItem[];
}

export interface RadarChartData {
  name: string;
  color: string;
  data: RadarDataPoint[];
}

export interface FunctionalCategoryItem {
  id: number;
  name: string;
}

export interface PriorityItem {
  id: number;
  name: string;
  level: number;
}

export interface RequestAnalysisResponse {
  macro_state_chart: RadarChartData[];
  priority_chart: RadarChartData[];
  functional_categories: FunctionalCategoryItem[];
  priorities: PriorityItem[];
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getSummary: (): Promise<DashboardSummaryResponse> =>
    api.get("/dashboard/summary").then((r) => r.data),

  getVersionDrift: (): Promise<DashboardDriftResponse> =>
    api.get("/dashboard/version-drift").then((r) => r.data),

  getRequestAnalysis: (categoryIds?: number[]): Promise<RequestAnalysisResponse> => {
    const params = categoryIds?.length
      ? { category_ids: categoryIds.join(",") }
      : {};
    return api.get("/dashboard/request-analysis", { params }).then((r) => r.data);
  },
};
