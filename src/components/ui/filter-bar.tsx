import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterOption {
  key: string;
  label: string;
  value: string;
}

interface FilterGroup {
  name: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

interface FilterBarProps {
  filters: FilterGroup[];
  onClearAll?: () => void;
  className?: string;
}

export function FilterBar({ filters, onClearAll, className }: FilterBarProps) {
  const hasActiveFilters = filters.some((f) => f.value !== "all");

  return (
    <div className={cn("space-y-2", className)}>
      {/* Scrollable filter chips */}
      <div className="scroll-x-container">
        {filters.map((group) => (
          <React.Fragment key={group.name}>
            {group.options.map((option) => {
              const isActive = group.value === option.value;
              const isAll = option.value === "all";
              
              // Don't show "all" as a chip
              if (isAll) return null;
              
              return (
                <Button
                  key={`${group.name}-${option.value}`}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "shrink-0 h-9 px-4 rounded-full text-sm",
                    "touch-manipulation active:scale-95 transition-transform"
                  )}
                  onClick={() => {
                    if (isActive) {
                      group.onChange("all");
                    } else {
                      group.onChange(option.value);
                    }
                  }}
                >
                  {option.label}
                  {isActive && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Button>
              );
            })}
          </React.Fragment>
        ))}
        
        {hasActiveFilters && onClearAll && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-9 px-3 rounded-full text-sm text-destructive"
            onClick={onClearAll}
          >
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}

// Simple scrollable filter chips
interface FilterChipsProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterChips({ options, value, onChange, className }: FilterChipsProps) {
  return (
    <div className={cn("scroll-x-container", className)}>
      {options.map((option) => {
        const isActive = value === option.value;
        
        return (
          <Button
            key={option.value}
            variant={isActive ? "default" : "outline"}
            size="sm"
            className={cn(
              "shrink-0 h-9 px-4 rounded-full text-sm",
              "touch-manipulation active:scale-95 transition-transform"
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
