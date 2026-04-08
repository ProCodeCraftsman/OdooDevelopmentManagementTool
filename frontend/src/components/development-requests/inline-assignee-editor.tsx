import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpdateDevelopmentRequest } from "@/hooks/useDevelopmentRequests";
import { useAssignableUsers } from "@/hooks/useUsers";
import type { DevelopmentRequest } from "@/api/development-requests";
import { ChevronDown, UserX } from "lucide-react";

interface Props {
  request: DevelopmentRequest;
}

export function InlineAssigneeEditor({ request }: Props) {
  const [open, setOpen] = useState(false);
  const updateMutation = useUpdateDevelopmentRequest();
  const { data: users = [] } = useAssignableUsers();

  const canEdit = request.permissions?.can_edit_assigned_developer;

  if (!canEdit) {
    return (
      <span className="text-sm">
        {request.assigned_developer?.username ?? (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
    );
  }

  const handleSelect = (developerId: number | null) => {
    setOpen(false);
    updateMutation.mutate({
      id: request.id,
      data: { assigned_developer_id: developerId ?? undefined },
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
          disabled={updateMutation.isPending}
        >
          <span>
            {request.assigned_developer?.username ?? (
              <span className="text-muted-foreground italic">Unassigned</span>
            )}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">Assignee</div>
        <button
          className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2 text-muted-foreground"
          onClick={() => handleSelect(null)}
        >
          <UserX className="h-3.5 w-3.5" /> Unassign
        </button>
        <div className="h-px bg-border my-1" />
        {users.map((u) => (
          <button
            key={u.id}
            className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2 ${request.assigned_developer_id === u.id ? "font-medium" : ""}`}
            onClick={() => handleSelect(u.id)}
          >
            {u.username}
            {request.assigned_developer_id === u.id && (
              <span className="ml-auto text-xs text-muted-foreground">current</span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
