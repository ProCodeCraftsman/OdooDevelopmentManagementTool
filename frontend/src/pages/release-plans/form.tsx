import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
  useReleasePlan,
  useReleasePlanStates,
  useCreateReleasePlan,
  useUpdateReleasePlan,
} from "@/hooks/useReleasePlans";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useAssignableUsers } from "@/hooks/useUsers";
import type { ReleasePlanCreate, ReleasePlanUpdate } from "@/api/release-plans";

const formSchema = z.object({
  release_version: z.string().optional(),
  source_environment_id: z.number().min(1, "Source environment is required"),
  target_environment_id: z.number().min(1, "Target environment is required"),
  state_id: z.number().optional(),
  planned_deployment_date: z.string().optional(),
  release_notes: z.string().optional(),
  comments: z.string().optional(),
  approved_by_id: z.number().optional(),
  deployed_by_id: z.number().optional(),
  related_release_plan_id: z.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function ReleasePlanFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const planId = parseInt(id || "0");

  const { data: plan, isLoading: planLoading } = useReleasePlan(planId);
  const { data: states } = useReleasePlanStates();
  const { data: environments } = useEnvironments();
  const { data: users } = useAssignableUsers();
  const createPlan = useCreateReleasePlan();
  const updatePlan = useUpdateReleasePlan();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      release_notes: "",
      comments: "",
    },
  });

  useEffect(() => {
    if (plan && isEditing) {
      reset({
        release_version: plan.release_version,
        source_environment_id: plan.source_environment_id,
        target_environment_id: plan.target_environment_id,
        state_id: plan.state_id,
        planned_deployment_date: plan.planned_deployment_date
          ? plan.planned_deployment_date.split("T")[0]
          : undefined,
        release_notes: plan.release_notes ?? "",
        comments: plan.comments ?? "",
        approved_by_id: plan.approved_by_id ?? undefined,
        deployed_by_id: plan.deployed_by_id ?? undefined,
        related_release_plan_id: plan.related_release_plan_id ?? undefined,
      });
    }
  }, [plan, isEditing, reset]);

  const sourceEnvironmentId = useWatch({ control, name: "source_environment_id" });
  const targetEnvironmentId = useWatch({ control, name: "target_environment_id" });
  const stateId = useWatch({ control, name: "state_id" });
  const approvedById = useWatch({ control, name: "approved_by_id" });
  const deployedById = useWatch({ control, name: "deployed_by_id" });

  const onSubmit = async (formData: FormData) => {
    try {
      const payload = {
        ...formData,
        planned_deployment_date: formData.planned_deployment_date
          ? new Date(formData.planned_deployment_date).toISOString()
          : undefined,
      };

      if (isEditing) {
        await updatePlan.mutateAsync({ id: planId, data: payload as ReleasePlanUpdate });
        navigate(`/release-plans/${planId}`);
      } else {
        const result = await createPlan.mutateAsync(payload as ReleasePlanCreate);
        navigate(`/release-plans/${result.id}`);
      }
    } catch {
      // Error already handled in hook
    }
  };

  if (isEditing && planLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={isEditing ? `/release-plans/${planId}` : "/release-plans"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? `Edit ${plan?.plan_number ?? ""}` : "New Release Plan"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isEditing ? "Modify release plan details" : "Create a new deployment plan"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Release Plan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Release Version — auto-generated on create, read-only on edit */}
            {isEditing && (
              <div className="space-y-1.5">
                <Label htmlFor="release_version">Release Version</Label>
                <Input
                  id="release_version"
                  readOnly
                  disabled
                  value={plan?.release_version ?? ""}
                />
              </div>
            )}

            {/* Environments */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  Source Environment <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={sourceEnvironmentId?.toString() ?? ""}
                  onValueChange={(v) => setValue("source_environment_id", parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {environments?.map((env) => (
                      <SelectItem key={env.id} value={env.id.toString()}>
                        {env.name}
                        <span className="ml-1 text-xs text-muted-foreground">({env.category})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.source_environment_id && (
                  <p className="text-sm text-destructive">{errors.source_environment_id.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>
                  Target Environment <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={targetEnvironmentId?.toString() ?? ""}
                  onValueChange={(v) => setValue("target_environment_id", parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    {environments?.map((env) => (
                      <SelectItem key={env.id} value={env.id.toString()}>
                        {env.name}
                        <span className="ml-1 text-xs text-muted-foreground">({env.category})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.target_environment_id && (
                  <p className="text-sm text-destructive">{errors.target_environment_id.message}</p>
                )}
              </div>
            </div>

            {/* State (edit only) */}
            {isEditing && (
              <div className="space-y-1.5">
                <Label>State</Label>
                <Select
                  value={stateId?.toString() ?? ""}
                  onValueChange={(v) => setValue("state_id", parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states?.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                        <span className="ml-1 text-xs text-muted-foreground">({s.category})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Planned Date */}
            <div className="space-y-1.5">
              <Label htmlFor="planned_deployment_date">Planned Deployment Date</Label>
              <Input
                id="planned_deployment_date"
                type="date"
                {...register("planned_deployment_date")}
              />
            </div>

            {/* Approved By / Deployed By */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Approved By</Label>
                <Select
                  value={approvedById?.toString() ?? "none"}
                  onValueChange={(v) =>
                    setValue("approved_by_id", v === "none" ? undefined : parseInt(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {users?.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Deployed By (Server Admin)</Label>
                <Select
                  value={deployedById?.toString() ?? "none"}
                  onValueChange={(v) =>
                    setValue("deployed_by_id", v === "none" ? undefined : parseInt(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {users?.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Release Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="release_notes">Release Notes</Label>
              <Textarea
                id="release_notes"
                placeholder="Describe the changes included in this release..."
                rows={4}
                {...register("release_notes")}
              />
            </div>

            {/* Comments */}
            <div className="space-y-1.5">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                placeholder="Additional notes or context..."
                rows={2}
                {...register("comments")}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || createPlan.isPending || updatePlan.isPending}
              >
                {isEditing ? "Save Changes" : "Create Release Plan"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(isEditing ? `/release-plans/${planId}` : "/release-plans")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
