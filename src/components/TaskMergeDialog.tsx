import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, AlertTriangle, Merge } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MergeableTask } from "@/hooks/useTaskMerge";

interface TaskMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: MergeableTask[];
  onConfirm: (targetId: string, newDate: string | null) => void;
}

export const TaskMergeDialog = ({
  open,
  onOpenChange,
  tasks,
  onConfirm,
}: TaskMergeDialogProps) => {
  const [targetId, setTargetId] = useState<string>(tasks[0]?.id || "");
  const [useNewDate, setUseNewDate] = useState(false);
  const [newDate, setNewDate] = useState<Date | null>(null);

  // Check for structural tasks
  const hasStructural = tasks.some((t) => t.status === "estrutural");

  const handleConfirm = () => {
    if (!targetId) return;
    onConfirm(
      targetId,
      useNewDate ? (newDate?.toISOString().split("T")[0] || null) : undefined as any
    );
    onOpenChange(false);
  };

  const targetTask = tasks.find((t) => t.id === targetId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Unificar Tarefas
          </DialogTitle>
          <DialogDescription>
            Selecione a tarefa principal. As outras serão mescladas nela.
          </DialogDescription>
        </DialogHeader>

        {hasStructural && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">
              Não é possível unificar tarefas Estruturais. Remova-as da seleção.
            </p>
          </div>
        )}

        {!hasStructural && (
          <>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Tarefa Principal ({tasks.length} selecionadas)
                </Label>
                <RadioGroup value={targetId} onValueChange={setTargetId}>
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        targetId === task.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => setTargetId(task.id)}
                    >
                      <RadioGroupItem value={task.id} id={task.id} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={task.id} className="font-medium cursor-pointer">
                          {task.title}
                        </Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {task.status}
                          </Badge>
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground">
                              Prazo: {format(parseISO(task.due_date), "dd/MM", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="use-new-date"
                    checked={useNewDate}
                    onCheckedChange={(checked) => setUseNewDate(checked as boolean)}
                  />
                  <Label htmlFor="use-new-date" className="text-sm">
                    Definir nova data para a tarefa unificada
                  </Label>
                </div>

                {useNewDate && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newDate
                          ? format(newDate, "PPP", { locale: ptBR })
                          : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newDate || undefined}
                        onSelect={(date) => setNewDate(date || null)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p className="font-medium">O que será unificado:</p>
                <ul className="text-muted-foreground text-xs space-y-0.5">
                  <li>• Descrições serão concatenadas</li>
                  <li>• Checklists serão combinados</li>
                  <li>• Anexos serão mesclados</li>
                  <li>• Progresso será a média das tarefas</li>
                  <li>• Nó da tarefa principal será mantido</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={!targetId}>
                <Merge className="h-4 w-4 mr-2" />
                Unificar ({tasks.length} tarefas)
              </Button>
            </DialogFooter>
          </>
        )}

        {hasStructural && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
