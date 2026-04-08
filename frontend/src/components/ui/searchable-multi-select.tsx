import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SearchableMultiSelectProps {
  /** Full list of available options (from server filter-options, not just current page) */
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** Label shown in trigger when nothing is selected, e.g. "All States" */
  allLabel: string;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  className?: string;
  /** Width class for the trigger button, e.g. "w-[160px]" */
  triggerWidth?: string;
}

export function SearchableMultiSelect({
  options,
  selected,
  onChange,
  allLabel,
  searchPlaceholder = "Search...",
  className,
  triggerWidth = "w-[160px]",
}: SearchableMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function clearAll() {
    onChange([]);
  }

  const hasSelection = selected.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 justify-between font-normal px-3 text-sm",
            triggerWidth,
            className
          )}
        >
          <span className="truncate">
            {hasSelection ? (
              <span className="flex items-center gap-1.5">
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-medium">
                  {selected.length}
                </Badge>
                <span className="truncate text-xs">
                  {selected.length === 1 ? selected[0] : `${selected.length} selected`}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">{allLabel}</span>
            )}
          </span>
          <div className="flex items-center gap-0.5 shrink-0 ml-1">
            {hasSelection && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    clearAll();
                  }
                }}
                className="rounded-sm p-0.5 hover:bg-muted cursor-pointer"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-7 text-xs"
            autoFocus
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              No options found.
            </p>
          )}
          {filtered.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-left cursor-pointer",
                  "hover:bg-accent hover:text-accent-foreground",
                  isSelected && "bg-accent/50"
                )}
                onClick={() => toggle(option)}
              >
                <div
                  className={cn(
                    "flex h-3.5 w-3.5 items-center justify-center rounded-sm border shrink-0",
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/40"
                  )}
                >
                  {isSelected && <Check className="h-2.5 w-2.5" />}
                </div>
                <span className="truncate">{option}</span>
              </button>
            );
          })}
        </div>
        {hasSelection && (
          <div className="border-t p-1">
            <button
              type="button"
              onClick={clearAll}
              className="w-full rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground text-center cursor-pointer"
            >
              Clear selection
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
