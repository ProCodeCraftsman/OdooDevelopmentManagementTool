"use client";

/**
 * Universal Table Standard
 * ========================
 * All data tables in this application use this DataTable component.
 *
 * Usage patterns:
 *
 * 1. Server-side (modules, dev-requests):
 *    - Pass `pagination`, `pageIndex`, `pageSize`, `onPaginationChange`, `pageCount`
 *    - Pass `onSearchChange` + `searchValue` for debounced server search
 *    - Pass `onSortingChange` to bubble sort state to hook
 *
 * 2. Client-side (environments, users — small lists, no server pagination):
 *    - Pass `data` only; omit `pagination` / `onPaginationChange`
 *    - DataTable shows all rows (manualPagination respects provided data as-is)
 *
 * 3. Custom filters (dev-requests):
 *    - Pass `filterBar` with any filter JSX; rendered above the table
 *
 * 4. Clickable rows (dev-requests):
 *    - Pass `onRowClick`; rows get cursor-pointer and hover style
 *
 * 5. Custom empty states:
 *    - Pass `emptyState` JSX shown when data is empty and not loading
 *
 * Loading state renders skeleton rows matching the column count.
 * Table header is sticky by default.
 */

import * as React from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  type PaginationState,
  getPaginationRowModel,
  getSortedRowModel,
  type FilterFn,
  type Row,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

declare module "@tanstack/react-table" {
  interface FilterFns {
    fuzzy: FilterFn<unknown>;
  }
}

// ─── Pagination footer ────────────────────────────────────────────────────────

interface DataTablePaginationProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
}

export function DataTablePagination({ table }: DataTablePaginationProps) {
  return (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </span>
        <span className="hidden sm:inline">•</span>
        <span className="hidden sm:inline">
          {table.getFilteredRowModel().rows.length} rows
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={String(table.getState().pagination.pageSize)}
          onValueChange={(value) => {
            table.setPageSize(Number(value));
          }}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue placeholder={table.getState().pagination.pageSize} />
          </SelectTrigger>
          <SelectContent side="top">
            {[15, 20, 25, 50, 100].map((pageSize) => (
              <SelectItem key={pageSize} value={String(pageSize)}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ─── Sortable column header ───────────────────────────────────────────────────

export function DataTableColumnHeader({
  column,
  title,
  className,
}: {
  column: {
    getIsSorted: () => "asc" | "desc" | false;
    getToggleSortingHandler: () => ((event: unknown) => void) | undefined;
  };
  title: string;
  className?: string;
}) {
  const sorting = column.getIsSorted();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 data-[state=open]:bg-accent"
        onClick={(e) => {
          e.stopPropagation();
          const handler = column.getToggleSortingHandler();
          if (handler) handler(e);
        }}
      >
        <span>{title}</span>
        {{
          asc: <ChevronUp className="ml-2 h-4 w-4" />,
          desc: <ChevronDown className="ml-2 h-4 w-4" />,
        }[sorting as string] ?? (
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        )}
      </Button>
    </div>
  );
}

// ─── PaginationInfo type (mirrors backend response shape) ────────────────────

export interface PaginationInfo {
  total_records: number;
  total_pages: number;
  current_page: number;
  limit: number;
}

// ─── DataTable ────────────────────────────────────────────────────────────────

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  // Server-side pagination
  pagination?: PaginationInfo;
  pageIndex?: number;
  pageSize?: number;
  onPaginationChange?: (pagination: PaginationState) => void;
  pageCount?: number;
  // Search
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
  // Sorting
  onSortingChange?: (sorting: SortingState) => void;
  // Grouping
  groupable?: boolean;
  groupBy?: string;
  onGroupByChange?: (value: string | null) => void;
  // State
  loading?: boolean;
  // Extension slots
  /** Custom filter controls rendered above the table (below search). */
  filterBar?: React.ReactNode;
  /** Called when a row is clicked. Adds cursor-pointer to rows. */
  onRowClick?: (row: TData) => void;
  /** Shown when data is empty and not loading. Defaults to "No results." */
  emptyState?: React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pagination,
  pageIndex = 0,
  pageSize = 20,
  onPaginationChange,
  searchable = true,
  searchPlaceholder = "Search...",
  onSearchChange,
  searchValue = "",
  groupable = false,
  groupBy,
  onGroupByChange,
  loading = false,
  pageCount = -1,
  onSortingChange: onSortingChangeProp,
  filterBar,
  onRowClick,
  emptyState,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState(searchValue);

  const handleSortingChange = React.useCallback(
    (updater: React.SetStateAction<SortingState>) => {
      setSorting((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        onSortingChangeProp?.(next);
        return next;
      });
    },
    [onSortingChangeProp]
  );

  // TanStack Table returns non-memoizable functions; React Compiler warns on this by design.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: handleSortingChange,
    onGlobalFilterChange: setGlobalFilter,
    filterFns: {
      fuzzy: (row, columnId, value) => {
        const cellValue = row.getValue(columnId);
        if (cellValue == null) return false;
        return String(cellValue).toLowerCase().includes(value.toLowerCase());
      },
    },
    globalFilterFn: "fuzzy",
    state: {
      sorting,
      globalFilter,
      pagination: { pageIndex, pageSize },
    },
    pageCount: pageCount >= 0 ? pageCount : undefined,
    onPaginationChange: (updater) => {
      if (onPaginationChange) {
        const newState =
          typeof updater === "function"
            ? updater({ pageIndex, pageSize })
            : updater;
        onPaginationChange(newState);
      }
    },
    manualPagination: true,
    manualSorting: true,
  });

  // Debounce search → server
  React.useEffect(() => {
    if (onSearchChange && globalFilter !== searchValue) {
      const timeout = setTimeout(() => {
        onSearchChange(globalFilter);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [globalFilter, onSearchChange, searchValue]);

  const skeletonRowCount = Math.min(pageSize, 8);
  const columnCount = columns.length;

  const defaultEmptyState = (
    <TableRow>
      <TableCell colSpan={columnCount} className="h-32 text-center text-muted-foreground">
        No results.
      </TableCell>
    </TableRow>
  );

  const hasToolbar = searchable || filterBar || groupable;

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      {hasToolbar && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            {searchable && (
              <div className="relative w-full sm:w-auto">
                <Input
                  placeholder={searchPlaceholder}
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="max-w-sm pr-8"
                />
                {globalFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-2"
                    onClick={() => setGlobalFilter("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            {groupable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto">
                    Group by
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Group by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={!groupBy}
                    onCheckedChange={() => onGroupByChange?.(null)}
                  >
                    None
                  </DropdownMenuCheckboxItem>
                  {columns.map((col) => {
                    const id = col.id || ((col as { accessorKey?: string }).accessorKey) || String(col);
                    if (!id) return null;
                    return (
                      <DropdownMenuCheckboxItem
                        key={id}
                        checked={groupBy === id}
                        onCheckedChange={() => onGroupByChange?.(id)}
                      >
                        {typeof col.header === "string"
                          ? col.header
                          : id.charAt(0).toUpperCase() + id.slice(1)}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {filterBar && <div>{filterBar}</div>}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: skeletonRowCount }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: columnCount }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row: Row<TData>) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              emptyState ?? defaultEmptyState
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {pagination && <DataTablePagination table={table} />}
    </div>
  );
}
