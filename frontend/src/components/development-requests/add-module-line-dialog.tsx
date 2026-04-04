import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModuleSearch } from "@/hooks/useModules";
import { useAddModuleLine, useDeleteModuleLine, queryKeys } from "@/hooks/useDevelopmentRequests";
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
  const addModuleMutation = useAddModuleLine();
  const deleteModuleMutation = useDeleteModuleLine();

  const { data: searchResults, isLoading: isSearching } = useModuleSearch(searchQuery, open);

  const moduleSearch = searchResults || [];

  const handleSelectModule = async (module: { id: number; name: string; shortdesc: string | null }) => {
    if (!selectedModules.some((m) => m.id === module.id)) {
      const newModule: SelectedModule = {
        ...module,
        version: "",
        isLoadingVersion: true,
      };
      setSelectedModules([...selectedModules, newModule]);
    }
    setSearchQuery("");
  };

  useEffect(() => {
    selectedModules.forEach(async (module) => {
      if (module.isLoadingVersion && module.name) {
        try {
          const response = await fetch(`/api/v1/modules/master/${encodeURIComponent(module.name)}/dev-versions/`);
          if (response.ok) {
            const data = await response.json();
            if (data.versions && data.versions.length > 0) {
              setSelectedModules((prev) =>
                prev.map((m) =>
                  m.id === module.id ? { ...m, version: data.versions[0], isLoadingVersion: false } : m
                )
              );
            } else {
              setSelectedModules((prev) =>
                prev.map((m) => (m.id === module.id ? { ...m, isLoadingVersion: false } : m))
              );
            }
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

  const handleVersionChange = (moduleId: number, version: string) => {
    setSelectedModules(
      selectedModules.map((m) => (m.id === moduleId ? { ...m, version } : m))
    );
  };

  const handleAddModules = async () => {
    for (const module of selectedModules) {
      await addModuleMutation.mutateAsync({
        requestId: request.id,
        data: {
          module_technical_name: module.name,
          module_version: module.version || undefined,
        },
      });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(request.id) });
    setSelectedModules([]);
    onOpenChange(false);
  };

  const handleDeleteModuleLine = async (lineId: number) => {
    await deleteModuleMutation.mutateAsync({
      requestId: request.id,
      lineId,
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.developmentRequest(request.id) });
  };

  const existingModuleNames = useMemo(
    () => new Set(request.module_lines?.map((l) => l.module_technical_name) || []),
    [request.module_lines]
  );

  const filteredSearchResults = useMemo(
    () => moduleSearch.filter((m) => !existingModuleNames.has(m.name)),
    [moduleSearch, existingModuleNames]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Module Lines</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
                        <div className="text-sm text-muted-foreground">
                          {module.shortdesc}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedModules.length > 0 && (
            <div className="space-y-3">
              <Label>Selected Modules</Label>
              {selectedModules.map((module) => (
                <div key={module.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{module.name}</div>
                    {module.shortdesc && (
                      <div className="text-sm text-muted-foreground">
                        {module.shortdesc}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      placeholder="Version"
                      value={module.version}
                      onChange={(e) => handleVersionChange(module.id, e.target.value)}
                      className="w-40"
                      disabled={module.isLoadingVersion}
                    />
                    {module.isLoadingVersion && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
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
              ))}
            </div>
          )}

          {request.module_lines && request.module_lines.length > 0 && (
            <div className="space-y-3">
              <Label>Existing Module Lines</Label>
              <div className="border rounded-lg overflow-hidden">
                {request.module_lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center justify-between p-3 border-b last:border-b-0"
                  >
                    <div>
                      <div className="font-medium">{line.module_technical_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {line.module_version || "No version specified"}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
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
            disabled={selectedModules.length === 0 || addModuleMutation.isPending}
          >
            {addModuleMutation.isPending ? (
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
