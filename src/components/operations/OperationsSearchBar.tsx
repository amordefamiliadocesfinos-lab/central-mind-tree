import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OperationsSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  categories: string[];
  statuses: { key: string; label: string }[];
  placeholder?: string;
  showCategoryFilter?: boolean;
  showStatusFilter?: boolean;
  onManageCategories?: () => void;
}

export function OperationsSearchBar({
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  categories,
  statuses,
  placeholder = "Buscar...",
  showCategoryFilter = true,
  showStatusFilter = true,
  onManageCategories,
}: OperationsSearchBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = categoryFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-3 -mx-4 px-4 pt-2 border-b border-border/50">
      {/* Search Row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-12 text-base rounded-xl"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => onSearchChange('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {(showCategoryFilter || showStatusFilter) && (
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            size="icon"
            className="h-12 w-12 shrink-0 rounded-xl"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Filters - Scrollable chips on mobile */}
      {showFilters && (
        <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
          <div className="scroll-x-container">
            {showStatusFilter && statuses.map((status) => (
              <Button
                key={status.key}
                variant={statusFilter === status.key ? "default" : "outline"}
                size="sm"
                className="shrink-0 h-9 px-4 rounded-full text-sm touch-manipulation active:scale-95"
                onClick={() => onStatusChange(statusFilter === status.key ? 'all' : status.key)}
              >
                {status.label}
                {statusFilter === status.key && <X className="ml-1 h-3 w-3" />}
              </Button>
            ))}
            {showCategoryFilter && categories.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                className="shrink-0 h-9 px-4 rounded-full text-sm touch-manipulation active:scale-95"
                onClick={() => onCategoryChange(categoryFilter === cat ? 'all' : cat)}
              >
                {cat}
                {categoryFilter === cat && <X className="ml-1 h-3 w-3" />}
              </Button>
            ))}
            {showCategoryFilter && onManageCategories && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-9 px-4 rounded-full text-sm border-dashed touch-manipulation active:scale-95"
                onClick={onManageCategories}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Criar Categoria
              </Button>
            )}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-9 px-3 rounded-full text-sm text-destructive"
                onClick={() => {
                  onCategoryChange('all');
                  onStatusChange('all');
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
