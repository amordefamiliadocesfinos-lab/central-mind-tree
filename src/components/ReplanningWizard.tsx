import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Check,
  CalendarIcon,
  AlertTriangle,
  Target,
  Clock,
  Package,
  Bell,
  FileText,
  Loader2,
} from "lucide-react";
import { format, parseISO, addDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useReplanningWizard, WizardStep, WizardTask } from "@/hooks/useReplanningWizard";

const STATUS_CONFIG = {
  estrutural: { label: "Estrutural", color: "bg-purple-500" },
  andamento: { label: "Em Andamento", color: "bg-red-500" },
  pendente: { label: "Pendente", color: "bg-yellow-500" },
  concluido: { label: "Concluído", color: "bg-green-500" },
};

const STEP_ICONS: Record<WizardStep, React.ReactNode> = {
  priorities: <Target className="h-5 w-5" />,
  overdue: <AlertTriangle className="h-5 w-5" />,
  calendar: <CalendarIcon className="h-5 w-5" />,
  production: <Package className="h-5 w-5" />,
  blocks: <Clock className="h-5 w-5" />,
  alerts: <Bell className="h-5 w-5" />,
  summary: <FileText className="h-5 w-5" />,
};

interface ReplanningWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReplanningWizard({ open, onOpenChange }: ReplanningWizardProps) {
  const wizard = useReplanningWizard();
  const [applying, setApplying] = useState(false);

  // Sync external open state with wizard
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      wizard.open();
    } else {
      wizard.close();
    }
    onOpenChange(newOpen);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await wizard.applyChanges();
      toast.success("Replanejamento aplicado com sucesso!", {
        action: {
          label: "Ir para Foco",
          onClick: () => (window.location.href = "/foco"),
        },
      });
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao aplicar mudanças");
    } finally {
      setApplying(false);
    }
  };

  const progressPercent = ((wizard.currentStepIndex + 1) / wizard.totalSteps) * 100;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              {STEP_ICONS[wizard.currentStep]}
              <span>{wizard.stepLabel}</span>
              <Badge variant="outline" className="ml-2">
                {wizard.currentStepIndex + 1} / {wizard.totalSteps}
              </Badge>
            </DialogTitle>
          </div>
          <Progress value={progressPercent} className="h-1 mt-3" />
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-4">
          {wizard.loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <StepContent wizard={wizard} />
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-muted/30">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={wizard.goToPrevious}
              disabled={wizard.isFirstStep}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
          </div>

          <div className="flex gap-2">
            {!wizard.isLastStep && (
              <Button variant="outline" size="sm" onClick={wizard.skipStep}>
                <SkipForward className="h-4 w-4 mr-1" />
                Pular
              </Button>
            )}

            {wizard.isLastStep ? (
              <Button onClick={handleApply} disabled={applying}>
                {applying ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Aplicar Mudanças
              </Button>
            ) : (
              <Button onClick={wizard.goToNext}>
                Próximo
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Step content renderer
function StepContent({ wizard }: { wizard: ReturnType<typeof useReplanningWizard> }) {
  switch (wizard.currentStep) {
    case "priorities":
      return <PrioritiesStep wizard={wizard} />;
    case "overdue":
      return <OverdueStep wizard={wizard} />;
    case "calendar":
      return <CalendarStep wizard={wizard} />;
    case "production":
      return <ProductionStep wizard={wizard} />;
    case "blocks":
      return <BlocksStep wizard={wizard} />;
    case "alerts":
      return <AlertsStep wizard={wizard} />;
    case "summary":
      return <SummaryStep wizard={wizard} />;
    default:
      return null;
  }
}

// Step 1: Priorities
function PrioritiesStep({ wizard }: { wizard: ReturnType<typeof useReplanningWizard> }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Revise suas tarefas prioritárias (Estrutural primeiro, depois Em Andamento).
      </p>

      {wizard.priorityTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma tarefa prioritária no momento.
        </div>
      ) : (
        <div className="space-y-2">
          {wizard.priorityTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentStatus={wizard.changes.taskStatuses[task.id] || task.status}
              onStatusChange={(status) => wizard.updateTaskStatus(task.id, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Step 2: Overdue
function OverdueStep({ wizard }: { wizard: ReturnType<typeof useReplanningWizard> }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Estas tarefas estão atrasadas. Reagende ou atualize o status.
      </p>

      {wizard.overdueTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
          Nenhuma tarefa atrasada! 🎉
        </div>
      ) : (
        <div className="space-y-2">
          {wizard.overdueTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentStatus={wizard.changes.taskStatuses[task.id] || task.status}
              scheduledDate={wizard.changes.taskSchedules[task.id]}
              onStatusChange={(status) => wizard.updateTaskStatus(task.id, status)}
              onSchedule={(date) => wizard.scheduleTask(task.id, date)}
              showScheduler
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Step 3: Calendar distribution
function CalendarStep({ wizard }: { wizard: ReturnType<typeof useReplanningWizard> }) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Distribua as tarefas sem agendamento pelos dias da semana.
      </p>

      {wizard.unscheduledTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
          Todas as tarefas já estão agendadas!
        </div>
      ) : (
        <div className="space-y-2">
          {wizard.unscheduledTasks.slice(0, 10).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentStatus={wizard.changes.taskStatuses[task.id] || task.status}
              scheduledDate={wizard.changes.taskSchedules[task.id]}
              onStatusChange={(status) => wizard.updateTaskStatus(task.id, status)}
              onSchedule={(date) => wizard.scheduleTask(task.id, date)}
              showScheduler
            />
          ))}
          {wizard.unscheduledTasks.length > 10 && (
            <p className="text-sm text-muted-foreground text-center pt-2">
              + {wizard.unscheduledTasks.length - 10} tarefas adicionais
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Step 4: Production
function ProductionStep({ wizard }: { wizard: ReturnType<typeof useReplanningWizard> }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Revise os pedidos pendentes e o planejamento de produção.
      </p>

      {wizard.orders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
          Nenhum pedido pendente no momento.
        </div>
      ) : (
        <div className="space-y-2">
          {wizard.orders.map((order) => (
            <div
              key={order.id}
              className="p-3 rounded-lg border bg-card flex items-center justify-between"
            >
              <div>
                <p className="font-medium">
                  {order.order_number || "Pedido sem número"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {order.customer_name || "Cliente não informado"}
                </p>
              </div>
              <div className="text-right">
                <Badge variant="outline">{order.status}</Badge>
                {order.due_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Entrega: {format(parseISO(order.due_date), "dd/MM")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Step 5: Blocks
function BlocksStep({ wizard }: { wizard: ReturnType<typeof useReplanningWizard> }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ajuste os blocos de trabalho do dia (foco e pausas).
      </p>

      {wizard.blocks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum bloco de rotina configurado para hoje.
          <p className="text-xs mt-2">
            Configure sua rotina na página Rotina.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {wizard.blocks.map((block) => (
            <div
              key={block.id}
              className="p-3 rounded-lg border bg-card flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-3 h-3 rounded-full",
                    block.block_type === "foco" && "bg-purple-500",
                    block.block_type === "pausa" && "bg-green-500",
                    block.block_type === "reuniao" && "bg-blue-500"
                  )}
                />
                <div>
                  <p className="font-medium">{block.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {block.planned_start} - {block.planned_end} ({block.duration_minutes}min)
                  </p>
                </div>
              </div>
              <Badge variant="outline">{block.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Step 6: Alerts
function AlertsStep({ wizard }: { wizard: ReturnType<typeof useReplanningWizard> }) {
  const overdueTasks = wizard.overdueTasks;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Confira alertas e lembretes para seu bem-estar e produtividade.
      </p>

      <div className="space-y-3">
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="font-medium">Resumo de Alertas</span>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• {overdueTasks.length} tarefa(s) atrasada(s)</li>
            <li>• {wizard.blocks.filter((b) => b.block_type === "pausa").length} pausa(s) programada(s) hoje</li>
            <li>• Lembre-se de fazer pausas regulares!</li>
          </ul>
        </div>

        <div className="p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Dica de Bem-estar</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Faça uma pausa de 5 minutos a cada 25 minutos de trabalho focado. 
            Levante, alongue-se e hidrate-se.
          </p>
        </div>
      </div>
    </div>
  );
}

// Step 7: Summary
function SummaryStep({ wizard }: { wizard: ReturnType<typeof useReplanningWizard> }) {
  const { scheduledCount, statusChangedCount, skippedStepsCount } = wizard.changeSummary;
  const hasChanges = scheduledCount > 0 || statusChangedCount > 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Revise as mudanças antes de aplicar.
      </p>

      <div className="p-4 rounded-lg border bg-card space-y-3">
        <h3 className="font-medium">Resumo do Replanejamento</h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 rounded bg-muted/50">
            <p className="text-2xl font-bold text-primary">{scheduledCount}</p>
            <p className="text-muted-foreground">Tarefas agendadas</p>
          </div>
          <div className="p-3 rounded bg-muted/50">
            <p className="text-2xl font-bold text-primary">{statusChangedCount}</p>
            <p className="text-muted-foreground">Status alterados</p>
          </div>
        </div>

        {skippedStepsCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {skippedStepsCount} passo(s) pulado(s)
          </p>
        )}

        {!hasChanges && (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma mudança realizada nesta sessão.
          </p>
        )}
      </div>

      <div className="p-4 rounded-lg border bg-primary/5">
        <p className="text-sm">
          Ao clicar em <strong>Aplicar Mudanças</strong>, todas as alterações serão 
          salvas no banco de dados e o planejamento será marcado como concluído.
        </p>
      </div>
    </div>
  );
}

// Reusable task card component
interface TaskCardProps {
  task: WizardTask;
  currentStatus: string;
  scheduledDate?: string;
  onStatusChange: (status: string) => void;
  onSchedule?: (date: string) => void;
  showScheduler?: boolean;
}

function TaskCard({
  task,
  currentStatus,
  scheduledDate,
  onStatusChange,
  onSchedule,
  showScheduler,
}: TaskCardProps) {
  const statusConfig = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG];
  const hasStatusChange = currentStatus !== task.status;
  const hasScheduleChange = scheduledDate && scheduledDate !== task.scheduled_date;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border bg-card",
        (hasStatusChange || hasScheduleChange) && "border-primary"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{task.title}</p>
          <p className="text-xs text-muted-foreground">{task.node_title || "Nó desconhecido"}</p>
          {task.due_date && (
            <Badge variant="outline" className="mt-1 text-xs">
              Prazo: {format(parseISO(task.due_date), "dd/MM")}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showScheduler && onSchedule && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {scheduledDate
                    ? format(parseISO(scheduledDate), "dd/MM")
                    : "Agendar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={scheduledDate ? parseISO(scheduledDate) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      onSchedule(format(date, "yyyy-MM-dd"));
                    }
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          )}

          <Select value={currentStatus} onValueChange={onStatusChange}>
            <SelectTrigger className="w-[130px] h-8">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full", statusConfig?.color)} />
                  <span className="text-xs">{statusConfig?.label}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                <SelectItem key={value} value={value}>
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", config.color)} />
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
