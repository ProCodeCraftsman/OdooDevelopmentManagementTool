import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEnvironments, useCreateEnvironment, useUpdateEnvironment, useDeleteEnvironment } from "@/hooks/useEnvironments";
import type { EnvironmentList } from "@/types/api";
import { toast } from "sonner";

const environmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  db_name: z.string().min(1, "Database name is required"),
  user: z.string().min(1, "User is required"),
  password: z.string().min(1, "Password is required"),
  order: z.number(),
  category: z.string(),
});

type EnvironmentFormData = z.infer<typeof environmentSchema>;

export function SettingsEnvironmentsPage() {
  const { data: environments, isLoading } = useEnvironments();
  const createEnvironment = useCreateEnvironment();
  const updateEnvironment = useUpdateEnvironment();
  const deleteEnvironment = useDeleteEnvironment();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingEnv, setEditingEnv] = useState<EnvironmentList | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [envToDelete, setEnvToDelete] = useState<string | null>(null);

  const form = useForm<EnvironmentFormData>({
    resolver: zodResolver(environmentSchema),
    defaultValues: {
      name: "",
      url: "",
      db_name: "",
      user: "",
      password: "",
      order: 0,
      category: "unknown",
    },
  });

  const onSubmit = async (data: EnvironmentFormData) => {
    try {
      if (editingEnv) {
        const updateData = {
          url: data.url,
          db_name: data.db_name,
          user: data.user,
          password: data.password,
          order: data.order,
          category: data.category,
        };
        await updateEnvironment.mutateAsync({ name: editingEnv.name, data: updateData });
        toast.success("Environment updated");
      } else {
        await createEnvironment.mutateAsync(data);
        toast.success("Environment created");
      }
      setIsSheetOpen(false);
      form.reset();
      setEditingEnv(null);
    } catch {
      toast.error("Operation failed");
    }
  };

  const onFormSubmit = form.handleSubmit(onSubmit);

  const handleEdit = (env: EnvironmentList) => {
    setEditingEnv(env);
    form.reset({
      name: env.name,
      url: "",
      db_name: "",
      user: "",
      password: "",
      order: env.order,
      category: env.category,
    });
    setIsSheetOpen(true);
  };

  const handleDelete = async () => {
    if (!envToDelete) return;
    try {
      await deleteEnvironment.mutateAsync(envToDelete);
      toast.success("Environment deleted");
      setDeleteDialogOpen(false);
      setEnvToDelete(null);
    } catch {
      toast.error("Failed to delete environment");
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Manage Environments</h2>
          <p className="text-muted-foreground text-sm">Add, edit, or remove Odoo server connections</p>
        </div>
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              onClick={() => {
                setEditingEnv(null);
                form.reset();
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Environment
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader className="text-left">
              <SheetTitle>{editingEnv ? "Edit Environment" : "Add Environment"}</SheetTitle>
              <SheetDescription>
                {editingEnv
                  ? "Update the environment details"
                  : "Enter the details for the new Odoo server"}
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={onFormSubmit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input id="url" placeholder="https://odoo.example.com" {...form.register("url")} />
                {form.formState.errors.url && (
                  <p className="text-sm text-red-500">{form.formState.errors.url.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="db_name">Database Name</Label>
                <Input id="db_name" {...form.register("db_name")} />
                {form.formState.errors.db_name && (
                  <p className="text-sm text-red-500">{form.formState.errors.db_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="user">User</Label>
                <Input id="user" {...form.register("user")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" {...form.register("password")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="order">Order</Label>
                  <Input
                    id="order"
                    type="number"
                    {...form.register("order", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" {...form.register("category")} />
                </div>
              </div>
              <Button type="submit" className="w-full">
                {editingEnv ? "Update" : "Create"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environments ({environments?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium hidden md:table-cell">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium hidden sm:table-cell">Order</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {environments?.map((env) => (
                    <tr key={env.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{env.name}</div>
                        <div className="text-xs text-muted-foreground md:hidden">{env.category} • Order: {env.order}</div>
                      </td>
                      <td className="px-4 py-3 text-sm hidden md:table-cell">{env.category}</td>
                      <td className="px-4 py-3 text-sm hidden sm:table-cell">{env.order}</td>
                      <td className="px-4 py-3">
                        <Badge variant={env.is_active ? "default" : "secondary"}>
                          {env.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(env)} className="h-8 w-8">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEnvToDelete(env.name);
                              setDeleteDialogOpen(true);
                            }}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Environment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{envToDelete}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
