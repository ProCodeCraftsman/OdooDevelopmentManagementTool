import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, Plus, Archive } from "lucide-react";
import type { FilterToken, QueryState, GroupByOption } from "@/api/development-requests";
import type { ControlParameters } from "@/api/development-requests";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Field definitions for the "+ Add Filter" popover
// ---------------------------------------------------------------------------

type FilterField = FilterToken["field"];

const FILTER_FIELD_LABELS: Record<FilterField, string> = {
  request_type_ids: "Type",
  request_state_ids: "State",
  functional_category_ids: "Category",
  priority_ids: "Priority",
  assigned_developer_ids: "Assignee",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  queryState: QueryState;
  controlParams: ControlParameters | undefined;
  assignableUsers: { id: number; username: string }[];
  onChange: (qs: QueryState) => void;
  groupBy?: GroupByOption | null;
  onGroupByChange?: (value: GroupByOption | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QueryBar({ queryState, controlParams, assignableUsers, onChange, groupBy, onGroupByChange }: Props) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [activeAddField, setActiveAddField] = useState<FilterField | null>(null);

  // ── helpers ──────────────────────────────────────────────────────────────

  const update = (patch: Partial<QueryState>) =>
    onChange({ ...queryState, ...patch });

  const removeFilter = (field: FilterField) => {
    update({ filters: queryState.filters.filter((f) => f.field !== field) });
  };

  const toggleFilterValue = (field: FilterField, id: string, label: string) => {
    const existing = queryState.filters.find((f) => f.field === field);
    if (existing) {
      const alreadyIn = existing.ids.includes(id);
      const nextIds = alreadyIn ? existing.ids.filter((x) => x !== id) : [...existing.ids, id];
      const nextLabels = alreadyIn
        ? existing.labels.filter((_, i) => existing.ids[i] !== id)
        : [...existing.labels, label];
      if (nextIds.length === 0) {
        update({ filters: queryState.filters.filter((f) => f.field !== field) });
      } else {
        update({
          filters: queryState.filters.map((f) =>
            f.field === field ? { ...f, ids: nextIds, labels: nextLabels } : f
          ),
        });
      }
    } else {
      update({ filters: [...queryState.filters, { field, ids: [id], labels: [label] }] });
    }
  };

  // ── get options for a given field ─────────────────────────────────────────

  const getOptions = (field: FilterField): { id: string; label: string }[] => {
    if (!controlParams) return [];
    switch (field) {
      case "request_type_ids":
        return controlParams.request_types.map((t) => ({ id: String(t.id), label: t.name }));
      case "request_state_ids":
        return controlParams.request_states.map((s) => ({ id: String(s.id), label: s.name }));
      case "functional_category_ids":
        return controlParams.functional_categories.map((c) => ({ id: String(c.id), label: c.name }));
      case "priority_ids":
        return controlParams.priorities.map((p) => ({ id: String(p.id), label: p.name }));
      case "assigned_developer_ids":
        return assignableUsers.map((u) => ({ id: String(u.id), label: u.username }));
    }
  };

  const hasActiveFilters =
    queryState.filters.length > 0 || queryState.search || queryState.show_archived;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* Row 1: Search + Add Filter + Group By + Archived + Clear All */}
      <div className="flex flex-wrap items-center gap-2 flex-1">
        {/* Unified search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            className="pl-8 h-8 text-sm"
            placeholder="Search by ID or title…"
            value={queryState.search}
            onChange={(e) => update({ search: e.target.value })}
          />
          {queryState.search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => update({ search: "" })}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Add Filter */}
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
              /* Field selector */
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
                    {queryState.filters.find((f) => f.field === field) && (
                      <span className="ml-2 text-xs text-primary">active</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              /* Value selector for the chosen field */
              <div className="p-1">
                <button
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
                  onClick={() => setActiveAddField(null)}
                >
                  ← {FILTER_FIELD_LABELS[activeAddField]}
                </button>
                <div className="max-h-52 overflow-y-auto">
                  {getOptions(activeAddField).map((opt) => {
                    const active = queryState.filters
                      .find((f) => f.field === activeAddField)
                      ?.ids.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2 ${active ? "font-medium" : ""}`}
                        onClick={() => toggleFilterValue(activeAddField, opt.id, opt.label)}
                      >
                        <span
                          className={`h-3 w-3 rounded border flex-shrink-0 ${active ? "bg-primary border-primary" : "border-muted-foreground"}`}
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

        {/* Group By + Archived */}
        <div className="flex items-center gap-2">
          {onGroupByChange && groupBy !== undefined && (
            <>
              <span className="text-sm text-muted-foreground">Group by:</span>
              <Select
                value={groupBy ?? "none"}
                onValueChange={(value) => onGroupByChange(value === "none" ? null : (value as GroupByOption))}
              >
                <SelectTrigger className="w-[130px] h-8">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="state_category">State Category</SelectItem>
                  <SelectItem value="assigned_developer">Assignee</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="functional_category">Category</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Switch
              checked={queryState.show_archived}
              onCheckedChange={(v) => update({ show_archived: v })}
            />
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            Archived
          </label>
        </div>

        {(hasActiveFilters || groupBy) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={() => {
              onChange({ filters: [], search: "", group_by: null, show_archived: false });
              onGroupByChange?.(null);
            }}
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Row 2: Active filter tokens */}
      {queryState.filters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {queryState.filters.map((token) => (
            <div
              key={token.field}
              className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs"
            >
              <span className="font-medium text-muted-foreground">
                {FILTER_FIELD_LABELS[token.field as FilterField]}:
              </span>
              <span>{token.labels.join(", ")}</span>
              <button
                className="ml-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => removeFilter(token.field as FilterField)}
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
