import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Archive, SearchX, RefreshCw, ServerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useDevelopmentRequests,
  useControlParameters,
} from "@/hooks/useDevelopmentRequests";
import { developmentRequestsApi } from "@/api/development-requests";
import type { DevelopmentRequestFilters, QueryState } from "@/api/development-requests";
import { useAssignableUsers } from "@/hooks/useUsers";
import { useAuthStore } from "@/store/auth-store";
import { QueryBar } from "@/components/development-requests/query-bar";
import { SavedViewsSelector } from "@/components/development-requests/saved-views-selector";
import { BulkActionsToolbar } from "@/components/development-requests/bulk-actions-toolbar";
import { RequestsCommandTable } from "@/components/development-requests/requests-command-table";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const DEFAULT_QUERY_STATE: QueryState = {
  filters: [],
  search: "",
  show_archived: false,
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function DevelopmentRequestsListPage() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore(
    (s) => s.user?.roles?.some((r) => r.permissions?.includes("system:manage")) ?? false,
  );
  const canSaveViews = useAuthStore(
    (s) =>
      s.user?.roles?.some((r) =>
        ["dev_request:update", "dev_request:create", "dev_request:state_change"].some(
          (p) => r.permissions?.includes(p)
        )
      ) ?? false,
  );

  // ── Query / view state ────────────────────────────────────────────────────
  const [queryState, setQueryState] = useState<QueryState>(DEFAULT_QUERY_STATE);
  const [activeViewId, setActiveViewId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [allRecordsSelected, setAllRecordsSelected] = useState(false);

  // ── Derived API filters ───────────────────────────────────────────────────
  const apiFilters = useMemo<DevelopmentRequestFilters>(() => {
    const filtersMap: Record<string, string> = {};
    queryState.filters.forEach((token) => {
      filtersMap[token.field] = token.ids.join(",");
    });
    return {
      ...filtersMap,
      search: queryState.search || undefined,
      is_archived: queryState.show_archived ? undefined : false,
    };
  }, [queryState]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data, isLoading, error, refetch } = useDevelopmentRequests(apiFilters, page, PAGE_SIZE);
  const { data: controlParams } = useControlParameters();
  const { data: assignableUsers = [] } = useAssignableUsers();

  // ── Query state change: reset pagination + selection ─────────────────────
  const handleQueryChange = useCallback((qs: QueryState) => {
    setQueryState(qs);
    setPage(1);
    setSelectedIds(new Set());
    setAllRecordsSelected(false);
  }, []);

  // ── "Select all N records" ────────────────────────────────────────────────
  const handleSelectAllRecords = useCallback(async () => {
    try {
      const result = await developmentRequestsApi.getAllIds(apiFilters);
      setSelectedIds(new Set(result.ids));
      setAllRecordsSelected(true);
    } catch {
      // toast handled by API layer
    }
  }, [apiFilters]);

  const handleClearAllRecords = useCallback(() => {
    setAllRecordsSelected(false);
  }, []);

  // ── Saved view selection ──────────────────────────────────────────────────
  const handleViewSelect = useCallback((qs: QueryState, viewId: number | null) => {
    setActiveViewId(viewId);
    handleQueryChange(qs);
  }, [handleQueryChange]);

  // ── Empty states ──────────────────────────────────────────────────────────
  const isNetworkError = error && (error as Error).message === "Network Error";
  const hasActiveFilters = queryState.filters.length > 0 || !!queryState.search;

  const emptyState = isNetworkError ? (
    <div className="flex flex-col items-center justify-center p-12">
      <ServerOff className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">Cannot connect to server</h3>
      <p className="text-muted-foreground text-center mb-4">
        Unable to reach the API server. Please check your connection and try again.
      </p>
      <Button onClick={() => refetch()} variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  ) : error ? (
    <div className="flex flex-col items-center justify-center p-12">
      <ServerOff className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold mb-2">Error loading requests</h3>
      <p className="text-muted-foreground text-center mb-4">{(error as Error).message}</p>
      <Button onClick={() => refetch()} variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  ) : hasActiveFilters ? (
    <div className="flex flex-col items-center justify-center p-12">
      <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No requests found</h3>
      <p className="text-muted-foreground text-center mb-4">
        No requests match your current filters.
      </p>
      <Button variant="outline" onClick={() => handleQueryChange(DEFAULT_QUERY_STATE)}>
        Clear Filters
      </Button>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center p-12">
      <Archive className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No development requests</h3>
      <p className="text-muted-foreground text-center mb-4">
        Get started by creating your first development request.
      </p>
      {isAdmin && (
        <Button onClick={() => navigate("/development-requests/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Request
        </Button>
      )}
    </div>
  );

  // ── Pagination ────────────────────────────────────────────────────────────
  const pagination = data
    ? {
        total_records: data.total,
        total_pages: data.pages,
        current_page: data.page,
        limit: PAGE_SIZE,
      }
    : undefined;

  // ── Selected row objects (for permission checks in BulkActionsToolbar) ────
  const selectedRows = useMemo(
    () => (data?.items ?? []).filter((r) => selectedIds.has(r.id)),
    [data, selectedIds]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SavedViewsSelector
          currentQueryState={queryState}
          activeViewId={activeViewId}
          onViewSelect={handleViewSelect}
          canSave={canSaveViews}
        />
        {isAdmin && (
          <Button onClick={() => navigate("/development-requests/new")} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        )}
      </div>

      {/* ── Query Bar ── */}
      <QueryBar
        queryState={queryState}
        controlParams={controlParams}
        assignableUsers={assignableUsers}
        onChange={handleQueryChange}
      />

      {/* ── Bulk Actions Toolbar (visible when rows are selected) ── */}
      {selectedIds.size > 0 && (
        <BulkActionsToolbar
          selectedIds={Array.from(selectedIds)}
          selectedRows={selectedRows}
          onClearSelection={() => {
            setSelectedIds(new Set());
            setAllRecordsSelected(false);
          }}
        />
      )}

      {/* ── Command Table ── */}
      <RequestsCommandTable
        data={data?.items ?? []}
        isLoading={isLoading}
        pagination={pagination}
        pageIndex={page - 1}
        pageCount={data?.pages ?? 0}
        onPaginationChange={({ pageIndex }) => {
          setPage(pageIndex + 1);
          setSelectedIds(new Set());
          setAllRecordsSelected(false);
        }}
        selectedIds={selectedIds}
        onSelectionChange={(ids) => {
          setSelectedIds(ids);
          if (ids.size < (data?.total ?? 0)) setAllRecordsSelected(false);
        }}
        totalRecords={data?.total ?? 0}
        allRecordsSelected={allRecordsSelected}
        onSelectAllRecords={handleSelectAllRecords}
        onClearAllRecords={handleClearAllRecords}
        controlParams={controlParams}
        emptyState={emptyState}
      />
    </div>
  );
}
