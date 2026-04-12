import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Archive, UserPlus, User as UserIcon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
} from "@/hooks/useUsers";
import { useRoles } from "@/hooks/useRoles";
import type { User } from "@/api/users";
import type { UserCreate, UserUpdate } from "@/api/users";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { isAxiosError } from "axios";

// ── Schemas ────────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
  role_ids: z.array(z.number()),
});

const editUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z.string().optional(),
  is_active: z.boolean(),
  role_ids: z.array(z.number()),
});

type CreateFormData = z.infer<typeof createUserSchema>;
type EditFormData = z.infer<typeof editUserSchema>;

// ── Role multi-select ──────────────────────────────────────────────────────

function RoleCheckboxList({
  roles,
  selected,
  onChange,
}: {
  roles: { id: number; name: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number) => {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id]
    );
  };

  if (!roles.length) {
    return <p className="text-sm text-muted-foreground">No roles available</p>;
  }

  return (
    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
      {roles.map((role) => (
        <label
          key={role.id}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <Checkbox
            checked={selected.includes(role.id)}
            onCheckedChange={() => toggle(role.id)}
          />
          <span className="text-sm">{role.name}</span>
        </label>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function SettingsUsersPage() {
  const { data: users, isLoading } = useUsers();
  const { data: roles } = useRoles();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [userToArchive, setUserToArchive] = useState<User | null>(null);

  // ── Create form ──────────────────────────────────────────────────────────

  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { username: "", email: "", password: "", role_ids: [] },
  });

  const onCreateSubmit = async (formData: CreateFormData) => {
    try {
      const payload: UserCreate = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role_ids: formData.role_ids,
      };
      await createUser.mutateAsync(payload);
      setCreateDialogOpen(false);
      createForm.reset();
    } catch (err) {
      const detail = isAxiosError(err) ? err.response?.data?.detail : null;
      if (detail === "Email already taken") {
        createForm.setError("email", { message: "Email already taken" });
      } else if (detail === "Username already taken") {
        createForm.setError("username", { message: "Username already taken" });
      } else {
        toast.error("Failed to create user");
      }
    }
  };

  // ── Edit form ────────────────────────────────────────────────────────────

  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      is_active: true,
      role_ids: [],
    },
  });

  const handleEdit = (user: User) => {
    setEditingUser(user);
    editForm.reset({
      username: user.username,
      email: user.email,
      password: "",
      is_active: user.is_active,
      role_ids: user.roles.map((r) => r.id),
    });
    setEditDialogOpen(true);
  };

  const onEditSubmit = async (formData: EditFormData) => {
    if (!editingUser) return;
    try {
      const payload: UserUpdate = {
        username: formData.username,
        email: formData.email,
        is_active: formData.is_active,
        role_ids: formData.role_ids,
      };
      if (formData.password) {
        payload.password = formData.password;
      }
      await updateUser.mutateAsync({ id: editingUser.id, data: payload });
      setEditDialogOpen(false);
      setEditingUser(null);
      editForm.reset();
    } catch (err) {
      const detail = isAxiosError(err) ? err.response?.data?.detail : null;
      if (detail === "Email already taken") {
        editForm.setError("email", { message: "Email already taken" });
      } else if (detail === "Username already taken") {
        editForm.setError("username", { message: "Username already taken" });
      } else {
        toast.error("Failed to update user");
      }
    }
  };

  // ── Archive ──────────────────────────────────────────────────────────────

  const handleArchiveConfirm = async () => {
    if (!userToArchive) return;
    try {
      await updateUser.mutateAsync({
        id: userToArchive.id,
        data: { is_active: false },
      });
      toast.success(`${userToArchive.username} has been archived`);
      setArchiveDialogOpen(false);
      setUserToArchive(null);
    } catch {
      toast.error("Failed to archive user");
    }
  };

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "user",
        header: "User",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium shrink-0">
              {row.original.username.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium">{row.original.username}</span>
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">{getValue<string>()}</span>
        ),
      },
      {
        id: "roles",
        header: "Roles",
        cell: ({ row }) => {
          const userRoles = row.original.roles;
          if (!userRoles.length)
            return <span className="text-sm text-muted-foreground">No roles</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {userRoles.map((r) => (
                <Badge key={r.id} variant="outline">
                  {r.name}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? "default" : "secondary"}>
            {row.original.is_active ? "Active" : "Archived"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleEdit(row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {row.original.is_active && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Archive user"
                onClick={() => {
                  setUserToArchive(row.original);
                  setArchiveDialogOpen(true);
                }}
              >
                <Archive className="h-4 w-4 text-amber-500" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-12">
      <UserIcon className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-lg font-medium">No users found</p>
    </div>
  );

  const activeRoles = roles?.filter((r) => r.is_active) ?? [];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Manage Users</h2>
          <p className="text-muted-foreground text-sm">View and manage user accounts</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={users ?? []}
        loading={isLoading}
        searchable={false}
        emptyState={emptyState}
      />

      {/* ── Create User Dialog ───────────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user account</DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-username">Username</Label>
              <Input id="create-username" {...createForm.register("username")} />
              {createForm.formState.errors.username && (
                <p className="text-sm text-red-500">
                  {createForm.formState.errors.username.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input id="create-email" type="email" {...createForm.register("email")} />
              {createForm.formState.errors.email && (
                <p className="text-sm text-red-500">
                  {createForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                {...createForm.register("password")}
              />
              {createForm.formState.errors.password && (
                <p className="text-sm text-red-500">
                  {createForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <RoleCheckboxList
                roles={activeRoles}
                selected={createForm.watch("role_ids")}
                onChange={(ids) => createForm.setValue("role_ids", ids)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  createForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ─────────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user account settings</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input id="edit-username" {...editForm.register("username")} />
              {editForm.formState.errors.username && (
                <p className="text-sm text-red-500">
                  {editForm.formState.errors.username.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" {...editForm.register("email")} />
              {editForm.formState.errors.email && (
                <p className="text-sm text-red-500">
                  {editForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="password"
                {...editForm.register("password")}
              />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <RoleCheckboxList
                roles={activeRoles}
                selected={editForm.watch("role_ids")}
                onChange={(ids) => editForm.setValue("role_ids", ids)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-is-active"
                checked={editForm.watch("is_active")}
                onCheckedChange={(checked) =>
                  editForm.setValue("is_active", checked === true)
                }
              />
              <Label htmlFor="edit-is-active" className="cursor-pointer">
                Active
              </Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingUser(null);
                  editForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateUser.isPending}>
                Update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Archive Confirmation Dialog ──────────────────────────────────── */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive User</DialogTitle>
            <DialogDescription>
              Archive "{userToArchive?.username}"? They will no longer be able to log in
              but their data will be preserved. You can reactivate them by editing the
              user.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchiveConfirm}
              disabled={updateUser.isPending}
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
