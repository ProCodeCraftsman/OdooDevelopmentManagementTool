import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, RotateCcw, Archive, AlertTriangle, Pencil } from "lucide-react";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Pagination } from "@/components/ui/pagination";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { cn } from "@/lib/utils";
import {
  useControlParameterList,
  useCreateControlParameter,
  useArchiveControlParameter,
  useRestoreControlParameter,
  useUpdateControlParameter,
  useControlParameterRules,
  useCreateControlParameterRule,
  useToggleControlParameterRule,
  type ControlParameterType,
} from "@/hooks/useControlParameters";
import {
  useReleasePlanStatesAll,
  useCreateReleasePlanState,
  useUpdateReleasePlanState,
  useDeactivateReleasePlanState,
  useRestoreReleasePlanState,
} from "@/hooks/useReleasePlans";
import type { ReleasePlanState } from "@/api/release-plans";
import type { ControlParameterWithUsage, ControlParameterRule } from "@/api/control-parameters";

const requestTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required").max(50),
});

const requestStateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  category: z.enum(["Draft", "In Progress", "Ready", "Done", "Cancelled"]),
});

const prioritySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  level: z.number().int().min(1).max(5),
});

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
});

type RequestTypeFormData = z.infer<typeof requestTypeSchema>;
type RequestStateFormData = z.infer<typeof requestStateSchema>;
type PriorityFormData = z.infer<typeof prioritySchema>;
type CategoryFormData = z.infer<typeof categorySchema>;

interface TabConfig {
  key: ControlParameterType;
  label: string;
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>;
}

const TAB_CONFIGS: TabConfig[] = [
  { key: "request-types", label: "DR Request Types", schema: requestTypeSchema },
  { key: "request-states", label: "DR Request States", schema: requestStateSchema },
  { key: "priorities", label: "DR Priorities", schema: prioritySchema },
  { key: "functional-categories", label: "DR Functional Categories", schema: categorySchema },
  { key: "rules", label: "DR State-Type Rules", schema: categorySchema },
];

function getActiveTypeIdsForState(rules: ControlParameterRule[] | undefined, stateId: number): number[] {
  if (!rules) return [];

  return rules
    .filter((rule) => rule.request_state_id === stateId && rule.is_active)
    .map((rule) => rule.request_type_id)
    .sort((a, b) => a - b);
}

function areTypeSelectionsEqual(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}


function ParameterRow({
  item,
  onArchive,
  onRestore,
  onEdit,
}: {
  item: ControlParameterWithUsage;
  onArchive: () => void;
  onRestore: () => void;
  onEdit: () => void;
}) {
  return (
    <TableRow className={cn(!item.is_active && "opacity-60")}>
      <TableCell>
        <div className="flex items-center gap-2">
          {item.name}
          {!item.is_active && (
            <Badge variant="secondary" className="text-xs">Archived</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">{item.description || "-"}</TableCell>
      {item.category !== undefined && (
        <TableCell className="hidden lg:table-cell">
          {item.category && <Badge variant="outline">{item.category}</Badge>}
        </TableCell>
      )}
      {item.level !== undefined && (
        <TableCell className="hidden lg:table-cell">{item.level}</TableCell>
      )}
      <TableCell className="text-center">
        {item.usage_count > 0 && (
          <span className="text-sm text-muted-foreground">
            {item.usage_count} request{item.usage_count !== 1 ? "s" : ""}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {item.is_active && (
            <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {item.is_active ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onArchive}
              disabled={item.usage_count > 0}
              title={item.usage_count > 0 ? "Cannot archive: used by requests" : "Archive"}
            >
              {item.usage_count > 0 ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={onRestore} title="Restore">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function RequestTypeTab({ showArchived }: { showArchived: boolean }) {
  const { data: items, isLoading, error } = useControlParameterList("request-types");
  const createMutation = useCreateControlParameter();
  const archiveMutation = useArchiveControlParameter();
  const restoreMutation = useRestoreControlParameter();
  const updateMutation = useUpdateControlParameter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ControlParameterWithUsage | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [page, setPage] = useState(1);

  const form = useForm<RequestTypeFormData>({
    resolver: zodResolver(requestTypeSchema),
    defaultValues: { name: "", description: "", category: "" },
  });

  const editForm = useForm<RequestTypeFormData>({
    resolver: zodResolver(requestTypeSchema),
    defaultValues: { name: "", description: "", category: "" },
  });

  const onSubmit = async (data: RequestTypeFormData) => {
    try {
      await createMutation.mutateAsync({ paramType: "request-types", data });
      setIsSheetOpen(false);
      form.reset();
    } catch {
      // Error handled by mutation
    }
  };

  const onEditSubmit = async (data: RequestTypeFormData) => {
    if (!editingItem) return;
    try {
      await updateMutation.mutateAsync({
        paramType: "request-types",
        id: editingItem.id,
        data: { name: data.name, description: data.description },
      });
      setIsEditSheetOpen(false);
      setEditingItem(null);
      editForm.reset();
    } catch {
      // Error handled by mutation
    }
  };

  const handleEdit = (item: ControlParameterWithUsage) => {
    setEditingItem(item);
    editForm.reset({
      name: item.name,
      description: item.description || "",
      category: (item.category as RequestTypeFormData["category"]) || "feature",
    });
    setIsEditSheetOpen(true);
  };

  const filteredItems = showArchived ? items : items?.filter((item) => item.is_active);

  return (
    <TabsContent value="request-types" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>DR Request Types</CardTitle>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Type
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add DR Request Type</SheetTitle>
                  <SheetDescription>Create a new development request type</SheetDescription>
                </SheetHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" {...form.register("name")} />
                    {form.formState.errors.name && (
                      <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" {...form.register("description")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <select
                      id="category"
                      {...form.register("category")}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="feature">Feature</option>
                      <option value="bugfix">Bugfix</option>
                      <option value="improvement">Improvement</option>
                      <option value="other">Other</option>
                    </select>
                    {form.formState.errors.category && (
                      <p className="text-sm text-red-500">{form.formState.errors.category.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          <TableContent 
            items={filteredItems} 
            isLoading={isLoading} 
            error={error} 
            type="request-types"
            page={page}
            setPage={setPage}
            onArchive={(id) => archiveMutation.mutate({ paramType: "request-types", id })}
            onRestore={(id) => restoreMutation.mutate({ paramType: "request-types", id })}
            onEdit={handleEdit}
          />
        </CardContent>
      </Card>

      {/* Edit Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit DR Request Type</SheetTitle>
            <SheetDescription>Update name and description (category is read-only)</SheetDescription>
          </SheetHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input 
                id="edit-name" 
                {...editForm.register("name")}
              />
              {editForm.formState.errors.name && (
                <p className="text-sm text-red-500">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input 
                id="edit-description" 
                {...editForm.register("description")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category (read-only)</Label>
              <Input id="edit-category" value={editingItem?.category || ""} disabled className="opacity-60" />
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </TabsContent>
  );
}

function RequestStateTab({ showArchived }: { showArchived: boolean }) {
  const { data: items, isLoading, error } = useControlParameterList("request-states");
  const createMutation = useCreateControlParameter();
  const archiveMutation = useArchiveControlParameter();
  const restoreMutation = useRestoreControlParameter();
  const updateMutation = useUpdateControlParameter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ControlParameterWithUsage | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [page, setPage] = useState(1);

  const form = useForm<RequestStateFormData>({
    resolver: zodResolver(requestStateSchema),
    defaultValues: { name: "", description: "", category: "Draft" },
  });

  const editForm = useForm<RequestStateFormData>({
    resolver: zodResolver(requestStateSchema),
    defaultValues: { name: "", description: "", category: "Draft" },
  });

  const onSubmit = async (data: RequestStateFormData) => {
    try {
      await createMutation.mutateAsync({ paramType: "request-states", data });
      setIsSheetOpen(false);
      form.reset();
    } catch {
      // Error handled by mutation
    }
  };

  const onEditSubmit = async (data: RequestStateFormData) => {
    if (!editingItem) return;
    try {
      await updateMutation.mutateAsync({
        paramType: "request-states",
        id: editingItem.id,
        data: { name: data.name, description: data.description },
      });
      setIsEditSheetOpen(false);
      setEditingItem(null);
      editForm.reset();
    } catch {
      // Error handled by mutation
    }
  };

  const handleEdit = (item: ControlParameterWithUsage) => {
    setEditingItem(item);
    editForm.reset({
      name: item.name,
      description: item.description || "",
      category: (item.category as RequestStateFormData["category"]) || "Draft",
    });
    setIsEditSheetOpen(true);
  };

  const filteredItems = showArchived ? items : items?.filter((item) => item.is_active);

  return (
    <TabsContent value="request-states" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>DR Request States</CardTitle>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add State
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add DR Request State</SheetTitle>
                  <SheetDescription>Create a new development request state</SheetDescription>
                </SheetHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" {...form.register("name")} />
                    {form.formState.errors.name && (
                      <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" {...form.register("description")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <select
                      id="category"
                      {...form.register("category")}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="Draft">Draft</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Ready">Ready</option>
                      <option value="Done">Done</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          <TableContent 
            items={filteredItems} 
            isLoading={isLoading} 
            error={error} 
            type="request-states"
            page={page}
            setPage={setPage}
            onArchive={(id) => archiveMutation.mutate({ paramType: "request-states", id })}
            onRestore={(id) => restoreMutation.mutate({ paramType: "request-states", id })}
            onEdit={handleEdit}
          />
        </CardContent>
      </Card>

      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit DR Request State</SheetTitle>
            <SheetDescription>Update name and description (category is read-only)</SheetDescription>
          </SheetHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input 
                id="edit-name" 
                {...editForm.register("name")}
              />
              {editForm.formState.errors.name && (
                <p className="text-sm text-red-500">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input 
                id="edit-description" 
                {...editForm.register("description")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category (read-only)</Label>
              <Input id="edit-category" value={editingItem?.category || ""} disabled className="opacity-60" />
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </TabsContent>
  );
}

function PriorityTab({ showArchived }: { showArchived: boolean }) {
  const { data: items, isLoading, error } = useControlParameterList("priorities");
  const createMutation = useCreateControlParameter();
  const archiveMutation = useArchiveControlParameter();
  const restoreMutation = useRestoreControlParameter();
  const updateMutation = useUpdateControlParameter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ControlParameterWithUsage | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [page, setPage] = useState(1);

  const form = useForm<PriorityFormData>({
    resolver: zodResolver(prioritySchema),
    defaultValues: { name: "", level: 3 },
  });

  const editForm = useForm<PriorityFormData>({
    resolver: zodResolver(prioritySchema),
    defaultValues: { name: "", level: 3 },
  });

  const onSubmit = async (data: PriorityFormData) => {
    try {
      await createMutation.mutateAsync({ paramType: "priorities", data });
      setIsSheetOpen(false);
      form.reset();
    } catch {
      // Error handled by mutation
    }
  };

  const onEditSubmit = async (data: PriorityFormData) => {
    if (!editingItem) return;
    try {
      await updateMutation.mutateAsync({
        paramType: "priorities",
        id: editingItem.id,
        data: { name: data.name },
      });
      setIsEditSheetOpen(false);
      setEditingItem(null);
      editForm.reset();
    } catch {
      // Error handled by mutation
    }
  };

  const handleEdit = (item: ControlParameterWithUsage) => {
    setEditingItem(item);
    editForm.reset({
      name: item.name,
      level: item.level ?? 3,
    });
    setIsEditSheetOpen(true);
  };

  const filteredItems = showArchived ? items : items?.filter((item) => item.is_active);

  return (
    <TabsContent value="priorities" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>DR Priorities</CardTitle>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Priority
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add DR Priority</SheetTitle>
                  <SheetDescription>Create a new development request priority level</SheetDescription>
                </SheetHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" {...form.register("name")} />
                    {form.formState.errors.name && (
                      <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="level">Level (1-5)</Label>
                    <Input id="level" type="number" min={1} max={5} {...form.register("level", { valueAsNumber: true })} />
                    {form.formState.errors.level && (
                      <p className="text-sm text-red-500">{form.formState.errors.level.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          <TableContent 
            items={filteredItems} 
            isLoading={isLoading} 
            error={error} 
            type="priorities"
            page={page}
            setPage={setPage}
            onArchive={(id) => archiveMutation.mutate({ paramType: "priorities", id })}
            onRestore={(id) => restoreMutation.mutate({ paramType: "priorities", id })}
            onEdit={handleEdit}
          />
        </CardContent>
      </Card>

      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit DR Priority</SheetTitle>
            <SheetDescription>Update name (level is read-only)</SheetDescription>
          </SheetHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input 
                id="edit-name" 
                {...editForm.register("name")}
              />
              {editForm.formState.errors.name && (
                <p className="text-sm text-red-500">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-level">Level (read-only)</Label>
              <Input id="edit-level" value={editingItem?.level || ""} disabled className="opacity-60" />
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </TabsContent>
  );
}

function CategoryTab({ showArchived }: { showArchived: boolean }) {
  const { data: items, isLoading, error } = useControlParameterList("functional-categories");
  const createMutation = useCreateControlParameter();
  const archiveMutation = useArchiveControlParameter();
  const restoreMutation = useRestoreControlParameter();
  const updateMutation = useUpdateControlParameter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ControlParameterWithUsage | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [page, setPage] = useState(1);

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", description: "" },
  });

  const editForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = async (data: CategoryFormData) => {
    try {
      await createMutation.mutateAsync({ paramType: "functional-categories", data });
      setIsSheetOpen(false);
      form.reset();
    } catch {
      // Error handled by mutation
    }
  };

  const onEditSubmit = async (data: CategoryFormData) => {
    if (!editingItem) return;
    try {
      await updateMutation.mutateAsync({
        paramType: "functional-categories",
        id: editingItem.id,
        data: { name: data.name, description: data.description },
      });
      setIsEditSheetOpen(false);
      setEditingItem(null);
      editForm.reset();
    } catch {
      // Error handled by mutation
    }
  };

  const handleEdit = (item: ControlParameterWithUsage) => {
    setEditingItem(item);
    editForm.reset({
      name: item.name,
      description: item.description || "",
    });
    setIsEditSheetOpen(true);
  };

  const filteredItems = showArchived ? items : items?.filter((item) => item.is_active);

  return (
    <TabsContent value="functional-categories" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>DR Functional Categories</CardTitle>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add DR Functional Category</SheetTitle>
                  <SheetDescription>Create a new development request functional category</SheetDescription>
                </SheetHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" {...form.register("name")} />
                    {form.formState.errors.name && (
                      <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" {...form.register("description")} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          <TableContent 
            items={filteredItems} 
            isLoading={isLoading} 
            error={error} 
            type="functional-categories"
            page={page}
            setPage={setPage}
            onArchive={(id) => archiveMutation.mutate({ paramType: "functional-categories", id })}
            onRestore={(id) => restoreMutation.mutate({ paramType: "functional-categories", id })}
            onEdit={handleEdit}
          />
        </CardContent>
      </Card>

      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit DR Functional Category</SheetTitle>
            <SheetDescription>Update name and description</SheetDescription>
          </SheetHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input 
                id="edit-name" 
                {...editForm.register("name")}
              />
              {editForm.formState.errors.name && (
                <p className="text-sm text-red-500">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input 
                id="edit-description" 
                {...editForm.register("description")}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </TabsContent>
  );
}

function TableContent({
  items,
  isLoading,
  error,
  type,
  onArchive,
  onRestore,
  onEdit,
  page = 1,
  setPage,
  limit = 5,
}: {
  items?: ControlParameterWithUsage[];
  isLoading: boolean;
  error: unknown;
  type: string;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
  onEdit: (item: ControlParameterWithUsage) => void;
  page?: number;
  setPage?: (page: number) => void;
  limit?: number;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error loading {type}</div>;
  }

  if (!items?.length) {
    return <div className="text-center py-8 text-muted-foreground">No items found</div>;
  }

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / limit);
  const startIndex = (page - 1) * limit;
  const paginatedItems = items.slice(startIndex, startIndex + limit);

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              {type === "request-types" && <TableHead className="hidden lg:table-cell">Category</TableHead>}
              {type === "request-states" && <TableHead className="hidden lg:table-cell">State Category</TableHead>}
              {type === "priorities" && <TableHead className="hidden lg:table-cell">Level</TableHead>}
              <TableHead className="text-center">Count</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.map((item) => (
              <ParameterRow
                key={item.id}
                item={item}
                onArchive={() => onArchive(item.id)}
                onRestore={() => onRestore(item.id)}
                onEdit={() => onEdit(item)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      {setPage && totalPages > 1 && (
        <Pagination
          page={page}
          limit={limit}
          total={totalItems}
          pages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function RulesTab() {
  const { data: rules, isLoading, error } = useControlParameterRules();
  const { data: requestTypes = [] } = useControlParameterList("request-types");
  const { data: requestStates = [] } = useControlParameterList("request-states");
  const createMutation = useCreateControlParameterRule();
  const toggleMutation = useToggleControlParameterRule();
  const [pendingSelections, setPendingSelections] = useState<Record<number, number[]>>({});
  const [savingStateId, setSavingStateId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const limit = 5;

  const paginatedStates = requestStates.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(requestStates.length / limit);

  const getSelectedTypeIds = (stateId: number) => pendingSelections[stateId] ?? getActiveTypeIdsForState(rules, stateId);

  const handleSelectionChange = (stateId: number, selectedTypeNames: string[]) => {
    const typeIds = requestTypes
      .filter((type) => selectedTypeNames.includes(type.name))
      .map((type) => type.id)
      .sort((a, b) => a - b);

    setPendingSelections((current) => ({
      ...current,
      [stateId]: typeIds,
    }));
  };

  const handleReset = (stateId: number) => {
    setPendingSelections((current) => {
      const next = { ...current };
      delete next[stateId];
      return next;
    });
  };

  const handleSave = async (stateId: number) => {
    if (!rules) return;

    const selectedTypeIds = getSelectedTypeIds(stateId);
    const activeTypeIds = getActiveTypeIdsForState(rules, stateId);

    if (areTypeSelectionsEqual(selectedTypeIds, activeTypeIds)) {
      return;
    }

    const stateRules = rules.filter((rule) => rule.request_state_id === stateId);
    const activeTypeSet = new Set(activeTypeIds);
    const selectedTypeSet = new Set(selectedTypeIds);
    const toDisable = stateRules.filter((rule) => rule.is_active && !selectedTypeSet.has(rule.request_type_id));
    const toEnable = selectedTypeIds.filter((typeId) => !activeTypeSet.has(typeId));

    try {
      setSavingStateId(stateId);

      for (const rule of toDisable) {
        await toggleMutation.mutateAsync(rule.id);
      }

      for (const typeId of toEnable) {
        const existingRule = stateRules.find((rule) => rule.request_type_id === typeId);
        if (existingRule) {
          if (!existingRule.is_active) {
            await toggleMutation.mutateAsync(existingRule.id);
          }
          continue;
        }

        await createMutation.mutateAsync({
          request_state_id: stateId,
          request_type_id: typeId,
        });
      }

      setPendingSelections((current) => {
        const next = { ...current };
        delete next[stateId];
        return next;
      });
      toast.success("DR state-type rules updated successfully");
    } catch {
      // Error handled by mutations
    } finally {
      setSavingStateId(null);
    }
  };

  return (
    <TabsContent value="rules" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>DR State-Type Rules</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure allowed DR request types for each DR request state.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">Error loading rules</div>
          ) : !requestStates.length ? (
            <div className="text-center py-8 text-muted-foreground">No DR request states found</div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DR Request State</TableHead>
                      <TableHead className="hidden md:table-cell">DR State Macro</TableHead>
                      <TableHead className="min-w-[280px]">Allowed DR Request Types</TableHead>
                      <TableHead className="hidden lg:table-cell">Active Rules</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStates.map((state) => {
                      const selectedTypeIds = getSelectedTypeIds(state.id);
                      const activeTypeIds = getActiveTypeIdsForState(rules, state.id);
                      const selectedTypeNames = requestTypes
                        .filter((type) => selectedTypeIds.includes(type.id))
                        .map((type) => type.name);
                      const hasChanges = !areTypeSelectionsEqual(selectedTypeIds, activeTypeIds);
                      const isSaving = savingStateId === state.id;

                      return (
                        <TableRow key={state.id} className={!state.is_active ? "opacity-60" : undefined}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {state.name}
                              {!state.is_active && <Badge variant="secondary" className="text-xs">Archived</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{state.category}</TableCell>
                          <TableCell>
                            <SearchableMultiSelect
                              options={requestTypes.filter((type) => type.is_active).map((type) => type.name)}
                              selected={selectedTypeNames}
                              onChange={(values) => handleSelectionChange(state.id, values)}
                              allLabel="Select DR request types"
                              searchPlaceholder="Search DR request types..."
                              triggerWidth="w-full"
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant="outline">{activeTypeIds.length}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReset(state.id)}
                                disabled={isSaving || !hasChanges}
                              >
                                Reset
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSave(state.id)}
                                disabled={isSaving || !hasChanges}
                              >
                                {isSaving ? "Saving..." : "Save"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <Pagination
                  page={page}
                  limit={limit}
                  total={requestStates.length}
                  pages={totalPages}
                  onPageChange={setPage}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

const RELEASE_PLAN_STATE_CATEGORIES = ["Draft", "Planned", "Approved", "Executing", "Closed", "Failed"];

function ReleasePlanStatesTab() {
  const { data: states, isLoading, error } = useReleasePlanStatesAll();
  const createMutation = useCreateReleasePlanState();
  const updateMutation = useUpdateReleasePlanState();
  const deactivateMutation = useDeactivateReleasePlanState();
  const restoreMutation = useRestoreReleasePlanState();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingState, setEditingState] = useState<ReleasePlanState | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 5;

  const createForm = useForm<{ name: string; description: string; category: string; display_order: number }>({
    defaultValues: { name: "", description: "", category: "Draft", display_order: 0 },
  });

  const editForm = useForm<{ name: string; description: string; category: string; display_order: number }>({
    defaultValues: { name: "", description: "", category: "Draft", display_order: 0 },
  });

  const onSubmit = async (data: { name: string; description: string; category: string; display_order: number }) => {
    try {
      await createMutation.mutateAsync(data);
      setIsSheetOpen(false);
      createForm.reset();
    } catch { /* handled by mutation */ }
  };

  const onEditSubmit = async (data: { name: string; description: string; category: string; display_order: number }) => {
    if (!editingState) return;
    try {
      await updateMutation.mutateAsync({ id: editingState.id, data });
      setIsEditSheetOpen(false);
      setEditingState(null);
    } catch { /* handled by mutation */ }
  };

  const handleEdit = (state: ReleasePlanState) => {
    setEditingState(state);
    editForm.reset({
      name: state.name,
      description: state.description || "",
      category: state.category,
      display_order: state.display_order,
    });
    setIsEditSheetOpen(true);
  };

  const paginatedStates = states?.slice((page - 1) * limit, page * limit) ?? [];
  const totalPages = Math.ceil((states?.length ?? 0) / limit);

  return (
    <TabsContent value="release-plan-states" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Release Plan States</CardTitle>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add State</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add Release Plan State</SheetTitle>
                  <SheetDescription>Create a new release plan state</SheetDescription>
                </SheetHeader>
                <form onSubmit={createForm.handleSubmit(onSubmit)} className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input {...createForm.register("name", { required: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input {...createForm.register("description")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <select {...createForm.register("category")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {RELEASE_PLAN_STATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Display Order</Label>
                    <Input type="number" {...createForm.register("display_order", { valueAsNumber: true })} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">Error loading release plan states</div>
          ) : !states?.length ? (
            <div className="text-center py-8 text-muted-foreground">No release plan states found</div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                      <TableHead className="hidden lg:table-cell">Category</TableHead>
                      <TableHead className="hidden lg:table-cell">Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStates.map((state) => (
                      <TableRow key={state.id} className={!state.is_active ? "opacity-60" : undefined}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {state.name}
                            {!state.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{state.description || "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="outline">{state.category}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{state.display_order}</TableCell>
                        <TableCell>
                          <Badge variant={state.is_active ? "default" : "secondary"}>
                            {state.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {state.is_active && (
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(state)} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {state.is_active ? (
                              <Button variant="ghost" size="icon" onClick={() => deactivateMutation.mutate(state.id)} title="Deactivate">
                                <Archive className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={() => restoreMutation.mutate(state.id)} title="Restore">
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <Pagination page={page} limit={limit} total={states.length} pages={totalPages} onPageChange={setPage} />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Release Plan State</SheetTitle>
            <SheetDescription>Update name, description, category, and display order</SheetDescription>
          </SheetHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...editForm.register("name", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input {...editForm.register("description")} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select {...editForm.register("category")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {RELEASE_PLAN_STATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input type="number" {...editForm.register("display_order", { valueAsNumber: true })} />
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </TabsContent>
  );
}

export function SettingsControlParametersPage() {
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Control Parameters</h2>
          <p className="text-muted-foreground">Manage DR workflow parameters and release plan states</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Show Archived</span>
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
        </div>
      </div>

      <Tabs defaultValue="request-types" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          {TAB_CONFIGS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="release-plan-states">Release Plan States</TabsTrigger>
        </TabsList>

        <RequestTypeTab showArchived={showArchived} />
        <RequestStateTab showArchived={showArchived} />
        <PriorityTab showArchived={showArchived} />
        <CategoryTab showArchived={showArchived} />
        <RulesTab />
        <ReleasePlanStatesTab />
      </Tabs>
    </div>
  );
}
