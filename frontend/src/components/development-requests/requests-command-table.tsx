/**
 * RequestsCommandTable
 * --------------------
 * High-density, interactive table for Development Requests.
 * Responsibilities:
 *  - Row checkboxes + "select all on page" + "select all N records" banner
 *  - Inline state editing (InlineStateEditor)
 *  - Inline assignee editing (InlineAssigneeEditor)
 *  - Sticky header
 *  - Dense rows with text truncation
 *  - Click-through to detail view (non-interactive cells only)
 */

import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InlineStateEditor } from "@/components/development-requests/inline-state-editor";
import { InlineAssigneeEditor } from "@/components/development-requests/inline-assignee-editor";
import type { DevelopmentRequest, GroupInfo } from "@/api/development-requests";
import type { ControlParameters } from "@/api/development-requests";
import { DrGroupHeader } from "@/components/development-requests/dr-group-header";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPriorityClass(level: number): string {
  if (level >= 4) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  if (level >= 3) return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
  if (level >= 2) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
}

const COLS = 9;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  data: DevelopmentRequest[];
  isLoading: boolean;
  pagination?: {
    total_records: number;
    total_pages: number;
    current_page: number;
    limit: number;
  };
  pageIndex: number;
  pageCount: number;
  onPaginationChange: (state: { pageIndex: number }) => void;

  // Selection
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  totalRecords: number;
  allRecordsSelected: boolean;
  onSelectAllRecords: () => void;
  onClearAllRecords: () => void;

  // Data
  controlParams: ControlParameters | undefined;
  emptyState?: React.ReactNode;

  // Grouping
  groupBy?: string | null;
  groups?: GroupInfo[];
  expandedGroups?: Set<string>;
  onToggleGroup?: (key: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RequestsCommandTable({
  data,
  isLoading,
  pagination,
  pageIndex,
  pageCount,
  onPaginationChange,
  selectedIds,
  onSelectionChange,
  totalRecords,
  allRecordsSelected,
  onSelectAllRecords,
  onClearAllRecords,
  controlParams,
  emptyState,
  groupBy,
  groups,
  expandedGroups,
  onToggleGroup,
}: Props) {
  const navigate = useNavigate();

  const handleNavigateToDetail = useCallback((id: number) => {
    const siblingIds = data.map((item) => item.id);
    navigate(`/development-requests/${id}`, { state: { siblingIds } });
  }, [navigate, data]);

  const allOnPageSelected = data.length > 0 && data.every((r) => selectedIds.has(r.id));
  const someOnPageSelected = data.some((r) => selectedIds.has(r.id)) && !allOnPageSelected;

  const handleSelectPage = useCallback(() => {
    if (allOnPageSelected) {
      const next = new Set(selectedIds);
      data.forEach((r) => next.delete(r.id));
      onSelectionChange(next);
      onClearAllRecords();
    } else {
      const next = new Set(selectedIds);
      data.forEach((r) => next.add(r.id));
      onSelectionChange(next);
    }
  }, [allOnPageSelected, selectedIds, data, onSelectionChange, onClearAllRecords]);

  const handleToggleRow = useCallback((id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
    onClearAllRecords();
  }, [selectedIds, onSelectionChange, onClearAllRecords]);

  const renderRequestRow = useCallback((item: DevelopmentRequest) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <TableRow
        key={`request-row-${item.id}`}
        className={`group transition-colors ${isSelected ? "bg-primary/5" : ""}`}
        data-state={isSelected ? "selected" : undefined}
      >
        <TableCell className="w-10 pr-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => handleToggleRow(item.id)}
            aria-label={`Select ${item.request_number}`}
          />
        </TableCell>
        <TableCell
          className="font-bold text-primary cursor-pointer w-[90px] whitespace-nowrap"
          onClick={() => handleNavigateToDetail(item.id)}
        >
          {item.request_number}
        </TableCell>
        <TableCell className="w-[110px]" onClick={() => handleNavigateToDetail(item.id)}>
          <Badge variant="outline" className="text-xs font-normal truncate max-w-[100px]">
            {item.request_type?.name ?? "—"}
          </Badge>
        </TableCell>
        <TableCell className="w-[150px] whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {controlParams ? (
            <InlineStateEditor
              request={item}
              availableStates={controlParams.request_states}
            />
          ) : (
            <Badge variant="outline">{item.request_state?.name ?? "—"}</Badge>
          )}
        </TableCell>
        <TableCell className="w-[90px]" onClick={() => handleNavigateToDetail(item.id)}>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityClass(item.priority?.level ?? 1)}`}
          >
            {item.priority?.name ?? "—"}
          </span>
        </TableCell>
        <TableCell
          className="w-[120px] text-sm text-muted-foreground"
          onClick={() => handleNavigateToDetail(item.id)}
        >
          <span className="block truncate max-w-[110px]">{item.functional_category?.name ?? "—"}</span>
        </TableCell>
        <TableCell
          className="cursor-pointer min-w-[200px] max-w-[600px]"
          onClick={() => handleNavigateToDetail(item.id)}
        >
          <span className="block text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis" title={item.title}>
            {item.title}
          </span>
        </TableCell>
        <TableCell className="w-[120px]" onClick={(e) => e.stopPropagation()}>
          <InlineAssigneeEditor request={item} />
        </TableCell>
        <TableCell
          className="w-[90px] text-sm text-muted-foreground whitespace-nowrap"
          onClick={() => handleNavigateToDetail(item.id)}
        >
          {item.request_date ? new Date(item.request_date).toLocaleDateString() : "—"}
        </TableCell>
      </TableRow>
    );
  }, [selectedIds, handleNavigateToDetail, controlParams, handleToggleRow]);

  // Get group key from a request based on current group_by
  const getItemGroupKey = useCallback((item: DevelopmentRequest): string => {
    if (!groupBy) return "__ungrouped";

    switch (groupBy) {
      case "state_category":
        return item.request_state?.category ?? "Unknown";
      case "assigned_developer":
        return item.assigned_developer?.username ?? "Unassigned";
      case "priority":
        return item.priority?.name ?? "Unknown";
      case "functional_category":
        return item.functional_category?.name ?? "Unknown";
      default:
        return "__ungrouped";
    }
  }, [groupBy]);

  const tableBodyRows = useMemo(() => {
    if (!groupBy || !groups || !data) {
      // Flat rendering
      return data.map((item) => renderRequestRow(item));
    }

    // Grouped rendering - filter items from main data for each group
    const rows: React.ReactNode[] = [];
    groups.forEach((group) => {
      const isExpanded = expandedGroups?.has(group.key) ?? true;

      // Filter items that belong to this group
      const groupItems = data.filter((item) => getItemGroupKey(item) === group.key);

      // Group header
      rows.push(
        <DrGroupHeader
          key={`header-${group.key}`}
          label={group.label}
          count={group.count}
          isExpanded={isExpanded}
          onToggle={() => onToggleGroup?.(group.key)}
        />
      );

      // Group rows (if expanded)
      if (isExpanded) {
        groupItems.forEach((item) => {
          rows.push(renderRequestRow(item));
        });
      }
    });

    return rows;
  }, [data, groupBy, groups, expandedGroups, getItemGroupKey, renderRequestRow, onToggleGroup]);

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              {Array.from({ length: COLS }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: COLS }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  if (!isLoading && data.length === 0) {
    return (
      <div className="rounded-md border">
        {emptyState ?? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            No results found.
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-2">
      {/* "Select all N records" banner */}
      {allOnPageSelected && !allRecordsSelected && totalRecords > data.length && (
        <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
          <span>All {data.length} items on this page are selected.</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-primary"
            onClick={onSelectAllRecords}
          >
            Select all {totalRecords} matching records
          </Button>
        </div>
      )}
      {allRecordsSelected && (
        <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
          <span>All {totalRecords} matching records are selected.</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-primary"
            onClick={onClearAllRecords}
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-x-auto max-h-[calc(100vh-220px)]">
        <Table className="w-auto min-w-full">
          <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
            <TableRow>
              <TableHead className="w-10 pr-0">
                <Checkbox
                  checked={allOnPageSelected}
                  ref={(el) => {
                    if (el) (el as HTMLInputElement).indeterminate = someOnPageSelected;
                  }}
                  onCheckedChange={handleSelectPage}
                  aria-label="Select all on page"
                />
              </TableHead>
              <TableHead className="w-[90px] font-semibold">ID</TableHead>
              <TableHead className="w-[110px]">Type</TableHead>
              <TableHead className="w-[150px]">State</TableHead>
              <TableHead className="w-[90px]">Priority</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead className="min-w-[200px] font-semibold">Title</TableHead>
              <TableHead className="w-[120px]">Assignee</TableHead>
              <TableHead className="w-[90px]">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{tableBodyRows}</TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {pagination.total_records} total · Page {pagination.current_page} of {pagination.total_pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPaginationChange({ pageIndex: pageIndex - 1 })}
              disabled={pageIndex === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPaginationChange({ pageIndex: pageIndex + 1 })}
              disabled={pageIndex >= pageCount - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
