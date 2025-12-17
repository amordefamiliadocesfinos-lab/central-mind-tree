import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, Calendar, AlertTriangle, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlanningChange {
  type: "schedule" | "status" | "priority";
  taskId: string;
  taskTitle: string;
  oldValue?: string;
  newValue?: string;
}

interface PlanningConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: PlanningChange[];
  onConfirm: () => void;
  loading?: boolean;
}

export const PlanningConfirmationDialog = ({
  open,
  onOpenChange,
  changes,
  onConfirm,
  loading = false,
}: PlanningConfirmationDialogProps) => {
  const scheduleChanges = changes.filter((c) => c.type === "schedule");
  const statusChanges = changes.filter((c) => c.type === "status");
  const priorityChanges = changes.filter((c) => c.type === "priority");

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy (EEE)", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Confirmar Planejamento
          </DialogTitle>
          <DialogDescription>
            Revise as alterações antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6">
            {scheduleChanges.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 font-medium mb-3">
                  <Calendar className="h-4 w-4" />
                  Agendamentos ({scheduleChanges.length})
                </h3>
                <div className="space-y-2">
                  {scheduleChanges.map((change, i) => (
                    <div
                      key={`${change.taskId}-${i}`}
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="font-medium text-sm">{change.taskTitle}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {change.oldValue ? (
                          <>
                            {formatDate(change.oldValue)} → {formatDate(change.newValue)}
                          </>
                        ) : (
                          <>Agendado para: {formatDate(change.newValue)}</>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {statusChanges.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 font-medium mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  Alterações de Status ({statusChanges.length})
                </h3>
                <div className="space-y-2">
                  {statusChanges.map((change, i) => (
                    <div
                      key={`${change.taskId}-${i}`}
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="font-medium text-sm">{change.taskTitle}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {change.oldValue}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge className="text-xs">
                          {change.newValue}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {priorityChanges.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 font-medium mb-3">
                  <Clock className="h-4 w-4" />
                  Prioridades ({priorityChanges.length})
                </h3>
                <div className="space-y-2">
                  {priorityChanges.map((change, i) => (
                    <div
                      key={`${change.taskId}-${i}`}
                      className="p-3 rounded-lg border bg-card flex items-center gap-2"
                    >
                      <Badge variant="outline" className="text-xs">
                        #{i + 1}
                      </Badge>
                      <span className="font-medium text-sm">{change.taskTitle}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {changes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma alteração para aplicar.
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <p className="text-muted-foreground">
            <strong>Resumo:</strong> {scheduleChanges.length} agendamento(s), {statusChanges.length} status, {priorityChanges.length} prioridade(s)
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Revisar
          </Button>
          <Button onClick={onConfirm} disabled={loading || changes.length === 0}>
            {loading ? "Aplicando..." : "Aplicar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
