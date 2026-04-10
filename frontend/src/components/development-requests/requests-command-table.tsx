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

import { Fragment, useState, useCallback, useMemo, useEffect } from "react";
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

const COLS = 9;

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

  const activeCollapsedGroups = useMemo(() => {
    if (!groupBy || !groups?.length) {
      return collapsedGroups;
    }

    const currentKeys = new Set(groups.map((group) => group.key));
    return new Set([...collapsedGroups].filter((key) => currentKeys.has(key)));
  }, [collapsedGroups, groupBy, groups]);

  // Sync to localStorage when changed
  useEffect(() => {
    localStorage.setItem("dr-collapsed-groups", JSON.stringify([...activeCollapsedGroups]));
  }, [activeCollapsedGroups]);

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

  const groupedSections = useMemo(() => {
    if (!groupBy) {
      return [];
    }

    const rowsByGroup = new Map<string, DevelopmentRequest[]>();
    for (const item of data) {
      const key = getGroupKeyForItem(item, groupBy);
      const existingRows = rowsByGroup.get(key);
      if (existingRows) {
        existingRows.push(item);
      } else {
        rowsByGroup.set(key, [item]);
      }
    }

    if (groups?.length) {
      return groups.map((group) => ({
        key: group.key,
        label: getGroupDisplayLabel(group.key, groupBy),
        count: group.count,
        collapsed: activeCollapsedGroups.has(group.key),
        items: rowsByGroup.get(group.key) ?? [],
      }));
    }

    return Array.from(rowsByGroup.entries()).map(([key, groupItems]) => ({
      key,
      label: getGroupDisplayLabel(key, groupBy),
      count: groupItems.length,
      collapsed: activeCollapsedGroups.has(key),
      items: groupItems,
    }));
  }, [groupBy, groups, data, activeCollapsedGroups]);

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
          className="cursor-pointer min-w-[180px]"
          onClick={() => handleNavigateToDetail(item.id)}
        >
          <span className="block text-sm font-medium line-clamp-2 break-words leading-snug" title={item.title}>
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

  const tableBodyRows = useMemo(() => {
    if (!groupBy) {
      return data.map((item) => renderRequestRow(item));
    }

    return groupedSections.map((section) => (
      <Fragment key={`group-section-${section.key}`}>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={COLS} className="p-0">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              onClick={() => toggleGroup(section.key)}
              aria-expanded={!section.collapsed}
            >
              {section.collapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{section.label}</span>
              <Badge variant="secondary" className="text-xs py-0 px-1.5">
                {section.count}
              </Badge>
            </button>
          </TableCell>
        </TableRow>
        {!section.collapsed && section.items.map((item) => (
          <Fragment key={`group-row-${section.key}-${item.id}`}>
            {renderRequestRow(item)}
          </Fragment>
        ))}
      </Fragment>
    ));
  }, [groupBy, data, groupedSections, renderRequestRow, toggleGroup]);

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
