import { api } from "@/lib/api";

export interface ModuleSearchResult {
  id: number;
  name: string;
  shortdesc: string | null;
}

export interface ModuleDevVersionsResponse {
  module_name: string;
  versions: string[];
}

export async function searchModules(query: string): Promise<ModuleSearchResult[]> {
  const response = await api.get<ModuleSearchResult[]>(
    `/modules/master/search/?q=${encodeURIComponent(query)}`
  );
  return response.data;
}

export async function getModuleDevVersions(
  moduleName: string
): Promise<ModuleDevVersionsResponse> {
  const response = await api.get<ModuleDevVersionsResponse>(
    `/modules/master/${encodeURIComponent(moduleName)}/dev-versions/`
  );
  return response.data;
}
