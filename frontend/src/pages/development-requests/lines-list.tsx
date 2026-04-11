import { useState, useCallback, useMemo, useEffect } from "react";
import { useDevelopmentRequestLines } from "@/hooks/useDevelopmentRequests";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RequestModuleLineWithRequest, DevelopmentRequestLineFilters } from "@/api/development-requests";
import { Download, SearchX, Archive, X, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp } from "lucide-react";
import { toast } from "sonner";
import { developmentRequestsApi } from "@/api/development-requests";
import { DrLinesQueryBar } from "@/components/development-requests/dr-lines-query-bar";
import { DrGroupHeader } from "@/components/development-requests/dr-group-header";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: DevelopmentRequestLineFilters = {
  module_names: undefined,
  uat_statuses: undefined,
  search: undefined,
};

const UAT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const COLS = 8;

// Group by options
const GROUP_BY_OPTIONS: { value: DevelopmentRequestLineFilters["group_by"]; label: string }[] = [
  { value: undefined, label: "None" },
  { value: "request_type", label: "Type" },
  { value: "request_state", label: "State" },
  { value: "functional_category", label: "Category" },
  { value: "priority", label: "Priority" },
  { value: "assigned_developer", label: "Assignee" },
  { value: "module", label: "Module" },
  { value: "uat_status", label: "UAT Status" },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function DevelopmentRequestLinesPage() {
  const [filters, setFilters] = useState<DevelopmentRequestLineFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Group by state
  const [groupBy, setGroupBy] = useState<DevelopmentRequestLineFilters["group_by"]>(undefined);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [allRecordsSelected, setAllRecordsSelected] = useState(false);

  // Export loading
  const [isExporting, setIsExporting] = useState(false);

  const apiFilters = useMemo<DevelopmentRequestLineFilters>(() => ({
    module_names: filters.module_names,
    uat_statuses: filters.uat_statuses,
    search: filters.search || undefined,
    group_by: groupBy || undefined,
  }), [filters, groupBy]);

  const { data, isLoading } = useDevelopmentRequestLines(apiFilters, page, pageSize);

  const items = useMemo(() => data?.items ?? [], [data]);
  const totalRecords = data?.total ?? 0;

  // ---------------------------------------------------------------------------
  // Filter / page change
  // ---------------------------------------------------------------------------

  const handleFilterChange = useCallback((newFilters: DevelopmentRequestLineFilters) => {
    setFilters(newFilters);
    setPage(1);
    setSelectedIds(new Set());
    setAllRecordsSelected(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Selection handlers
  // ---------------------------------------------------------------------------

  const allOnPageSelected = items.length > 0 && items.every((r) => selectedIds.has(r.id));
  const someOnPageSelected = items.some((r) => selectedIds.has(r.id)) && !allOnPageSelected;

  const handleSelectPage = useCallback(() => {
    if (allOnPageSelected) {
      const next = new Set(selectedIds);
      items.forEach((r) => next.delete(r.id));
      setSelectedIds(next);
      setAllRecordsSelected(false);
    } else {
      const next = new Set(selectedIds);
      items.forEach((r) => next.add(r.id));
      setSelectedIds(next);
    }
  }, [allOnPageSelected, selectedIds, items]);

  const handleToggleRow = useCallback((id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    setAllRecordsSelected(false);
  }, [selectedIds]);

  const handleSelectAllRecords = useCallback(async () => {
    try {
      const result = await developmentRequestsApi.getLinesIds(apiFilters);
      setSelectedIds(new Set(result.ids));
      setAllRecordsSelected(true);
    } catch {
      toast.error("Failed to select all records");
    }
  }, [apiFilters]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setAllRecordsSelected(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await developmentRequestsApi.exportLinesXlsx(
        selectedIds.size > 0 ? undefined : apiFilters,
        undefined,
        selectedIds.size > 0 ? Array.from(selectedIds) : undefined
      );
      if (selectedIds.size > 0) toast.success(`Exported ${selectedIds.size} line(s)`);
    } catch {
      toast.error("Failed to export DR lines");
    } finally {
      setIsExporting(false);
    }
  }, [selectedIds, apiFilters]);

  // ---------------------------------------------------------------------------
  // Grouping handlers
  // ---------------------------------------------------------------------------

  // Initialize expanded groups when data.groups changes
  useEffect(() => {
    if (data?.groups && data.groups.length > 0) {
      const newExpanded = new Set<string>();
      data.groups.forEach((g) => newExpanded.add(g.key));
      setExpandedGroups(newExpanded);
    }
  }, [data?.groups]);

  const handleGroupByChange = useCallback((value: string) => {
    const newGroupBy = value === "none" ? undefined : value as DevelopmentRequestLineFilters["group_by"];
    setGroupBy(newGroupBy);
    setPage(1);
  }, []);

  const handleToggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    if (data?.groups) {
      setExpandedGroups(new Set(data.groups.map((g) => g.key)));
    }
  }, [data?.groups]);

  const handleCollapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  const pageCount = data ? Math.ceil(data.total / pageSize) : 0;

  // ---------------------------------------------------------------------------
  // Table body builder
  // ---------------------------------------------------------------------------

  const renderLineRow = useCallback((item: RequestModuleLineWithRequest) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <TableRow
        key={`row-${item.id}`}
        className={`transition-colors ${isSelected ? "bg-primary/5" : ""}`}
        data-state={isSelected ? "selected" : undefined}
      >
        <TableCell className="w-10 pr-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => handleToggleRow(item.id)}
            aria-label={`Select line ${item.id}`}
          />
        </TableCell>

        <TableCell className="w-[200px]">
          <a
            href={`/development-requests/${item.request_id}`}
            className="text-primary hover:underline text-sm font-medium truncate block max-w-[190px]"
            title={item.request?.title}
          >
            {item.request?.title ?? "N/A"}
          </a>
          <span className="text-xs text-muted-foreground">{item.request?.request_number}</span>
        </TableCell>

        <TableCell className="text-sm font-mono">{item.module_technical_name}</TableCell>
        <TableCell className="text-sm text-muted-foreground w-[90px]">{item.module_version ?? "—"}</TableCell>
        <TableCell className="text-xs text-muted-foreground font-mono w-[120px] truncate max-w-[120px]" title={item.module_md5_sum ?? undefined}>
          {item.module_md5_sum ?? "—"}
        </TableCell>

        <TableCell className="w-[120px]">
          {item.uat_status ? (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${UAT_STATUS_COLORS[item.uat_status] ?? "bg-gray-100 text-gray-800"}`}>
              {item.uat_status.replace("_", " ")}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>

        <TableCell className="text-sm text-muted-foreground w-[130px]">{item.uat_ticket ?? "—"}</TableCell>
        <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate" title={item.tec_note ?? undefined}>
          {item.tec_note ?? "—"}
        </TableCell>
      </TableRow>
    );
  }, [selectedIds, handleToggleRow]);

  // Extract group key from an item based on current group_by
  const getItemGroupKey = useCallback((item: RequestModuleLineWithRequest): string => {
    if (!groupBy) return "__ungrouped";

    switch (groupBy) {
      case "module":
        return item.module_technical_name;
      case "uat_status":
        return item.uat_status ?? "None";
      case "request_type":
        return item.request?.request_type?.name ?? "Unknown";
      case "request_state":
        return item.request?.request_state?.name ?? "Unknown";
      case "functional_category":
        return item.request?.functional_category?.name ?? "Unknown";
      case "priority":
        return item.request?.priority?.name ?? "Unknown";
      case "assigned_developer":
        return item.request?.assigned_developer?.username ?? "Unassigned";
      default:
        return "__ungrouped";
    }
  }, [groupBy]);

  // Group items by their group key
  const groupedItems = useMemo(() => {
    if (!groupBy || !data?.groups) {
      return null;
    }

    const groups: Map<string, RequestModuleLineWithRequest[]> = new Map();
    items.forEach((item) => {
      const key = getItemGroupKey(item);
      const existing = groups.get(key) || [];
      groups.set(key, [...existing, item]);
    });
    return groups;
  }, [groupBy, items, data?.groups, getItemGroupKey]);

  const tableBodyRows = useMemo(() => {
    if (!groupBy || !groupedItems || !data?.groups) {
      // Flat rendering
      return items.map((item) => renderLineRow(item));
    }

    // Grouped rendering
    const rows: React.ReactNode[] = [];
    data.groups.forEach((group) => {
      const isExpanded = expandedGroups.has(group.key);
      const groupItems = groupedItems.get(group.key) || [];

      // Group header
      rows.push(
        <DrGroupHeader
          key={`header-${group.key}`}
          label={group.label}
          count={group.count}
          isExpanded={isExpanded}
          onToggle={() => handleToggleGroup(group.key)}
        />
      );

      // Group rows (if expanded)
      if (isExpanded) {
        groupItems.forEach((item) => {
          rows.push(renderLineRow(item));
        });
      }
    });

    return rows;
  }, [items, groupBy, groupedItems, data?.groups, expandedGroups, renderLineRow, handleToggleGroup]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasActiveFilters = !!(filters.module_names || filters.uat_statuses || filters.search);

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">DR Module Lines</h1>
        <Button
          onClick={handleExport}
          variant="outline"
          size="sm"
          disabled={isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          {selectedIds.size > 0 ? `Export ${selectedIds.size} Selected` : "Export"}
        </Button>
      </div>

      {/* ── Query Bar ── */}
      <DrLinesQueryBar filters={filters} onChange={handleFilterChange} />

      {/* ── Group By Controls ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Group by:</span>
          <Select value={groupBy || "none"} onValueChange={handleGroupByChange}>
            <SelectTrigger className="w-[150px] h-8">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              {GROUP_BY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || "none"} value={opt.value || "none"}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {groupBy && data?.groups && data.groups.length > 0 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1"
              onClick={handleExpandAll}
            >
              <ChevronsDown className="h-3.5 w-3.5" />
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1"
              onClick={handleCollapseAll}
            >
              <ChevronsUp className="h-3.5 w-3.5" />
              Collapse All
            </Button>
          </div>
        )}
      </div>

      {/* ── Bulk Actions Toolbar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-primary/5 border-primary/20">
          <Badge variant="secondary">{selectedIds.size} selected</Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 ml-auto text-muted-foreground"
            onClick={handleClearSelection}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* ── Select All N Records Banner ── */}
      {allOnPageSelected && !allRecordsSelected && totalRecords > items.length && (
        <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
          <span>All {items.length} items on this page are selected.</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={handleSelectAllRecords}>
            Select all {totalRecords} matching records
          </Button>
        </div>
      )}
      {allRecordsSelected && (
        <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
          <span>All {totalRecords} matching records are selected.</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={handleClearSelection}>
            Clear selection
          </Button>
        </div>
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                {Array.from({ length: COLS }).map((_, i) => (
                  <TableHead key={i}><Skeleton className="h-4 w-full" /></TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLS }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border flex flex-col items-center justify-center p-12">
          {hasActiveFilters ? (
            <>
              <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No lines found</h3>
              <p className="text-muted-foreground text-center mb-4">No DR lines match your current filters.</p>
              <Button variant="outline" onClick={() => handleFilterChange(DEFAULT_FILTERS)}>
                Clear Filters
              </Button>
            </>
          ) : (
            <>
              <Archive className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No DR lines</h3>
              <p className="text-muted-foreground text-center">No development request lines exist yet.</p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-auto max-h-[calc(100vh-320px)]">
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
                <TableHead className="w-[200px] font-semibold">Dev Request</TableHead>
                <TableHead>Module</TableHead>
                <TableHead className="w-[90px]">Version</TableHead>
                <TableHead className="w-[120px]">MD5</TableHead>
                <TableHead className="w-[120px]">UAT Status</TableHead>
                <TableHead className="w-[130px]">UAT Ticket</TableHead>
                <TableHead>Tech Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{tableBodyRows}</TableBody>
          </Table>
        </div>
      )}

      {/* ── Pagination ── */}
      {data && pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data.total} total · Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPage(page - 1); setSelectedIds(new Set()); setAllRecordsSelected(false); }}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPage(page + 1); setSelectedIds(new Set()); setAllRecordsSelected(false); }}
              disabled={page >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
