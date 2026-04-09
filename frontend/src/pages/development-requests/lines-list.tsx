import { useState } from "react";
import { useDevelopmentRequestLines } from "@/hooks/useDevelopmentRequests";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { RequestModuleLineWithRequest } from "@/api/development-requests";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { developmentRequestsApi } from "@/api/development-requests";

export function DevelopmentRequestLinesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data, isLoading } = useDevelopmentRequestLines(
    {
      // Pass filters here if any
    },
    page,
    pageSize
  );

  const columns: ColumnDef<RequestModuleLineWithRequest>[] = [
    {
      accessorKey: "request.title",
      header: "Related Dev Request",
      cell: ({ row }) => (
        <a
          href={`/development-requests/${row.original.request_id}`}
          className="text-primary hover:underline"
        >
          {row.original.request?.title || "N/A"}
        </a>
      ),
    },
    { accessorKey: "module_technical_name", header: "Module" },
    { accessorKey: "module_version", header: "Version" },
    { accessorKey: "module_md5_sum", header: "MD5" },
    { accessorKey: "uat_status", header: "UAT Status" },
    { accessorKey: "uat_ticket", header: "UAT Ticket" },
    { accessorKey: "tec_note", header: "Tech Note" },
  ];

  const handleExport = async () => {
    try {
      await developmentRequestsApi.exportLinesXlsx({});
    } catch (error) {
      toast.error("Failed to export DR lines");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">DR Lines</h1>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </div>

      {data && (
        <DataTable
          columns={columns}
          data={data.items}
          pageCount={Math.ceil(data.total / pageSize)}
          pageIndex={page - 1}
          pageSize={pageSize}
          pagination={{
            total_records: data.total,
            total_pages: Math.ceil(data.total / pageSize),
            current_page: page,
            limit: pageSize,
          }}
          onPaginationChange={(pagination) => {
            setPage(pagination.pageIndex + 1);
            setPageSize(pagination.pageSize);
          }}
        />
      )}
    </div>
  );
}
