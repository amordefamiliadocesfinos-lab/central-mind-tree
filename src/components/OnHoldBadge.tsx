import { Clock, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, parseISO, isBefore, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OnHoldBadgeProps {
  onHold: boolean;
  who?: string | null;
  channel?: string | null;
  deadline?: string | null;
  note?: string | null;
  compact?: boolean;
}

export const OnHoldBadge = ({
  onHold,
  who,
  channel,
  deadline,
  note,
  compact = false,
}: OnHoldBadgeProps) => {
  if (!onHold) return null;

  const deadlineDate = deadline ? parseISO(deadline) : null;
  const isOverdue = deadlineDate && isBefore(deadlineDate, new Date()) && !isToday(deadlineDate);
  const isDueToday = deadlineDate && isToday(deadlineDate);

  const tooltipContent = (
    <div className="space-y-1 text-xs">
      {who && <div><strong>Aguardando:</strong> {who}</div>}
      {channel && <div><strong>Canal:</strong> {channel}</div>}
      {deadline && (
        <div className={isOverdue ? "text-destructive" : isDueToday ? "text-amber-500" : ""}>
          <strong>Prazo:</strong> {format(parseISO(deadline), "dd/MM/yyyy", { locale: ptBR })}
          {isOverdue && " (atrasado)"}
          {isDueToday && " (hoje)"}
        </div>
      )}
      {note && <div><strong>Nota:</strong> {note}</div>}
    </div>
  );

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={`px-1.5 py-0.5 ${
                isOverdue 
                  ? "border-destructive text-destructive" 
                  : isDueToday 
                    ? "border-amber-500 text-amber-500"
                    : "border-blue-500 text-blue-500"
              }`}
            >
              {isDueToday ? (
                <Bell className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="font-medium mb-1">Em Espera</div>
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`gap-1 ${
              isOverdue 
                ? "border-destructive text-destructive" 
                : isDueToday 
                  ? "border-amber-500 text-amber-500"
                  : "border-blue-500 text-blue-500"
            }`}
          >
            {isDueToday ? (
              <Bell className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            Em Espera
            {isDueToday && " (hoje)"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
