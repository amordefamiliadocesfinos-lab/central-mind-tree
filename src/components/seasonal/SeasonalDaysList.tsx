import { SeasonalDay } from '@/hooks/useSeasonalDays';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SeasonalDaysListProps {
  seasonalDays: SeasonalDay[];
  filterImportance?: number | null;
  onFilterChange?: (importance: number | null) => void;
  onEdit: (sd: SeasonalDay) => void;
  onAdd: () => void;
}

const MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const formatRecurrence = (sd: SeasonalDay): string => {
  if (sd.recurrence_type === 'fixed' && sd.month && sd.day) {
    return `${sd.day}/${MONTHS_SHORT[sd.month - 1]}`;
  }
  if (sd.recurrence_type === 'nth_weekday' && sd.month && sd.nth_occurrence !== null && sd.weekday !== null) {
    const nth = sd.nth_occurrence === -1 ? 'Último' : `${sd.nth_occurrence}º`;
    return `${nth} ${WEEKDAYS_SHORT[sd.weekday]} de ${MONTHS_SHORT[sd.month - 1]}`;
  }
  if (sd.recurrence_type === 'range' && sd.month && sd.day && sd.end_month && sd.end_day) {
    return `${sd.day}/${MONTHS_SHORT[sd.month - 1]} - ${sd.end_day}/${MONTHS_SHORT[sd.end_month - 1]}`;
  }
  return '';
};

export const SeasonalDaysList = ({
  seasonalDays,
  filterImportance,
  onFilterChange,
  onEdit,
  onAdd,
}: SeasonalDaysListProps) => {
  const filtered = filterImportance
    ? seasonalDays.filter((sd) => sd.importance === filterImportance)
    : seasonalDays;

  return (
    <div className="border rounded-xl p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Dias Sazonais
        </h3>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Novo
        </Button>
      </div>

      {/* Filter */}
      {onFilterChange && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => onFilterChange(null)}
            className={cn(
              'px-2 py-1 text-xs rounded-full border transition-colors',
              !filterImportance
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:border-primary/50'
            )}
          >
            Todos
          </button>
          {[1, 2, 3].map((level) => (
            <button
              key={level}
              onClick={() => onFilterChange(level)}
              className={cn(
                'px-2 py-1 text-xs rounded-full border transition-colors',
                filterImportance === level
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {'•'.repeat(level)}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum dia sazonal cadastrado
        </p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {filtered.map((sd) => (
            <div
              key={sd.id}
              className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors group"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: sd.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{sd.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatRecurrence(sd)}
                  {sd.prep_days > 0 && ` • ${sd.prep_days}d prep`}
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {'•'.repeat(sd.importance)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onEdit(sd)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
