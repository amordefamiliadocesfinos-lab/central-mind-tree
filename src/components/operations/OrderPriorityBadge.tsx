import { differenceInDays, startOfDay, parseISO } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNowSaoPaulo } from '@/lib/dateUtils';

export type PriorityLevel = 'atrasado' | 'urgente' | 'alta' | 'atencao' | 'normal';

export interface PriorityInfo {
  level: PriorityLevel;
  label: string;
  sortOrder: number;
}

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  atrasado: 'bg-red-900/20 text-red-700 dark:text-red-400 border-red-700/30',
  urgente: 'bg-destructive/15 text-destructive border-destructive/30',
  alta: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  atencao: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  normal: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
};

export function getOrderPriority(dueDate: string | null | undefined): PriorityInfo | null {
  if (!dueDate) return null;

  const today = startOfDay(getNowSaoPaulo());
  const due = startOfDay(parseISO(dueDate));
  const diff = differenceInDays(due, today);

  if (diff < 0) return { level: 'atrasado', label: 'Atrasado', sortOrder: 0 };
  if (diff === 0) return { level: 'urgente', label: 'Urgente', sortOrder: 1 };
  if (diff === 1) return { level: 'alta', label: 'Alta', sortOrder: 2 };
  if (diff <= 3) return { level: 'atencao', label: 'Atenção', sortOrder: 3 };
  return { level: 'normal', label: 'Normal', sortOrder: 4 };
}

interface OrderPriorityBadgeProps {
  dueDate: string | null | undefined;
  className?: string;
}

export function OrderPriorityBadge({ dueDate, className }: OrderPriorityBadgeProps) {
  const priority = getOrderPriority(dueDate);
  if (!priority) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        PRIORITY_STYLES[priority.level],
        className
      )}
    >
      {priority.level === 'atrasado' && <AlertTriangle className="h-3 w-3" />}
      {priority.label}
    </span>
  );
}
