export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  role_id?: number | null;
  role?: RoleBrief | null;
}

export interface RoleBrief {
  id: number;
  name: string;
  priority: number;
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
  is_admin?: boolean;
}

export interface EnvironmentCreate {
  name: string;
  url: string;
  db_name: string;
  user: string;
  password: string;
  order?: number;
  category?: string;
}

export interface EnvironmentUpdate {
  url?: string;
  db_name?: string;
  user?: string;
  password?: string;
  order?: number;
  category?: string;
  is_active?: boolean;
}

export interface EnvironmentResponse {
  id: number;
  name: string;
  url: string;
  db_name: string;
  user: string;
  order: number;
  category: string;
  is_active: boolean;
}

export interface EnvironmentList {
  id: number;
  name: string;
  order: number;
  category: string;
  is_active: boolean;
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
