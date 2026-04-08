import { History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuditLog } from "@/hooks/useDevelopmentRequests";

interface AuditLogTabProps {
  requestId: number;
}

const FIELD_LABELS: Record<string, string> = {
  request_state_id: "State",
  priority_id: "Priority",
  assigned_developer_id: "Assignee",
  description: "Description",
  request_type_id: "Request Type",
  parent_request_id: "Parent Request",
  additional_info: "Additional Info",
  module_version: "Module Version",
  module_md5_sum: "MD5 Sum",
  uat_status: "UAT Status",
  module_id: "Module",
};

function truncate(val: string | null, max = 60) {
  if (!val) return <span className="text-muted-foreground italic">—</span>;
  return val.length > max ? (
    <span title={val}>{val.slice(0, max)}…</span>
  ) : val;
}

export function AuditLogTab({ requestId }: AuditLogTabProps) {
  const { data: entries, isLoading } = useAuditLog(requestId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (!entries?.length) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No changes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Date</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Changed By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(entry.changed_at).toLocaleString()}
              </TableCell>
              <TableCell className="text-sm font-medium">
                {FIELD_LABELS[entry.field_name] ?? entry.field_name}
              </TableCell>
              <TableCell className="text-sm max-w-[180px]">
                {truncate(entry.old_value)}
              </TableCell>
              <TableCell className="text-sm max-w-[180px]">
                {truncate(entry.new_value)}
              </TableCell>
              <TableCell className="text-sm">
                {entry.changed_by?.username ?? <span className="text-muted-foreground italic">System</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
