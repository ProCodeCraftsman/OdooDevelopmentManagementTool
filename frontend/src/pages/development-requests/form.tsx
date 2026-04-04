import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
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
  useDevelopmentRequest,
  useControlParameters,
  useCreateDevelopmentRequest,
  useUpdateDevelopmentRequest,
} from "@/hooks/useDevelopmentRequests";
import type { DevelopmentRequestCreate, DevelopmentRequestUpdate } from "@/api/development-requests";
import { toast } from "sonner";

const formSchema = z.object({
  request_type_id: z.number().min(1, "Request type is required"),
  functional_category_id: z.number().min(1, "Category is required"),
  priority_id: z.number().min(1, "Priority is required"),
  description: z.string().min(1, "Description is required"),
  comments: z.string().optional(),
  uat_request_id: z.string().optional(),
  assigned_developer_id: z.number().optional(),
  request_state_id: z.number().optional(),
  parent_request_id: z.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function DevelopmentRequestsFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const requestId = parseInt(id || "0");

  const { data: existingRequest, isLoading: isLoadingRequest } = useDevelopmentRequest(requestId);
  const { data: controlParams, isLoading: isLoadingParams } = useControlParameters();
  const createMutation = useCreateDevelopmentRequest();
  const updateMutation = useUpdateDevelopmentRequest();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      comments: "",
    },
  });

  useEffect(() => {
    if (existingRequest && isEditing) {
      reset({
        request_type_id: existingRequest.request_type_id,
        functional_category_id: existingRequest.functional_category_id,
        priority_id: existingRequest.priority_id,
        description: existingRequest.description,
        comments: existingRequest.comments || "",
        uat_request_id: existingRequest.uat_request_id || "",
        assigned_developer_id: existingRequest.assigned_developer_id || undefined,
        request_state_id: existingRequest.request_state_id || undefined,
        parent_request_id: existingRequest.parent_request_id || undefined,
      });
    }
  }, [existingRequest, isEditing, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditing) {
        const updateData: DevelopmentRequestUpdate = {
          request_type_id: data.request_type_id,
          functional_category_id: data.functional_category_id,
          priority_id: data.priority_id,
          description: data.description,
          comments: data.comments,
          uat_request_id: data.uat_request_id,
          assigned_developer_id: data.assigned_developer_id,
          request_state_id: data.request_state_id,
          parent_request_id: data.parent_request_id,
        };
        await updateMutation.mutateAsync({ id: requestId, data: updateData });
        toast.success("Request updated successfully");
      } else {
        const createData: DevelopmentRequestCreate = {
          request_type_id: data.request_type_id,
          functional_category_id: data.functional_category_id,
          priority_id: data.priority_id,
          description: data.description,
          comments: data.comments,
          uat_request_id: data.uat_request_id,
          assigned_developer_id: data.assigned_developer_id,
          parent_request_id: data.parent_request_id,
        };
        await createMutation.mutateAsync(createData);
        toast.success("Request created successfully");
      }
      navigate("/development-requests");
    } catch {
      toast.error(`Failed to ${isEditing ? "update" : "create"} request`);
    }
  };

  if (isLoadingRequest || isLoadingParams) {
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
          <Link to={isEditing ? `/development-requests/${id}` : "/development-requests"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">
          {isEditing ? "Edit Request" : "New Development Request"}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Request Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="request_type_id">Request Type *</Label>
                <Select
                  value={watch("request_type_id")?.toString() || ""}
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
                  <p className="text-sm text-red-500">{errors.request_type_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority_id">Priority *</Label>
                <Select
                  value={watch("priority_id")?.toString() || ""}
                  onValueChange={(v) => setValue("priority_id", parseInt(v))}
                >
                  <SelectTrigger id="priority_id">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {controlParams?.priorities.map((priority) => (
                      <SelectItem key={priority.id} value={priority.id.toString()}>
                        {priority.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.priority_id && (
                  <p className="text-sm text-red-500">{errors.priority_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="functional_category_id">Category *</Label>
                <Select
                  value={watch("functional_category_id")?.toString() || ""}
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
                  <p className="text-sm text-red-500">
                    {errors.functional_category_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned_developer_id">Assignee</Label>
                <Input
                  id="assigned_developer_id"
                  type="number"
                  placeholder="Developer ID (optional)"
                  {...register("assigned_developer_id", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the request..."
                className="min-h-[150px]"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                placeholder="Additional comments..."
                className="min-h-[100px]"
                {...register("comments")}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="uat_request_id">UAT Request ID</Label>
                <Input
                  id="uat_request_id"
                  placeholder="UAT-XXXX (optional)"
                  {...register("uat_request_id")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent_request_id">Parent Request ID</Label>
                <Input
                  id="parent_request_id"
                  type="number"
                  placeholder="Parent request ID (optional)"
                  {...register("parent_request_id", { valueAsNumber: true })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate(isEditing ? `/development-requests/${id}` : "/development-requests")
            }
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Saving..."
              : isEditing
                ? "Update Request"
                : "Create Request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
