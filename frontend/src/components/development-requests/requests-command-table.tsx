/**
 * RequestsCommandTable
 * --------------------
 * High-density, interactive table for Development Requests.
 * Responsibilities:
 *  - Row checkboxes + "select all on page" + "select all N records" banner
 *  - Group-by header rows (collapsible) injected between sorted items
 *  - Inline state editing (InlineStateEditor)
 *  - Inline assignee editing (InlineAssigneeEditor)
 *  - Sticky header
 *  - Dense rows with text truncation
 *  - Click-through to detail view (non-interactive cells only)
 */

import { useState, useCallback } from "react";
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
import type {
  DevelopmentRequest,
  GroupInfo,
  GroupByOption,
} from "@/api/development-requests";
import type { ControlParameters } from "@/api/development-requests";
import { ChevronRight, ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPriorityClass(level: number): string {
  if (level >= 4) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  if (level >= 3) return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
  if (level >= 2) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
}

function getGroupKeyForItem(item: DevelopmentRequest, groupBy: GroupByOption): string {
  switch (groupBy) {
    case "state_category":
      return item.request_state?.category ?? "";
    case "assigned_developer":
      return item.assigned_developer?.username ?? "_unassigned";
    case "priority":
      return item.priority?.name ?? "";
    case "functional_category":
      return item.functional_category?.name ?? "";
  }
}

function getGroupDisplayLabel(key: string, groupBy: GroupByOption): string {
  if (groupBy === "assigned_developer" && key === "_unassigned") return "Unassigned";
  return key;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  data: DevelopmentRequest[];
  groups?: GroupInfo[];
  groupBy?: GroupByOption | null;
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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RequestsCommandTable({
  data,
  groups,
  groupBy,
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
}: Props) {
  const navigate = useNavigate();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const allOnPageSelected = data.length > 0 && data.every((r) => selectedIds.has(r.id));
  const someOnPageSelected = data.some((r) => selectedIds.has(r.id)) && !allOnPageSelected;

  const handleSelectPage = () => {
    if (allOnPageSelected) {
      // Deselect this page
      const next = new Set(selectedIds);
      data.forEach((r) => next.delete(r.id));
      onSelectionChange(next);
      onClearAllRecords();
    } else {
      const next = new Set(selectedIds);
      data.forEach((r) => next.add(r.id));
      onSelectionChange(next);
    }
  };

  const handleToggleRow = (id: number) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
    onClearAllRecords();
  };

  const COLS = 9; // checkbox + id + type + state + priority + category + title + assignee + date

  // ---------------------------------------------------------------------------
  // Build rows with optional group headers injected
  // ---------------------------------------------------------------------------
  const buildRows = () => {
    if (!groupBy || !data.length) return data;
    return data; // group headers injected in JSX below
  };

  buildRows(); // keep linter happy

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
  // Track group rendering to inject headers
  // ---------------------------------------------------------------------------
  let lastGroupKey: string | null = null;

  const renderTableBody = () => {
    const rows: React.ReactNode[] = [];

    data.forEach((item) => {
      // Group header injection
      if (groupBy) {
        const key = getGroupKeyForItem(item, groupBy);
        if (key !== lastGroupKey) {
          lastGroupKey = key;
          const groupInfo = groups?.find((g) => g.key === key);
          const count = groupInfo?.count ?? data.filter((r) => getGroupKeyForItem(r, groupBy) === key).length;
          const collapsed = collapsedGroups.has(key);

          rows.push(
            <TableRow
              key={`group-${key}`}
              className="bg-muted/30 hover:bg-muted/50 cursor-pointer select-none"
              onClick={() => toggleGroup(key)}
            >
              <TableCell colSpan={COLS} className="py-2 font-medium text-sm">
                <div className="flex items-center gap-2">
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{getGroupDisplayLabel(key, groupBy)}</span>
                  <Badge variant="secondary" className="text-xs py-0 px-1.5">
                    {count}
                  </Badge>
                </div>
              </TableCell>
            </TableRow>
          );
        }

        if (collapsedGroups.has(lastGroupKey ?? "")) return;
      }

      const isSelected = selectedIds.has(item.id);

      rows.push(
        <TableRow
          key={item.id}
          className={`group transition-colors ${isSelected ? "bg-primary/5" : ""}`}
          data-state={isSelected ? "selected" : undefined}
        >
          {/* Checkbox */}
          <TableCell className="w-10 pr-0" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => handleToggleRow(item.id)}
              aria-label={`Select ${item.request_number}`}
            />
          </TableCell>

          {/* Request Number — clickable link to detail */}
          <TableCell
            className="font-bold text-primary cursor-pointer w-[100px] whitespace-nowrap"
            onClick={() => navigate(`/development-requests/${item.id}`)}
          >
            {item.request_number}
          </TableCell>

          {/* Type */}
          <TableCell className="w-[130px]" onClick={() => navigate(`/development-requests/${item.id}`)}>
            <Badge variant="outline" className="text-xs font-normal truncate max-w-[120px]">
              {item.request_type?.name ?? "—"}
            </Badge>
          </TableCell>

          {/* State — inline editor */}
          <TableCell className="w-[160px]" onClick={(e) => e.stopPropagation()}>
            {controlParams ? (
              <InlineStateEditor
                request={item}
                availableStates={controlParams.request_states}
              />
            ) : (
              <Badge variant="outline">{item.request_state?.name ?? "—"}</Badge>
            )}
          </TableCell>

          {/* Priority */}
          <TableCell className="w-[110px]" onClick={() => navigate(`/development-requests/${item.id}`)}>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityClass(item.priority?.level ?? 1)}`}
            >
              {item.priority?.name ?? "—"}
            </span>
          </TableCell>

          {/* Category */}
          <TableCell
            className="w-[130px] text-sm text-muted-foreground truncate max-w-[130px]"
            onClick={() => navigate(`/development-requests/${item.id}`)}
          >
            {item.functional_category?.name ?? "—"}
          </TableCell>

          {/* Title */}
          <TableCell
            className="cursor-pointer"
            onClick={() => navigate(`/development-requests/${item.id}`)}
          >
            <span className="block max-w-[240px] truncate text-sm font-medium" title={item.title}>
              {item.title}
            </span>
          </TableCell>

          {/* Assignee — inline editor */}
          <TableCell className="w-[130px]" onClick={(e) => e.stopPropagation()}>
            <InlineAssigneeEditor request={item} />
          </TableCell>

          {/* Date */}
          <TableCell
            className="w-[100px] text-sm text-muted-foreground whitespace-nowrap"
            onClick={() => navigate(`/development-requests/${item.id}`)}
          >
            {item.request_date
              ? new Date(item.request_date).toLocaleDateString()
              : "—"}
          </TableCell>
        </TableRow>
      );
    });

    return rows;
  };

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
      <div className="rounded-md border overflow-auto max-h-[calc(100vh-300px)]">
        <Table>
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
              <TableHead className="w-[100px] font-semibold">ID</TableHead>
              <TableHead className="w-[130px]">Type</TableHead>
              <TableHead className="w-[160px]">State</TableHead>
              <TableHead className="w-[110px]">Priority</TableHead>
              <TableHead className="w-[130px]">Category</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[130px]">Assignee</TableHead>
              <TableHead className="w-[100px]">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderTableBody()}</TableBody>
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
