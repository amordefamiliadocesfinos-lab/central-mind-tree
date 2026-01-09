import { SeasonalOccurrence } from '@/hooks/useSeasonalDays';
import { cn } from '@/lib/utils';

interface SeasonalBadgeProps {
  occurrence: SeasonalOccurrence;
  compact?: boolean;
  onClick?: () => void;
}

export const SeasonalBadge = ({ occurrence, compact = false, onClick }: SeasonalBadgeProps) => {
  const { seasonalDay, isPrepDay, prepDaysRemaining } = occurrence;

  const importanceDots = '•'.repeat(seasonalDay.importance);

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'absolute bottom-0.5 left-0.5 right-0.5 h-1.5 rounded-full cursor-pointer',
          isPrepDay && 'opacity-50'
        )}
        style={{ backgroundColor: seasonalDay.color }}
        title={isPrepDay ? `${seasonalDay.name} (prep -${prepDaysRemaining}d)` : seasonalDay.name}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-white cursor-pointer',
        'hover:opacity-90 transition-opacity',
        isPrepDay && 'opacity-70'
      )}
      style={{ backgroundColor: seasonalDay.color }}
    >
      <span className="truncate max-w-[120px]">
        {isPrepDay ? `⏳ ${seasonalDay.name}` : seasonalDay.name}
      </span>
      <span className="opacity-80 shrink-0">{importanceDots}</span>
    </div>
  );
};
