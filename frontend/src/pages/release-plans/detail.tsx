import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Edit, Trash2, RefreshCw, Plus, CheckCircle2, XCircle, Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useReleasePlan, useReleasePlanStates, useUpdateReleasePlan, useDeleteReleasePlan,
  useDeleteReleasePlanLine, useRefreshReleasePlanVersions, useEligibleModules, useLinkModuleLines,
} from "@/hooks/useReleasePlans";
import type { ReleasePlanLine, EligibleModuleLine } from "@/api/release-plans";
import { api } from "@/lib/api";
import { toast } from "sonner";

function formatDate(iso: string | null | undefined, includeTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (includeTime)
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const MACRO_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  Planned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Approved: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  Executing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  Closed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function MacroBadge({ category, name }: { category: string; name: string }) {
  const color = MACRO_COLORS[category] ?? "bg-gray-100 text-gray-800";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{name}</span>;
}

function ReleaseActionBadge({ action }: { action: string | null }) {
  if (!action) return <span className="text-muted-foreground text-xs">—</span>;
  if (action === "All Okay")
    return <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 text-xs font-medium"><CheckCircle2 className="h-3.5 w-3.5" />All Okay</span>;
  return <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 text-xs font-medium"><XCircle className="h-3.5 w-3.5" />Not Okay</span>;
}

// ─── Add Modules Wizard (3-step) ─────────────────────────────────────────────

type WizardStep = 1 | 2 | 3;

function AddModulesWizard({ planId, open, onClose }: { planId: number; open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDrId, setSelectedDrId] = useState<number | null>(null);
  const [selectedDrNumber, setSelectedDrNumber] = useState("");
  const [drSearchResults, setDrSearchResults] = useState<{ id: number; request_number: string; title: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<number>>(new Set());

  const { data: eligibleLines, isLoading: loadingLines } = useEligibleModules(planId, selectedDrId);
  const linkLines = useLinkModuleLines(planId);

  const searchDRs = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.get("/development-requests/requests/", {
        params: { search: searchQuery, state_category: "In Progress", limit: 10, is_archived: false },
      });
      setDrSearchResults(res.data.items ?? []);
    } catch {
      toast.error("Failed to search development requests");
    } finally {
      setSearching(false);
    }
  };

  const selectDR = (id: number, number: string) => {
    setSelectedDrId(id);
    setSelectedDrNumber(number);
    setSelectedLineIds(new Set());
    setStep(2);
  };

  // Pre-select all eligible lines when they load
  const handleEligibleLoad = (lines: EligibleModuleLine[]) => {
    setSelectedLineIds(new Set(lines.filter(l => l.is_eligible).map(l => l.id)));
  };

  if (eligibleLines && selectedLineIds.size === 0 && eligibleLines.some(l => l.is_eligible)) {
    handleEligibleLoad(eligibleLines);
  }

  const toggleLine = (id: number, eligible: boolean) => {
    if (!eligible) return;
    setSelectedLineIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleLink = async () => {
    if (selectedLineIds.size === 0) { toast.error("Select at least one module line"); return; }
    try {
      const result = await linkLines.mutateAsync({ module_line_ids: Array.from(selectedLineIds) });
      if (result.errors.length) toast.warning(`Linked ${result.added.length}, errors: ${result.errors.join("; ")}`);
      handleClose();
    } catch { /* handled in hook */ }
  };

  const handleClose = () => {
    setStep(1); setSearchQuery(""); setSelectedDrId(null); setSelectedDrNumber("");
    setDrSearchResults([]); setSelectedLineIds(new Set()); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Module Lines — Step {step} of 3</DialogTitle>
          <DialogDescription>
            {step === 1 && "Search for an In Progress Development Request"}
            {step === 2 && `Select modules from ${selectedDrNumber}`}
            {step === 3 && "Confirm and link selected modules"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Search DR */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Search by request number or title…" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchDRs()} />
              <Button onClick={searchDRs} disabled={searching} variant="outline">Search</Button>
            </div>
            {drSearchResults.length > 0 && (
              <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                {drSearchResults.map(dr => (
                  <button key={dr.id} onClick={() => selectDR(dr.id, dr.request_number)}
                    className="w-full px-4 py-2.5 text-left hover:bg-muted/50 flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{dr.request_number}</span>
                    <span className="text-sm text-muted-foreground truncate max-w-xs">{dr.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Module line selection */}
        {step === 2 && (
          <div className="space-y-2">
            {loadingLines ? <Skeleton className="h-40" /> : (
              <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
                {(eligibleLines ?? []).map(line => (
                  <div key={line.id}
                    className={`px-4 py-2.5 flex items-start gap-3 ${!line.is_eligible ? "opacity-50 bg-muted/20" : "hover:bg-muted/30"}`}>
                    <Checkbox
                      checked={selectedLineIds.has(line.id)}
                      disabled={!line.is_eligible}
                      onCheckedChange={() => toggleLine(line.id, line.is_eligible)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-medium">{line.module_technical_name}</p>
                      <p className="text-xs text-muted-foreground">
                        v{line.module_version ?? "—"} · UAT: {line.uat_status ?? "—"} · Action: {line.drift_action ?? "—"}
                      </p>
                      {!line.is_eligible && line.disable_reason && (
                        <p className="text-xs text-destructive mt-0.5">{line.disable_reason}</p>
                      )}
                    </div>
                  </div>
                ))}
                {(eligibleLines ?? []).length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">No module lines found for this DR.</p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{selectedLineIds.size} module(s) selected</p>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-2">
            <p className="text-sm">Linking <strong>{selectedLineIds.size}</strong> module line(s) from <strong>{selectedDrNumber}</strong> to this Release Plan.</p>
            <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
              {(eligibleLines ?? []).filter(l => selectedLineIds.has(l.id)).map(line => (
                <div key={line.id} className="px-4 py-2 text-sm flex justify-between">
                  <span className="font-mono">{line.module_technical_name}</span>
                  <span className="text-muted-foreground">v{line.module_version ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {step === 2 && <Button variant="outline" onClick={() => setStep(1)}>Back</Button>}
          {step === 1 && <Button disabled>Next — select a DR first</Button>}
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={selectedLineIds.size === 0}>
              Next ({selectedLineIds.size} selected)
            </Button>
          )}
          {step === 3 && (
            <Button onClick={handleLink} disabled={linkLines.isPending}>
              {linkLines.isPending ? "Linking…" : "Confirm & Link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Line row ─────────────────────────────────────────────────────────────────

function ReleasePlanLineRow({ line, canUnlink, onUnlink }: { line: ReleasePlanLine; canUnlink: boolean; onUnlink: () => void }) {
  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2.5 font-mono text-xs">{line.module_technical_name ?? "—"}</td>
      <td className="px-4 py-2.5 text-xs">
        {line.development_request ? (
          <Link to={`/development-requests/${line.development_request.id}`}
            className="text-primary hover:underline font-mono">
            {line.development_request.request_number}
          </Link>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-2.5 text-xs font-mono">{line.module_version ?? "—"}</td>
      <td className="px-4 py-2.5 text-xs font-mono">{line.source_env_version ?? "—"}</td>
      <td className="px-4 py-2.5 text-xs font-mono">{line.target_env_version ?? "—"}</td>
      <td className="px-4 py-2.5"><ReleaseActionBadge action={line.release_action} /></td>
      <td className="px-4 py-2.5 text-xs">
        {line.uat_status ? (
          <Badge variant={line.uat_status === "Closed" ? "default" : "secondary"}>{line.uat_status}</Badge>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-2.5 text-xs">{line.uat_ticket ?? "—"}</td>
      {canUnlink && (
        <td className="px-4 py-2.5 text-right">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onUnlink} title="Unlink module">
            <Unlink className="h-3.5 w-3.5" />
          </Button>
        </td>
      )}
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ReleasePlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const planId = parseInt(id || "0");

  const { data: plan, isLoading } = useReleasePlan(planId);
  const { data: states } = useReleasePlanStates();
  const updatePlan = useUpdateReleasePlan();
  const deletePlan = useDeleteReleasePlan();
  const deleteLine = useDeleteReleasePlanLine(planId);
  const refreshVersions = useRefreshReleasePlanVersions(planId);

  const [showAddModules, setShowAddModules] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleStateChange = async (stateId: string) => {
    try {
      await updatePlan.mutateAsync({ id: planId, data: { state_id: parseInt(stateId) } });
    } catch (error: unknown) {
      const e = error as { response?: { data?: { detail?: string } } };
      if (e.response?.data?.detail) toast.error(e.response.data.detail);
    }
  };

  const macro = plan?.state?.category ?? "Draft";
  const canManageLines = plan?.permissions?.can_manage_lines ?? false;
  const canTransitionState = plan?.permissions?.can_transition_state ?? false;
  const canDelete = plan?.permissions?.can_delete ?? false;
  const canUnlink = canManageLines && macro === "Draft";

  if (isLoading) return (
    <div className="space-y-4 max-w-5xl">
      <Skeleton className="h-8 w-64" /><Skeleton className="h-48" /><Skeleton className="h-48" />
    </div>
  );

  if (!plan) return (
    <div className="flex flex-col items-center justify-center py-24">
      <p className="text-muted-foreground">Release plan not found.</p>
      <Button variant="outline" className="mt-4" asChild><Link to="/release-plans">Back to list</Link></Button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/release-plans"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-mono">{plan.plan_number}</h1>
              <MacroBadge category={macro} name={plan.state.name} />
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {plan.release_version} — {plan.source_environment.name} → {plan.target_environment.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canTransitionState && (
            <Select value={plan.state_id.toString()} onValueChange={handleStateChange}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {states?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="icon" asChild><Link to={`/release-plans/${planId}/edit`}><Edit className="h-4 w-4" /></Link></Button>
          {canDelete && (
            <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Plan Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Plan Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span className="font-medium">{plan.source_environment.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Target</span><span className="font-medium">{plan.target_environment.name}</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Planned Date</span>
              <span>{plan.planned_deployment_date ? formatDate(plan.planned_deployment_date) : <span className="text-muted-foreground">Not set</span>}</span>
            </div>
            {plan.actual_deployment_date && (
              <div className="flex justify-between"><span className="text-muted-foreground">Actual Date</span><span>{formatDate(plan.actual_deployment_date, true)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Approved By</span><span>{plan.approved_by?.username ?? <span className="text-muted-foreground">—</span>}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Deployed By</span><span>{plan.deployed_by?.username ?? <span className="text-muted-foreground">—</span>}</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Snapshot</span>
              <span>{plan.is_snapshot_taken ? <Badge variant="secondary">Frozen</Badge> : <Badge variant="outline">Live</Badge>}</span>
            </div>
          </CardContent>
        </Card>
        {plan.release_notes && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Release Notes</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{plan.release_notes}</p></CardContent>
          </Card>
        )}
      </div>

      {/* Lines */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Module Lines <Badge variant="secondary" className="ml-1">{plan.lines.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              {!plan.is_snapshot_taken && (
                <Button variant="outline" size="sm" onClick={() => refreshVersions.mutate()} disabled={refreshVersions.isPending}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshVersions.isPending ? "animate-spin" : ""}`} />
                  Refresh Versions
                </Button>
              )}
              {macro === "Draft" && canManageLines && (
                <Button size="sm" onClick={() => setShowAddModules(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Add Modules
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {plan.lines.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No lines yet. Add modules from a development request.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Module</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Dev Request</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Version</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Source Ver.</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Target Ver.</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Action</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">UAT Status</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">UAT Ticket</th>
                    {canUnlink && <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Unlink</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {plan.lines.map(line => (
                    <ReleasePlanLineRow
                      key={line.id}
                      line={line}
                      canUnlink={canUnlink}
                      onUnlink={() => deleteLine.mutate(line.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddModulesWizard planId={planId} open={showAddModules} onClose={() => setShowAddModules(false)} />

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Release Plan</DialogTitle>
            <DialogDescription>Are you sure you want to delete <strong>{plan.plan_number}</strong>? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => { await deletePlan.mutateAsync(planId); navigate("/release-plans"); }} disabled={deletePlan.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
