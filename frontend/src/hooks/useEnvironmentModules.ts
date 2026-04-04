import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useMemo } from "react";
import { getEnvironmentModules, type EnvironmentModulesParams, type EnvironmentModulesResponse } from "@/api/environment-modules";

export const environmentModulesKeys = {
  all: ["environment-modules"] as const,
  list: (params: EnvironmentModulesParams) => [...environmentModulesKeys.all, "list", params] as const,
};

export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

export interface SortingState {
  id: string;
  desc: boolean;
}

export function useEnvironmentModules(params: EnvironmentModulesParams) {
  const [pagination, setPagination] = useState({
    pageIndex: params.page ? params.page - 1 : 0,
    pageSize: params.limit || 15,
  });
  
  const [sorting, setSorting] = useState<SortingState[]>([]);
  const [search, setSearch] = useState(params.search || "");
  const [statusFilter, setStatusFilter] = useState(params.status || "");

  const queryParams: EnvironmentModulesParams = useMemo(() => ({
    environment_id: params.environment_id,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    sort_by: sorting.length > 0 ? sorting[0].id : undefined,
    sort_order: sorting.length > 0 ? (sorting[0].desc ? "desc" : "asc") : undefined,
    search: search || undefined,
    status: statusFilter || undefined,
  }), [params.environment_id, pagination, sorting, search, statusFilter]);

  const query = useQuery({
    queryKey: environmentModulesKeys.list(queryParams),
    queryFn: () => getEnvironmentModules(queryParams),
    placeholderData: (previousData) => previousData,
    enabled: !!params.environment_id,
  });

  const handlePaginationChange = useCallback((newState: { pageIndex: number; pageSize: number }) => {
    setPagination({
      pageIndex: newState.pageIndex,
      pageSize: newState.pageSize,
    });
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  }, []);

  const handleSortingChange = useCallback((newSorting: SortingState[]) => {
    setSorting(newSorting);
  }, []);

  return {
    ...query,
    data: query.data as EnvironmentModulesResponse | undefined,
    pagination: query.data?.pagination,
    pageIndex: pagination.pageIndex,
    pageSize: pagination.pageSize,
    onPaginationChange: handlePaginationChange,
    search,
    onSearchChange: handleSearchChange,
    statusFilter,
    onStatusFilterChange: handleStatusFilterChange,
    sorting,
    onSortingChange: handleSortingChange,
  };
}
