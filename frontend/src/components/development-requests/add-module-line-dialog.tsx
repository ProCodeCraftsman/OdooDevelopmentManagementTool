import { useState, useMemo, useEffect } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModuleSearch } from "@/hooks/useModules";
import { useBulkAddModuleLines, useDeleteModuleLine, queryKeys } from "@/hooks/useDevelopmentRequests";
import { useQueryClient } from "@tanstack/react-query";
import type { DevelopmentRequest } from "@/api/development-requests";

interface AddModuleLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: DevelopmentRequest;
}

interface SelectedModule {
  id: number;
  name: string;
  shortdesc: string | null;
  version: string;
  md5_sum: string;
  email_thread_zip: string;
  isLoadingVersion: boolean;
}

export function AddModuleLineDialog({
  open,
  onOpenChange,
  request,
}: AddModuleLineDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModules, setSelectedModules] = useState<SelectedModule[]>([]);

  const queryClient = useQueryClient();
  const bulkAddMutation = useBulkAddModuleLines();
  const deleteModuleMutation = useDeleteModuleLine();

  const { data: searchResults, isLoading: isSearching } = useModuleSearch(searchQuery, open);

  const handleSelectModule = (module: { id: number; name: string; shortdesc: string | null }) => {
    if (!selectedModules.some((m) => m.id === module.id)) {
      setSelectedModules((prev) => [
        ...prev,
        { ...module, version: "", md5_sum: "", email_thread_zip: "", isLoadingVersion: true },
      ]);
    }
    setSearchQuery("");
  };

  // Auto-fetch DEV version after a module is selected
  useEffect(() => {
    selectedModules.forEach(async (module) => {
      if (module.isLoadingVersion && module.name) {
        try {
          const response = await fetch(`/api/v1/modules/master/${encodeURIComponent(module.name)}/dev-versions/`);
          if (response.ok) {
            const data = await response.json();
            const firstVersion = data.versions?.[0] ?? "";
            setSelectedModules((prev) =>
              prev.map((m) =>
                m.id === module.id ? { ...m, version: firstVersion, isLoadingVersion: false } : m
              )
            );
          } else {
            setSelectedModules((prev) =>
              prev.map((m) => (m.id === module.id ? { ...m, isLoadingVersion: false } : m))
            );
          }
        } catch {
          setSelectedModules((prev) =>
            prev.map((m) => (m.id === module.id ? { ...m, isLoadingVersion: false } : m))
          );
        }
      }
    });
  }, [selectedModules]);

  const handleRemoveModule = (moduleId: number) => {
    setSelectedModules(selectedModules.filter((m) => m.id !== moduleId));
  };

  const updateField = (moduleId: number, field: keyof SelectedModule, value: string) => {
    setSelectedModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, [field]: value } : m))
    );
  };

  const handleAddModules = async () => {
    const lines = selectedModules.map((m) => ({
      module_technical_name: m.name,
      module_version: m.version || undefined,
      module_md5_sum: m.md5_sum || undefined,
      email_thread_zip: m.email_thread_zip || undefined,
    }));

    await bulkAddMutation.mutateAsync({ requestId: request.id, lines });
    queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(request.id) });
    setSelectedModules([]);
    onOpenChange(false);
  };

  const handleDeleteModuleLine = async (lineId: number) => {
    await deleteModuleMutation.mutateAsync({ requestId: request.id, lineId });
    queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(request.id) });
  };

  const existingModuleNames = useMemo(
    () => new Set(request.module_lines?.map((l) => l.module_technical_name) || []),
    [request.module_lines]
  );

  const filteredSearchResults = useMemo(
    () => (searchResults ?? []).filter((m) => !existingModuleNames.has(m.name)),
    [searchResults, existingModuleNames]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Module Lines</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search */}
          <div className="space-y-2">
            <Label>Search Module</Label>
            <div className="relative">
              <Input
                placeholder="Search for a module..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {searchQuery && !isSearching && filteredSearchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredSearchResults.map((module) => (
                    <button
                      key={module.id}
                      type="button"
                      className="w-full px-4 py-2 text-left hover:bg-muted transition-colors"
                      onClick={() => handleSelectModule(module)}
                    >
                      <div className="font-medium">{module.name}</div>
                      {module.shortdesc && (
                        <div className="text-sm text-muted-foreground">{module.shortdesc}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected modules — with all 4 fields */}
          {selectedModules.length > 0 && (
            <div className="space-y-3">
              <Label>Selected Modules</Label>
              {selectedModules.map((module) => (
                <div key={module.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{module.name}</div>
                      {module.shortdesc && (
                        <div className="text-sm text-muted-foreground">{module.shortdesc}</div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveModule(module.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Version</Label>
                      <div className="relative">
                        <Input
                          placeholder="e.g. 17.0.1.0.0"
                          value={module.version}
                          onChange={(e) => updateField(module.id, "version", e.target.value)}
                          disabled={module.isLoadingVersion}
                        />
                        {module.isLoadingVersion && (
                          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">MD5 Sum</Label>
                      <Input
                        placeholder="32-char hex"
                        value={module.md5_sum}
                        onChange={(e) => updateField(module.id, "md5_sum", e.target.value)}
                        maxLength={64}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Email/Zip Path</Label>
                      <Input
                        placeholder="/path/to/email.zip"
                        value={module.email_thread_zip}
                        onChange={(e) => updateField(module.id, "email_thread_zip", e.target.value)}
                        maxLength={500}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Existing lines */}
          {request.module_lines && request.module_lines.length > 0 && (
            <div className="space-y-2">
              <Label>Existing Module Lines</Label>
              <div className="border rounded-lg overflow-hidden">
                {request.module_lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 gap-4"
                  >
                    <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                      <span className="font-medium truncate">{line.module_technical_name}</span>
                      <span className="text-muted-foreground">{line.module_version || "—"}</span>
                      <span className="text-muted-foreground font-mono text-xs truncate" title={line.module_md5_sum ?? undefined}>
                        {line.module_md5_sum ? `${line.module_md5_sum.slice(0, 12)}…` : "—"}
                      </span>
                      <span className="text-muted-foreground text-xs truncate" title={line.email_thread_zip ?? undefined}>
                        {line.email_thread_zip ? line.email_thread_zip.split("/").pop() : "—"}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handleDeleteModuleLine(line.id)}
                      disabled={deleteModuleMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddModules}
            disabled={selectedModules.length === 0 || bulkAddMutation.isPending}
          >
            {bulkAddMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add {selectedModules.length} Module{selectedModules.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
