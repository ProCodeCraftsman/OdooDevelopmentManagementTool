import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useSavedViews, useCreateSavedView, useDeleteSavedView } from "@/hooks/useSavedViews";
import type { SavedView } from "@/api/saved-views";
import type { QueryState } from "@/api/development-requests";
import { ChevronDown, Save, Trash2, Globe, Lock } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

// ---------------------------------------------------------------------------
// Default "empty" view definition
// ---------------------------------------------------------------------------

const DEFAULT_VIEW: QueryState = {
  filters: [],
  search: "",
  group_by: null,
  show_archived: false,
};

const DEFAULT_VIEW_NAME = "Default View";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  currentQueryState: QueryState;
  activeViewId: number | null;
  onViewSelect: (qs: QueryState, viewId: number | null) => void;
  canSave: boolean; // false for read-only users
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SavedViewsSelector({ currentQueryState, activeViewId, onViewSelect, canSave }: Props) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const { data: views = [] } = useSavedViews();
  const createView = useCreateSavedView();
  const deleteView = useDeleteSavedView();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const myViews = views.filter((v) => v.user_id === currentUserId);
  const publicViews = views.filter((v) => v.is_public && v.user_id !== currentUserId);

  const activeView = views.find((v) => v.id === activeViewId);
  const activeName = activeView?.name ?? DEFAULT_VIEW_NAME;

  const handleSave = async () => {
    if (!viewName.trim()) return;
    await createView.mutateAsync({
      name: viewName.trim(),
      is_public: isPublic,
      query_state: currentQueryState,
    });
    setSaveDialogOpen(false);
    setViewName("");
    setIsPublic(false);
  };

  const handleSelectView = (view: SavedView) => {
    onViewSelect(view.query_state as QueryState, view.id);
  };

  const handleSelectDefault = () => {
    onViewSelect(DEFAULT_VIEW, null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-1.5 font-semibold text-base h-auto p-0 hover:bg-transparent">
            <span className="text-foreground">Development Requests:</span>
            <span className="text-primary">{activeName}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuItem onClick={handleSelectDefault}>
            <span className="font-medium">{DEFAULT_VIEW_NAME}</span>
          </DropdownMenuItem>

          {myViews.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">My Views</DropdownMenuLabel>
              {myViews.map((v) => (
                <DropdownMenuItem
                  key={v.id}
                  className="flex items-center justify-between group"
                  onSelect={() => handleSelectView(v)}
                >
                  <span className="flex items-center gap-2">
                    {v.is_public ? (
                      <Globe className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                    {v.name}
                  </span>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteView.mutate(v.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {publicViews.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">Public Views</DropdownMenuLabel>
              {publicViews.map((v) => (
                <DropdownMenuItem key={v.id} onSelect={() => handleSelectView(v)}>
                  <Globe className="h-3 w-3 text-muted-foreground mr-2" />
                  {v.name}
                  <Badge variant="outline" className="ml-auto text-xs py-0">
                    {v.owner_username}
                  </Badge>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {canSave && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSaveDialogOpen(true)}>
                <Save className="h-3.5 w-3.5 mr-2" />
                Save Current View…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save View Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="view-name">View name</Label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g. My Open Requests"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is-public" className="cursor-pointer">
                Make public (visible to all users)
              </Label>
              <Switch
                id="is-public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!viewName.trim() || createView.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
