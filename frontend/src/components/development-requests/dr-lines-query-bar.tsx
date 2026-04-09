import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, X, Plus, Layers } from "lucide-react";
import type { DevelopmentRequestLineFilters } from "@/api/development-requests";

type FilterField = "module_names" | "uat_statuses";

const FILTER_FIELD_LABELS: Record<FilterField, string> = {
  module_names: "Module Name",
  uat_statuses: "UAT Status",
};

const UAT_STATUS_OPTIONS = [
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In Progress" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

const GROUP_BY_OPTIONS: { value: string; label: string }[] = [
  { value: "module", label: "Module" },
  { value: "uat_status", label: "UAT Status" },
];

interface Props {
  filters: DevelopmentRequestLineFilters;
  onChange: (filters: DevelopmentRequestLineFilters) => void;
}

export function DrLinesQueryBar({ filters, onChange }: Props) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [activeAddField, setActiveAddField] = useState<FilterField | null>(null);

  const update = (patch: Partial<DevelopmentRequestLineFilters>) =>
    onChange({ ...filters, ...patch });

  const removeFilter = (field: FilterField) => {
    if (field === "module_names") {
      update({ module_names: undefined });
    } else if (field === "uat_statuses") {
      update({ uat_statuses: undefined });
    }
  };

  const toggleFilterValue = (field: FilterField, value: string, _label: string) => {
    if (field === "module_names") {
      const current = filters.module_names ? filters.module_names.split(",") : [];
      if (current.includes(value)) {
        const next = current.filter((v) => v !== value);
        update({ module_names: next.length > 0 ? next.join(",") : undefined });
      } else {
        update({ module_names: [...current, value].join(",") });
      }
    } else if (field === "uat_statuses") {
      const current = filters.uat_statuses ? filters.uat_statuses.split(",") : [];
      if (current.includes(value)) {
        const next = current.filter((v) => v !== value);
        update({ uat_statuses: next.length > 0 ? next.join(",") : undefined });
      } else {
        update({ uat_statuses: [...current, value].join(",") });
      }
    }
  };

  const getOptions = (field: FilterField): { id: string; label: string }[] => {
    if (field === "module_names") {
      return [];
    } else if (field === "uat_statuses") {
      return UAT_STATUS_OPTIONS;
    }
    return [];
  };

  const activeFilters: { field: FilterField; label: string }[] = [];
  if (filters.module_names) {
    activeFilters.push({ field: "module_names", label: `Module: ${filters.module_names}` });
  }
  if (filters.uat_statuses) {
    activeFilters.push({ field: "uat_statuses", label: `UAT: ${filters.uat_statuses}` });
  }

  const hasActiveFilters = activeFilters.length > 0 || !!filters.search;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            className="pl-8 h-8 text-sm"
            placeholder="Search DR lines..."
            value={filters.search || ""}
            onChange={(e) => update({ search: e.target.value || undefined })}
          />
          {filters.search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => update({ search: undefined })}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Popover
          open={addFilterOpen}
          onOpenChange={(o) => {
            setAddFilterOpen(o);
            if (!o) setActiveAddField(null);
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            {!activeAddField ? (
              <div className="p-1">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                  Filter by
                </div>
                {(Object.keys(FILTER_FIELD_LABELS) as FilterField[]).map((field) => (
                  <button
                    key={field}
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                    onClick={() => setActiveAddField(field)}
                  >
                    {FILTER_FIELD_LABELS[field]}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-1">
                <button
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
                  onClick={() => setActiveAddField(null)}
                >
                  ← {FILTER_FIELD_LABELS[activeAddField]}
                </button>
                <div className="max-h-52 overflow-y-auto">
                  {getOptions(activeAddField).map((opt) => {
                    const isActive = activeAddField === "uat_statuses"
                      ? filters.uat_statuses?.split(",").includes(opt.id)
                      : false;
                    return (
                      <button
                        key={opt.id}
                        className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2 ${isActive ? "font-medium" : ""}`}
                        onClick={() => toggleFilterValue(activeAddField, opt.id, opt.label)}
                      >
                        <span
                          className={`h-3 w-3 rounded border flex-shrink-0 ${isActive ? "bg-primary border-primary" : "border-muted-foreground"}`}
                        />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={filters.group_by ? "secondary" : "outline"}
              size="sm"
              className="h-8 gap-1.5"
            >
              <Layers className="h-3.5 w-3.5" />
              {filters.group_by
                ? GROUP_BY_OPTIONS.find((g) => g.value === filters.group_by)?.label ?? "Group By"
                : "Group By"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => update({ group_by: undefined })}>
              None
            </DropdownMenuItem>
            {GROUP_BY_OPTIONS.map((g) => (
              <DropdownMenuItem
                key={g.value}
                onClick={() => update({ group_by: g.value as "module" | "uat_status" })}
                className={filters.group_by === g.value ? "font-medium" : ""}
              >
                {g.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={() =>
              onChange({ module_names: undefined, uat_statuses: undefined, search: undefined, group_by: undefined })
            }
          >
            Clear All
          </Button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeFilters.map((token) => (
            <div
              key={token.field}
              className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs"
            >
              <span>{token.label}</span>
              <button
                className="ml-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => removeFilter(token.field)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}