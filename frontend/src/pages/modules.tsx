import { useComparisonReport } from "@/hooks/useReports";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, SearchX, X } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";

export function ModulesPage() {
  const { data: report, isLoading: isReportLoading } = useComparisonReport();
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(15);

  const hasSearch = search.trim().length > 0;

  // For now, use the report data transformed to match ModuleMasterRecord shape
  const moduleMasterData = useMemo(() => {
    if (!report?.rows) return [];
    return report.rows.map((row, index) => ({
      id: index,
      technical_name: row.technical_name,
      shortdesc: row.module_name || null,
      first_seen_date: null, // Will be populated when API is ready
    }));
  }, [report]);

  const filteredData = useMemo(() => {
    if (!search.trim()) return moduleMasterData;
    const searchLower = search.toLowerCase();
    return moduleMasterData.filter(
      (row) =>
        row.technical_name.toLowerCase().includes(searchLower) ||
        (row.shortdesc && row.shortdesc.toLowerCase().includes(searchLower))
    );
  }, [moduleMasterData, search]);

  const columns: ColumnDef<typeof moduleMasterData[0]>[] = useMemo(
    () => [
      {
        accessorKey: "technical_name",
        header: ({ column }: { column: { getIsSorted: () => "asc" | "desc" | false; getToggleSortingHandler: () => ((event: unknown) => void) | undefined } }) => (
          <DataTableColumnHeader column={column} title="Technical Name" />
        ),
        cell: ({ row }: { row: { getValue: (key: string) => unknown } }): React.ReactNode => (
          <div className="font-mono text-sm">{String(row.getValue("technical_name"))}</div>
        ),
      },
      {
        accessorKey: "shortdesc",
        header: ({ column }: { column: { getIsSorted: () => "asc" | "desc" | false; getToggleSortingHandler: () => ((event: unknown) => void) | undefined } }) => (
          <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }: { row: { getValue: (key: string) => unknown } }): React.ReactNode => (
          <span className="text-muted-foreground">
            {String(row.getValue("shortdesc") || "-")}
          </span>
        ),
      },
      {
        accessorKey: "first_seen_date",
        header: ({ column }: { column: { getIsSorted: () => "asc" | "desc" | false; getToggleSortingHandler: () => ((event: unknown) => void) | undefined } }) => (
          <DataTableColumnHeader column={column} title="First Seen" />
        ),
        cell: ({ row }: { row: { getValue: (key: string) => unknown } }): React.ReactNode => {
          const value = row.getValue("first_seen_date");
          if (!value) return <span className="text-muted-foreground">-</span>;
          const date = new Date(value as string);
          return <span>{date.toLocaleDateString()}</span>;
        },
      },
    ],
    []
  );

  const isEmpty = filteredData.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Module Master</h2>
        <p className="text-muted-foreground">Browse all tracked modules</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter by technical name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9"
        />
        {hasSearch && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modules ({filteredData.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isReportLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center p-8">
              {hasSearch ? (
                <>
                  <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No modules found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    No modules match your search "{search}".
                  </p>
                  <Button variant="outline" onClick={() => setSearch("")}>
                    Clear Search
                  </Button>
                </>
              ) : (
                <>
                  <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No modules</h3>
                  <p className="text-muted-foreground text-center">
                    No modules have been synced yet.
                  </p>
                </>
              )}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredData}
              pageIndex={pageIndex}
              pageSize={pageSize}
              onPaginationChange={(pagination) => {
                setPageIndex(pagination.pageIndex);
                setPageSize(pagination.pageSize);
              }}
              searchable={false}
              searchValue={search}
              onSearchChange={() => {}}
              loading={isReportLoading}
              pageCount={Math.ceil(filteredData.length / pageSize)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}