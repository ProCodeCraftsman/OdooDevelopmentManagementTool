import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useMemo } from "react";
import { getModuleMasterList, type ModuleMasterParams, type ModuleMasterResponse } from "@/api/module-master";

export const moduleMasterKeys = {
  all: ["module-master"] as const,
  list: (params: ModuleMasterParams) => [...moduleMasterKeys.all, "list", params] as const,
};

export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

export interface SortingState {
  id: string;
  desc: boolean;
}

export function useModuleMaster(params: ModuleMasterParams = {}) {
  const [pagination, setPagination] = useState({
    pageIndex: params.page ? params.page - 1 : 0,
    pageSize: params.limit || 15,
  });
  
  const [sorting, setSorting] = useState<SortingState[]>([]);
  const [search, setSearch] = useState(params.search || "");

  const queryParams: ModuleMasterParams = useMemo(() => ({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    sort_by: sorting.length > 0 ? sorting[0].id : undefined,
    sort_order: sorting.length > 0 ? (sorting[0].desc ? "desc" : "asc") : undefined,
    search: search || undefined,
  }), [pagination, sorting, search]);

  const query = useQuery({
    queryKey: moduleMasterKeys.list(queryParams),
    queryFn: () => getModuleMasterList(queryParams),
    placeholderData: (previousData) => previousData,
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

  const handleSortingChange = useCallback((newSorting: SortingState[]) => {
    setSorting(newSorting);
  }, []);

  return {
    ...query,
    data: query.data as ModuleMasterResponse | undefined,
    pagination: query.data?.pagination,
    pageIndex: pagination.pageIndex,
    pageSize: pagination.pageSize,
    onPaginationChange: handlePaginationChange,
    search,
    onSearchChange: handleSearchChange,
    sorting,
    onSortingChange: handleSortingChange,
  };
}
