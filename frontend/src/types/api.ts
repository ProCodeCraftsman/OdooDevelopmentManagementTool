export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  roles: RoleBrief[];
}

export interface RoleBrief {
  id: number;
  name: string;
  priority: number;
  permissions: string[];
}

export interface TokenRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserCreate {
  username: string;
  email: string;
  password: string;
  role_id?: number | null;
}

export const ENVIRONMENT_CATEGORIES = ["Development", "Staging", "Production"] as const;
export type EnvironmentCategory = (typeof ENVIRONMENT_CATEGORIES)[number];

export interface EnvironmentCreate {
  name: string;
  url: string;
  db_name: string;
  user: string;
  password: string;
  order?: number;
  category?: EnvironmentCategory;
}

export interface EnvironmentUpdate {
  url?: string;
  db_name?: string;
  user?: string;
  password?: string;
  order?: number;
  category?: EnvironmentCategory;
  is_active?: boolean;
}

export interface EnvironmentResponse {
  id: number;
  name: string;
  url: string;
  db_name: string;
  user: string;
  order: number;
  category: EnvironmentCategory;
  is_active: boolean;
}

export interface EnvironmentList {
  id: number;
  name: string;
  url: string;
  order: number;
  category: EnvironmentCategory;
  is_active: boolean;
  last_sync?: string | null;
}

export interface PaginationInfo {
  total_records: number;
  total_pages: number;
  current_page: number;
  limit: number;
}

export interface EnvironmentModuleRecord {
  id: number;
  technical_name: string;
  module_name: string | null;
  installed_version: string | null;
  dependency_versions: Record<string, string> | null;
  state: string | null;
  last_sync: string | null;
}

export interface ModuleDependencyRecord {
  id: number;
  module_technical_name: string;
  module_name: string | null;
  module_version: string | null;
  module_state: string | null;
  dependency_name: string;
  dependency_version: string | null;
  dependency_state: string | null;
  last_sync: string;
}

export interface EnvironmentFilterOptions {
  module_names: string[];
  module_states: string[];
  module_versions: string[];
  dep_names: string[];
  dep_versions: string[];
  dep_states: string[];
}

export interface SyncJobResponse {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress_percent: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

export interface ModuleVersion {
  module_name: string;
  shortdesc?: string;
  version_string: string;
  version_major?: number;
  version_minor?: number;
  version_patch?: number;
  version_build?: number;
  state?: string;
}

export interface ComparisonRow {
  technical_name: string;
  module_name?: string;
  versions: Record<string, VersionInfo>;
  action?: string;
}

export interface VersionInfo {
  version_string: string;
  state: string;
  version_major?: number;
  version_minor?: number;
  version_patch?: number;
  version_build?: number;
  last_sync?: string;
}

export interface ComparisonReport {
  environments: string[];
  environment_orders: Record<string, number>;
  rows: ComparisonRow[];
  summary: {
    total_modules: number;
    environments: number;
  };
}

// ─── Async report types ───────────────────────────────────────────────────────

export interface ReportVersionCell {
  version: string;
  state: string;
  last_sync?: string | null;
}

/** action_counts keys: "Upgrade" | "Error (Downgrade)" | "Missing Module" | "Error (Missing in Source)" | "No Action" */
export type ActionCountsMap = Record<string, number>;

export interface ReportRowResponse {
  id: number;
  technical_name: string;
  module_name?: string | null;
  version_data?: Record<string, ReportVersionCell> | null;
  action_counts?: ActionCountsMap | null;
}

export interface ReportMetadataResponse {
  id: number;
  last_generated_at: string | null;
  is_generating: boolean;
}

export interface PaginatedReportResponse {
  data: ReportRowResponse[];
  pagination: PaginationInfo;
}

export interface GenerateReportResponse {
  message: string;
  rows_generated: number;
  drift_entries_generated: number;
}

export interface ComparisonFilterOptions {
  technical_name_options: string[];
}

// ─── Version Drift Entry types ────────────────────────────────────────────────

export interface VersionDriftEntry {
  id: number;
  technical_name: string;
  module_name?: string | null;
  source_env: string;
  source_version?: string | null;
  dest_env: string;
  dest_version?: string | null;
  /** Categorical: "Upgrade" | "Error (Downgrade)" | "No Action" | "Missing Module" | "Error (Missing in Source)" */
  action: string;
  /** Specific env name that is missing — used for display in the hybrid approach */
  missing_env?: string | null;
}

export interface DriftSummaryCounts {
  total: number;
  upgrades: number;
  downgrades: number;
  missing: number;
}

export interface PaginatedDriftResponse {
  data: VersionDriftEntry[];
  pagination: PaginationInfo;
  summary: DriftSummaryCounts;
}

export interface DriftFilterOptions {
  action_options: string[];
}
