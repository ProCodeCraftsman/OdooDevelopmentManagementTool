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
  has_report: boolean;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getSummary: (): Promise<DashboardSummaryResponse> =>
    api.get("/dashboard/summary").then((r) => r.data),

  getVersionDrift: (): Promise<DashboardDriftResponse> =>
    api.get("/dashboard/version-drift").then((r) => r.data),
};
