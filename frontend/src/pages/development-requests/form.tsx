import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useControlParameters,
  useCreateDevelopmentRequest,
} from "@/hooks/useDevelopmentRequests";
import { useAssignableUsers } from "@/hooks/useUsers";
import type { DevelopmentRequestCreate } from "@/api/development-requests";
import { toast } from "sonner";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title must be under 255 characters"),
  request_type_id: z.number().min(1, "Request type is required"),
  functional_category_id: z.number().min(1, "Category is required"),
  priority_id: z.number().min(1, "Priority is required"),
  assigned_developer_id: z.number().optional(),
  description: z.string().min(1, "Description is required"),
});

type FormData = z.infer<typeof formSchema>;

export function DevelopmentRequestsFormPage() {
  const navigate = useNavigate();

  const { data: controlParams, isLoading: isLoadingParams } = useControlParameters();
  const { data: assignableUsers } = useAssignableUsers();
  const createMutation = useCreateDevelopmentRequest();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { description: "" },
  });

  const requestTypeId = useWatch({ control, name: "request_type_id" });
  const functionalCategoryId = useWatch({ control, name: "functional_category_id" });
  const priorityId = useWatch({ control, name: "priority_id" });
  const assignedDeveloperId = useWatch({ control, name: "assigned_developer_id" });

  const onSubmit = async (data: FormData) => {
    try {
      const createData: DevelopmentRequestCreate = {
        title: data.title,
        request_type_id: data.request_type_id,
        functional_category_id: data.functional_category_id,
        priority_id: data.priority_id,
        description: data.description,
        assigned_developer_id: data.assigned_developer_id,
      };
      await createMutation.mutateAsync(createData);
      navigate("/development-requests");
    } catch {
      toast.error("Failed to create request");
    }
  };

  if (isLoadingParams) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-[300px]" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link to="/development-requests">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">New Development Request</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Request Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title — full width, first */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Brief summary of the request"
                {...register("title")}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="request_type_id">Request Type *</Label>
                <Select
                  value={requestTypeId?.toString() || ""}
                  onValueChange={(v) => setValue("request_type_id", parseInt(v))}
                >
                  <SelectTrigger id="request_type_id">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {controlParams?.request_types.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name} ({type.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.request_type_id && (
                  <p className="text-sm text-destructive">{errors.request_type_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="functional_category_id">Functional Category *</Label>
                <Select
                  value={functionalCategoryId?.toString() || ""}
                  onValueChange={(v) => setValue("functional_category_id", parseInt(v))}
                >
                  <SelectTrigger id="functional_category_id">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {controlParams?.functional_categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.functional_category_id && (
                  <p className="text-sm text-destructive">
                    {errors.functional_category_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority_id">Priority *</Label>
                <Select
                  value={priorityId?.toString() || ""}
                  onValueChange={(v) => setValue("priority_id", parseInt(v))}
                >
                  <SelectTrigger id="priority_id">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {controlParams?.priorities.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.priority_id && (
                  <p className="text-sm text-destructive">{errors.priority_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned_developer_id">Assignee</Label>
                <Select
                  value={assignedDeveloperId?.toString() || "none"}
                  onValueChange={(v) =>
                    setValue("assigned_developer_id", v === "none" ? undefined : parseInt(v))
                  }
                >
                  <SelectTrigger id="assigned_developer_id">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {assignableUsers?.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the request in detail..."
                className="min-h-[150px]"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/development-requests")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
