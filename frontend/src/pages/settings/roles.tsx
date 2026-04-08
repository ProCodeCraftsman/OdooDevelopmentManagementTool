import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from "@/hooks/useRoles";
import type { Role } from "@/api/roles";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const roleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  permissions: z.array(z.string()),
  priority: z.number().int().min(0).max(100),
});

type RoleFormData = z.infer<typeof roleSchema>;

const PERMISSION_OPTIONS: { key: string; label: string; group: string }[] = [
  { group: "System", key: "system:manage", label: "System Manage" },
  { group: "Environments", key: "environments:read", label: "Environments Read" },
  { group: "Environments", key: "sync:trigger", label: "Sync Trigger" },
  { group: "Environments", key: "modules_master:read", label: "Modules Master Read" },
  { group: "Dev Requests", key: "dev_request:read", label: "Read" },
  { group: "Dev Requests", key: "dev_request:create", label: "Create" },
  { group: "Dev Requests", key: "dev_request:update", label: "Update" },
  { group: "Dev Requests", key: "dev_request:state_change", label: "State Change" },
  { group: "Dev Requests", key: "dev_request:reopen", label: "Reopen" },
  { group: "Dev Requests", key: "dev_request:archive", label: "Archive" },
  { group: "Dev Request Lines", key: "dev_request_line:create", label: "Create Lines" },
  { group: "Dev Request Lines", key: "dev_request_line:update", label: "Update Lines" },
  { group: "Dev Request Lines", key: "dev_request_line:delete", label: "Delete Lines" },
  { group: "Dev Request Lines", key: "uat:update", label: "UAT Update" },
  { group: "Artifacts", key: "comments:create", label: "Create Comments" },
  { group: "Artifacts", key: "attachments:create", label: "Create Attachments" },
  { group: "Artifacts", key: "attachments:delete", label: "Delete Attachments" },
  { group: "Release Plans", key: "release_plan:read", label: "Read" },
  { group: "Release Plans", key: "release_plan:create", label: "Create" },
  { group: "Release Plans", key: "release_plan:update", label: "Update" },
  { group: "Release Plans", key: "release_plan:delete", label: "Delete" },
  { group: "Release Plans", key: "release_plan:approve", label: "Approve" },
  { group: "Reports", key: "reports:read", label: "Read" },
  { group: "Reports", key: "reports:generate", label: "Generate" },
  { group: "Reports", key: "reports:export", label: "Export" },
];

export function SettingsRolesPage() {
  const { data: roles, isLoading } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: "",
      description: "",
      permissions: [],
      priority: 50,
    },
  });

  const onSubmit = async (data: RoleFormData) => {
    try {
      if (editingRole) {
        await updateRole.mutateAsync({ id: editingRole.id, data });
      } else {
        await createRole.mutateAsync(data);
      }
      setIsDialogOpen(false);
      form.reset();
      setEditingRole(null);
    } catch {
      toast.error("Operation failed");
    }
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    form.reset({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions ?? [],
      priority: role.priority,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!roleToDelete) return;
    try {
      await deleteRole.mutateAsync(roleToDelete.id);
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    } catch {
      toast.error("Failed to delete role");
    }
  };

  const togglePermission = (permission: string) => {
    const current = form.getValues("permissions") ?? [];
    const next = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];
    form.setValue("permissions", next);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Manage Roles</h2>
          <p className="text-muted-foreground text-sm">Define user roles and permissions</p>
        </div>
        <Button
          onClick={() => {
            setEditingRole(null);
            form.reset();
            setIsDialogOpen(true);
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Role
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles?.map((role) => (
            <Card key={role.id} className={cn(!role.is_active && "opacity-60")}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{role.name}</CardTitle>
                  </div>
                  <Badge variant={role.is_active ? "default" : "secondary"}>
                    {role.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {role.description || "No description"}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Priority</span>
                  <span className="font-medium">{role.priority}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(role.permissions ?? []).slice(0, 3).map((perm) => (
                    <Badge key={perm} variant="outline" className="text-xs">
                      {perm}
                    </Badge>
                  ))}
                  {(role.permissions?.length ?? 0) > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{(role.permissions?.length ?? 0) - 3}
                    </Badge>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(role)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRoleToDelete(role);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Add Role"}</DialogTitle>
            <DialogDescription>
              {editingRole ? "Update the role details" : "Create a new role for users"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name</Label>
              <Input id="name" {...form.register("name")} placeholder="e.g., Developer" />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                {...form.register("description")}
                placeholder="Brief description of this role"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority (0-100)</Label>
              <Input
                id="priority"
                type="number"
                min={0}
                max={100}
                {...form.register("priority", { valueAsNumber: true })}
              />
              {form.formState.errors.priority && (
                <p className="text-sm text-red-500">{form.formState.errors.priority.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                {Array.from(new Set(PERMISSION_OPTIONS.map((o) => o.group))).map((group) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{group}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {PERMISSION_OPTIONS.filter((o) => o.group === group).map((opt) => {
                        const selected = form.watch("permissions") ?? [];
                        const isSelected = selected.includes(opt.key);
                        return (
                          <label
                            key={opt.key}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors",
                              isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePermission(opt.key)}
                              className="sr-only"
                            />
                            <span className="text-xs">{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRole.isPending || updateRole.isPending}>
                {editingRole ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{roleToDelete?.name}"? Users with this role will lose their assigned role.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteRole.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
