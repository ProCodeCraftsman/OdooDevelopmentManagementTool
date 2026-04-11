import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrGroupHeaderProps {
  label: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Group header component for DR Module Lines view.
 * Renders a collapsible header with expand/collapse toggle, label, and item count.
 */
export function DrGroupHeader({
  label,
  count,
  isExpanded,
  onToggle,
  className,
}: DrGroupHeaderProps) {
  const itemLabel = count === 1 ? "item" : "items";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left",
        "bg-secondary/50 hover:bg-secondary/80 transition-colors",
        "rounded-md border border-transparent",
        "font-semibold text-base",
        className
      )}
      aria-expanded={isExpanded}
    >
      <span className="flex-shrink-0 text-muted-foreground">
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span className="flex-shrink-0 text-sm text-muted-foreground">
        {count} {itemLabel}
      </span>
    </button>
  );
}