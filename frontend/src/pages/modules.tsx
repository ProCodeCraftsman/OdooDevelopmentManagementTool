import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { type ColumnDef } from "@tanstack/react-table";
import { useModuleMaster } from "@/hooks/useModuleMaster";
import { exportModuleMasterXlsx } from "@/api/module-master";
import type { ModuleMasterRecord } from "@/api/module-master";

function joinFilter(values: string[]): string | undefined {
  return values.length > 0 ? values.join(",") : undefined;
}

export function ModulesPage() {
  const {
    data,
    isFetching,
    pagination,
    pageIndex,
    pageSize,
    onPaginationChange,
    search,
    onSearchChange,
    onSortingChange,
    filterOptions,
    technicalNames,
    setTechnicalNames,
    shortdescs,
    setShortdescs,
  } = useModuleMaster({ limit: 20 });

  const [exporting, setExporting] = useState(false);

  const sortBy = useMemo(() => {
    return "technical_name";
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportModuleMasterXlsx({
        search: search || undefined,
        technical_names: joinFilter(technicalNames),
        shortdescs: joinFilter(shortdescs),
        sort_by: sortBy,
        sort_order: "asc",
      });
      toast.success("Exported successfully");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<ModuleMasterRecord>[] = useMemo(
    () => [
      {
        accessorKey: "technical_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Technical Name" />
        ),
        cell: ({ row }) => (
          <div className="font-mono text-sm">{row.getValue("technical_name")}</div>
        ),
      },
      {
        accessorKey: "shortdesc",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {(row.getValue("shortdesc") as string | null) || "-"}
          </span>
        ),
      },
      {
        accessorKey: "first_seen_date",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="First Seen" />
        ),
        cell: ({ row }) => {
          const value = row.getValue("first_seen_date") as string | null;
          if (!value) return <span className="text-muted-foreground">-</span>;
          return <span>{new Date(value).toLocaleDateString()}</span>;
        },
      },
    ],
    []
  );

  const rows = data?.data ?? [];
  const totalPages = pagination?.total_pages ?? 0;
  const totalRecords = pagination?.total_records ?? 0;

  const technicalNameOptions = filterOptions?.technical_names ?? [];
  const shortdescOptions = filterOptions?.shortdescs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Module Master</h2>
        <p className="text-muted-foreground">
          {totalRecords > 0 ? `${totalRecords} modules tracked` : "Browse all tracked modules"}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={rows}
            pagination={pagination}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPaginationChange={onPaginationChange}
            pageCount={totalPages}
            searchable
            searchPlaceholder="Filter by technical name..."
            searchValue={search}
            onSearchChange={onSearchChange}
            onSortingChange={onSortingChange}
            loading={isFetching}
            filterBar={
              <div className="flex flex-wrap items-center gap-2">
                <SearchableMultiSelect
                  options={technicalNameOptions}
                  selected={technicalNames}
                  onChange={setTechnicalNames}
                  allLabel="Technical Name"
                  searchPlaceholder="Search names..."
                  triggerWidth="w-[170px]"
                />
                <SearchableMultiSelect
                  options={shortdescOptions}
                  selected={shortdescs}
                  onChange={setShortdescs}
                  allLabel="Description"
                  searchPlaceholder="Search descriptions..."
                  triggerWidth="w-[180px]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={handleExport}
                  disabled={exporting || !totalRecords}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
