import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, RotateCcw, Archive, AlertTriangle } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  useControlParameterList,
  useCreateControlParameter,
  useArchiveControlParameter,
  useRestoreControlParameter,
  type ControlParameterType,
} from "@/hooks/useControlParameters";
import type { ControlParameterWithUsage } from "@/api/control-parameters";

const requestTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required").max(50),
});

const requestStateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  category: z.enum(["open", "in_progress", "closed", "cancelled"]),
});

const prioritySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
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
  { key: "request-types", label: "Request Types", schema: requestTypeSchema },
  { key: "request-states", label: "Request States", schema: requestStateSchema },
  { key: "priorities", label: "Priorities", schema: prioritySchema },
  { key: "functional-categories", label: "Categories", schema: categorySchema },
];

function ParameterRow({
  item,
  onArchive,
  onRestore,
}: {
  item: ControlParameterWithUsage;
  onArchive: () => void;
  onRestore: () => void;
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
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const form = useForm<RequestTypeFormData>({
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

  const filteredItems = showArchived ? items : items?.filter((item) => item.is_active);

  return (
    <TabsContent value="request-types" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Request Types</CardTitle>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Type
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add Request Type</SheetTitle>
                  <SheetDescription>Create a new request type</SheetDescription>
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
          <TableContent items={filteredItems} isLoading={isLoading} error={error} type="request-types"
            onArchive={(id) => archiveMutation.mutate({ paramType: "request-types", id })}
            onRestore={(id) => restoreMutation.mutate({ paramType: "request-types", id })}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function RequestStateTab({ showArchived }: { showArchived: boolean }) {
  const { data: items, isLoading, error } = useControlParameterList("request-states");
  const createMutation = useCreateControlParameter();
  const archiveMutation = useArchiveControlParameter();
  const restoreMutation = useRestoreControlParameter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const form = useForm<RequestStateFormData>({
    resolver: zodResolver(requestStateSchema),
    defaultValues: { name: "", description: "", category: "open" },
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

  const filteredItems = showArchived ? items : items?.filter((item) => item.is_active);

  return (
    <TabsContent value="request-states" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Request States</CardTitle>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add State
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add Request State</SheetTitle>
                  <SheetDescription>Create a new request state</SheetDescription>
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
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="closed">Closed</option>
                      <option value="cancelled">Cancelled</option>
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
          <TableContent items={filteredItems} isLoading={isLoading} error={error} type="request-states"
            onArchive={(id) => archiveMutation.mutate({ paramType: "request-states", id })}
            onRestore={(id) => restoreMutation.mutate({ paramType: "request-states", id })}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function PriorityTab({ showArchived }: { showArchived: boolean }) {
  const { data: items, isLoading, error } = useControlParameterList("priorities");
  const createMutation = useCreateControlParameter();
  const archiveMutation = useArchiveControlParameter();
  const restoreMutation = useRestoreControlParameter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const form = useForm<PriorityFormData>({
    resolver: zodResolver(prioritySchema),
    defaultValues: { name: "", description: "", level: 3 },
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

  const filteredItems = showArchived ? items : items?.filter((item) => item.is_active);

  return (
    <TabsContent value="priorities" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Priorities</CardTitle>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Priority
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add Priority</SheetTitle>
                  <SheetDescription>Create a new priority level</SheetDescription>
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
          <TableContent items={filteredItems} isLoading={isLoading} error={error} type="priorities"
            onArchive={(id) => archiveMutation.mutate({ paramType: "priorities", id })}
            onRestore={(id) => restoreMutation.mutate({ paramType: "priorities", id })}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function CategoryTab({ showArchived }: { showArchived: boolean }) {
  const { data: items, isLoading, error } = useControlParameterList("functional-categories");
  const createMutation = useCreateControlParameter();
  const archiveMutation = useArchiveControlParameter();
  const restoreMutation = useRestoreControlParameter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const form = useForm<CategoryFormData>({
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

  const filteredItems = showArchived ? items : items?.filter((item) => item.is_active);

  return (
    <TabsContent value="functional-categories" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Functional Categories</CardTitle>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add Category</SheetTitle>
                  <SheetDescription>Create a new functional category</SheetDescription>
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
          <TableContent items={filteredItems} isLoading={isLoading} error={error} type="functional-categories"
            onArchive={(id) => archiveMutation.mutate({ paramType: "functional-categories", id })}
            onRestore={(id) => restoreMutation.mutate({ paramType: "functional-categories", id })}
          />
        </CardContent>
      </Card>
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
}: {
  items?: ControlParameterWithUsage[];
  isLoading: boolean;
  error: unknown;
  type: string;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
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

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Description</TableHead>
            {type === "request-types" && <TableHead className="hidden lg:table-cell">Category</TableHead>}
            {type === "request-states" && <TableHead className="hidden lg:table-cell">State Category</TableHead>}
            {type === "priorities" && <TableHead className="hidden lg:table-cell">Level</TableHead>}
            <TableHead className="text-center">Usage</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <ParameterRow
              key={item.id}
              item={item}
              onArchive={() => onArchive(item.id)}
              onRestore={() => onRestore(item.id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SettingsControlParametersPage() {
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Control Parameters</h2>
          <p className="text-muted-foreground">Manage request types, states, priorities, and categories</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Show Archived</span>
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
        </div>
      </div>

      <Tabs defaultValue="request-types" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {TAB_CONFIGS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <RequestTypeTab showArchived={showArchived} />
        <RequestStateTab showArchived={showArchived} />
        <PriorityTab showArchived={showArchived} />
        <CategoryTab showArchived={showArchived} />
      </Tabs>
    </div>
  );
}
