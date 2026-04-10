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

import { useState, useCallback, useMemo, useEffect } from "react";
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
      return item.request_state?.category ?? "_none";
    case "assigned_developer":
      return item.assigned_developer?.username ?? "_unassigned";
    case "priority":
      return item.priority?.name ?? "_none";
    case "functional_category":
      return item.functional_category?.name ?? "_none";
  }
}

function getGroupDisplayLabel(key: string, groupBy: GroupByOption): string {
  if (groupBy === "assigned_developer" && key === "_unassigned") return "Unassigned";
  if (key === "_none") return "None";
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
  
  // Persist collapsed groups to localStorage
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const stored = localStorage.getItem("dr-collapsed-groups");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Sync to localStorage when changed
  useEffect(() => {
    localStorage.setItem("dr-collapsed-groups", JSON.stringify([...collapsedGroups]));
  }, [collapsedGroups]);

  // Reset collapsed groups when group configuration changes
  useEffect(() => {
    if (!groups?.length) return;
    setCollapsedGroups((prev) => {
      const currentKeys = new Set(groups.map((g) => g.key));
      const filtered = new Set([...prev].filter((k) => currentKeys.has(k)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [groups, groupBy]);

  // Memoized group header computation
  // FIX: Always use groups array (API-provided) with current collapsed state
  const groupHeaders = useMemo(() => {
    if (!groupBy || !groups?.length) {
      return [];
    }

    return groups.map((g) => ({
      key: g.key,
      label: getGroupDisplayLabel(g.key, groupBy),
      count: g.count,
      collapsed: collapsedGroups.has(g.key),
    }));
  }, [groupBy, groups, collapsedGroups]);

  const handleNavigateToDetail = useCallback((id: number) => {
    const siblingIds = data.map((item) => item.id);
    navigate(`/development-requests/${id}`, { state: { siblingIds } });
  }, [navigate, data]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

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

  const COLS = 9; // checkbox + id + type + state + priority + category + title + assignee + date

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
  // Track group rendering to inject headers (fallback if not using memoized)
  // ---------------------------------------------------------------------------

  // Use memoized groupHeaders when available, otherwise compute inline
  const renderTableBody = () => {
    const rows: React.ReactNode[] = [];

    if (groupBy && groupHeaders.length > 0) {
      // Use pre-computed group headers
      let dataIndex = 0;
      for (const header of groupHeaders) {
        // Add group header row
        rows.push(
          <TableRow
            key={`group-${header.key}`}
            className="bg-muted/30 hover:bg-muted/50 cursor-pointer select-none"
            onClick={() => toggleGroup(header.key)}
          >
            <TableCell colSpan={COLS} className="py-2 font-medium text-sm">
              <div className="flex items-center gap-2">
                {header.collapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{header.label}</span>
                <Badge variant="secondary" className="text-xs py-0 px-1.5">
                  {header.count}
                </Badge>
              </div>
            </TableCell>
          </TableRow>
        );

        // Add data rows for this group (if not collapsed)
        if (!header.collapsed) {
          while (dataIndex < data.length && getGroupKeyForItem(data[dataIndex], groupBy) === header.key) {
            rows.push(renderDataRow(data[dataIndex]));
            dataIndex++;
          }
        } else {
          // Skip to next group
          while (dataIndex < data.length && getGroupKeyForItem(data[dataIndex], groupBy) === header.key) {
            dataIndex++;
          }
        }
      }
    } else if (groupBy && groups?.length) {
      // FIX: Use groupHeaders for consistency - ensures same collapsed check everywhere
      let dataIndex = 0;
      for (const group of groups) {
        const header = groupHeaders.find((h) => h.key === group.key);
        const isCollapsed = header?.collapsed ?? collapsedGroups.has(group.key);

        rows.push(
          <TableRow
            key={`group-${group.key}`}
            className="bg-muted/30 hover:bg-muted/50 cursor-pointer select-none"
            onClick={() => toggleGroup(group.key)}
          >
            <TableCell colSpan={COLS} className="py-2 font-medium text-sm">
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{getGroupDisplayLabel(group.key, groupBy)}</span>
                <Badge variant="secondary" className="text-xs py-0 px-1.5">
                  {group.count}
                </Badge>
              </div>
            </TableCell>
          </TableRow>
        );

        // Add data rows for this group (if not collapsed)
        if (!isCollapsed) {
          while (dataIndex < data.length && getGroupKeyForItem(data[dataIndex], groupBy) === group.key) {
            rows.push(renderDataRow(data[dataIndex]));
            dataIndex++;
          }
        } else {
          while (dataIndex < data.length && getGroupKeyForItem(data[dataIndex], groupBy) === group.key) {
            dataIndex++;
          }
        }
      }
    } else {
      // No grouping - just render data rows
      for (const item of data) {
        rows.push(renderDataRow(item));
      }
    }

    return rows;
  };

  // Separate row renderer for cleaner code
  const renderDataRow = (item: DevelopmentRequest): React.ReactNode => {
    const isSelected = selectedIds.has(item.id);

    return (
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
          className="font-bold text-primary cursor-pointer w-[90px] whitespace-nowrap"
          onClick={() => handleNavigateToDetail(item.id)}
        >
          {item.request_number}
        </TableCell>

        {/* Type */}
        <TableCell className="w-[110px]" onClick={() => handleNavigateToDetail(item.id)}>
          <Badge variant="outline" className="text-xs font-normal truncate max-w-[100px]">
            {item.request_type?.name ?? "—"}
          </Badge>
        </TableCell>

        {/* State — inline editor */}
        <TableCell className="w-[150px]" onClick={(e) => e.stopPropagation()}>
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
        <TableCell className="w-[90px]" onClick={() => handleNavigateToDetail(item.id)}>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityClass(item.priority?.level ?? 1)}`}
          >
            {item.priority?.name ?? "—"}
          </span>
        </TableCell>

        {/* Category */}
        <TableCell
          className="w-[120px] text-sm text-muted-foreground"
          onClick={() => handleNavigateToDetail(item.id)}
        >
          <span className="block truncate max-w-[110px]">{item.functional_category?.name ?? "—"}</span>
        </TableCell>

        {/* Title — wraps to 2 lines so the full track is readable at a glance */}
        <TableCell
          className="cursor-pointer min-w-[180px]"
          onClick={() => handleNavigateToDetail(item.id)}
        >
          <span className="block text-sm font-medium line-clamp-2 break-words leading-snug" title={item.title}>
            {item.title}
          </span>
        </TableCell>

        {/* Assignee — inline editor */}
        <TableCell className="w-[120px]" onClick={(e) => e.stopPropagation()}>
          <InlineAssigneeEditor request={item} />
        </TableCell>

        {/* Date */}
        <TableCell
          className="w-[90px] text-sm text-muted-foreground whitespace-nowrap"
          onClick={() => handleNavigateToDetail(item.id)}
        >
          {item.request_date
            ? new Date(item.request_date).toLocaleDateString()
            : "—"}
        </TableCell>
      </TableRow>
    );
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
      <div className="rounded-md border overflow-auto max-h-[calc(100vh-220px)]">
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
              <TableHead className="w-[90px] font-semibold">ID</TableHead>
              <TableHead className="w-[110px]">Type</TableHead>
              <TableHead className="w-[150px]">State</TableHead>
              <TableHead className="w-[90px]">Priority</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead className="min-w-[180px]">Title</TableHead>
              <TableHead className="w-[120px]">Assignee</TableHead>
              <TableHead className="w-[90px]">Date</TableHead>
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
