import { differenceInDays, parseISO, startOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DueDatePillProps {
  dueDate: string | null;
  className?: string;
}

export function DueDatePill({ dueDate, className }: DueDatePillProps) {
  if (!dueDate) return null;

  const today = startOfDay(new Date());
  const dueDateParsed = startOfDay(parseISO(dueDate));
  const daysDiff = differenceInDays(dueDateParsed, today);

  let colorClass = "bg-muted text-muted-foreground"; // Default: > 3 days (gray)
  
  if (daysDiff < 0) {
    // Overdue: red
    colorClass = "bg-destructive/20 text-destructive";
  } else if (daysDiff <= 3) {
    // Up to 3 days: yellow/amber
    colorClass = "bg-amber-500/20 text-amber-600";
  }

  const dateLabel = format(dueDateParsed, "dd/MM", { locale: ptBR });

  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap",
        colorClass,
        className
      )}
    >
      {dateLabel}
    </span>
  );
}
