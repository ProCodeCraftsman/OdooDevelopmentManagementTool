import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface FilterState {
  developer: string;
  state: string;
  category: string;
}

export interface FilterControlsProps {
  developers: string[];
  categories?: string[];
  onFilterChange: (filters: FilterState) => void;
}

const DEFAULT_STATES = ["Draft", "In Progress", "Ready", "Done"];

export function FilterControls({ developers, categories = [], onFilterChange }: FilterControlsProps) {
  const [filters, setFilters] = useState<FilterState>({
    developer: "",
    state: "",
    category: "",
  });

  const handleDeveloperChange = useCallback((value: string) => {
    const newFilters = { ...filters, developer: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  }, [filters, onFilterChange]);

  const handleStateChange = useCallback((value: string) => {
    const newFilters = { ...filters, state: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  }, [filters, onFilterChange]);

  const handleCategoryChange = useCallback((value: string) => {
    const newFilters = { ...filters, category: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  }, [filters, onFilterChange]);

  const handleClearFilters = useCallback(() => {
    const emptyFilters = { developer: "", state: "", category: "" };
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  }, [onFilterChange]);

  const hasActiveFilters = filters.developer || filters.state || filters.category;

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2">
        <Select value={filters.developer} onValueChange={handleDeveloperChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Developers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Developers</SelectItem>
            {developers.map((dev) => (
              <SelectItem key={dev} value={dev}>
                {dev}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Select value={filters.state} onValueChange={handleStateChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All States</SelectItem>
            {DEFAULT_STATES.map((state) => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {categories.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={filters.category} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}