import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';
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
}: OperationsSearchBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = categoryFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-3 -mx-4 px-4 pt-2 border-b border-border/50">
      {/* Search Row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-12 text-base"
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
        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          size="icon"
          className="h-12 w-12 shrink-0"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-5 w-5" />
        </Button>
      </div>

      {/* Filters Row */}
      {showFilters && (
        <div className="flex gap-2 mt-2 animate-in slide-in-from-top-2 duration-200">
          {showCategoryFilter && (
            <Select value={categoryFilter} onValueChange={onCategoryChange}>
              <SelectTrigger className="flex-1 h-10">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showStatusFilter && (
            <Select value={statusFilter} onValueChange={onStatusChange}>
              <SelectTrigger className="flex-1 h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status.key} value={status.key}>{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => {
                onCategoryChange('all');
                onStatusChange('all');
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
