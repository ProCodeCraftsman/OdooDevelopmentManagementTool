"use client";

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
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
            {[15, 25, 50, 100].map((pageSize) => (
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
    <div
      className={cn("flex items-center gap-2", className)}
    >
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

export interface PaginationInfo {
  total_records: number;
  total_pages: number;
  current_page: number;
  limit: number;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pagination?: PaginationInfo;
  pageIndex?: number;
  pageSize?: number;
  onPaginationChange?: (pagination: PaginationState) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
  groupable?: boolean;
  groupBy?: string;
  onGroupByChange?: (value: string | null) => void;
  loading?: boolean;
  pageCount?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pagination,
  pageIndex = 0,
  pageSize = 15,
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
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState(searchValue);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
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
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    pageCount: pageCount >= 0 ? pageCount : undefined,
    onPaginationChange: (updater) => {
      if (onPaginationChange) {
        const newState =
          typeof updater === "function"
            ? updater({
                pageIndex,
                pageSize,
              })
            : updater;
        onPaginationChange(newState);
      }
    },
    manualPagination: true,
    manualSorting: true,
  });

  React.useEffect(() => {
    if (onSearchChange && globalFilter !== searchValue) {
      const timeout = setTimeout(() => {
        onSearchChange(globalFilter);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [globalFilter, onSearchChange, searchValue]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        {searchable && (
          <div className="relative w-full sm:w-auto">
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="max-w-sm"
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
                const id = col.id as string;
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

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && <DataTablePagination table={table} />}
    </div>
  );
}
