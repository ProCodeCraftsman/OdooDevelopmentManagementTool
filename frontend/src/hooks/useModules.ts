import { useQuery } from "@tanstack/react-query";
import { searchModules, getModuleDevVersions } from "@/api/modules";

export function useModuleSearch(query: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["modules", "search", query],
    queryFn: () => searchModules(query),
    enabled: enabled && query.length > 0,
    staleTime: 30000,
  });
}

export function useModuleDevVersions(moduleName: string) {
  return useQuery({
    queryKey: ["modules", "dev-versions", moduleName],
    queryFn: () => getModuleDevVersions(moduleName),
    enabled: !!moduleName,
  });
}
