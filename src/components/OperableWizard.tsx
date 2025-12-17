import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  ExternalLink,
  Loader2,
  Target,
  AlertTriangle,
  Clock,
  Package,
  Bell,
  FileText,
  Settings,
} from "lucide-react";
import { format, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOperableWizard, WizardStepConfig, WizardTask } from "@/hooks/useOperableWizard";

const STATUS_CONFIG = {
  estrutural: { label: "Estrutural", color: "bg-purple-500" },
  andamento: { label: "Em Andamento", color: "bg-red-500" },
  pendente: { label: "Pendente", color: "bg-yellow-500" },
  concluido: { label: "Concluído", color: "bg-green-500" },
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  priorities: <Target className="h-5 w-5" />,
  overdue: <AlertTriangle className="h-5 w-5" />,
  calendar: <CalendarIcon className="h-5 w-5" />,
  production: <Package className="h-5 w-5" />,
  blocks: <Clock className="h-5 w-5" />,
  alerts: <Bell className="h-5 w-5" />,
  summary: <FileText className="h-5 w-5" />,
};

interface OperableWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OperableWizard({ open, onOpenChange }: OperableWizardProps) {
  const wizard = useOperableWizard();
  const navigate = useNavigate();
  const [applying, setApplying] = useState(false);

  // Sync external open state with wizard
  useEffect(() => {
    if (open && !wizard.isOpen) {
      wizard.open();
    } else if (!open && wizard.isOpen) {
      wizard.close();
    }
  }, [open]);

  useEffect(() => {
    if (wizard.isOpen !== open) {
      onOpenChange(wizard.isOpen);
    }
  }, [wizard.isOpen]);

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
          onClick: () => navigate("/foco"),
        },
      });
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao aplicar mudanças");
    } finally {
      setApplying(false);
    }
  };

  const handleOpenModule = () => {
    wizard.openModuleForEdit();
    onOpenChange(false); // Close dialog while in module
  };

  const progressPercent = wizard.totalSteps > 0 
    ? ((wizard.currentStepIndex + 1) / wizard.totalSteps) * 100 
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
        {/* Header with step navigation */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              {wizard.currentStep && (
                <>
                  {STEP_ICONS[wizard.currentStep.step_key] || <Settings className="h-5 w-5" />}
                  <span>{wizard.currentStep.label}</span>
                </>
              )}
              <Badge variant="outline" className="ml-2">
                {wizard.currentStepIndex + 1} / {wizard.totalSteps}
              </Badge>
            </DialogTitle>
          </div>

          {/* Step indicators */}
          <div className="flex gap-1 mt-3">
            {wizard.steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => wizard.goToStep(index)}
                className={cn(
                  "flex-1 h-2 rounded-full transition-colors",
                  index < wizard.currentStepIndex && "bg-primary",
                  index === wizard.currentStepIndex && "bg-primary",
                  index > wizard.currentStepIndex && "bg-muted",
                  wizard.skippedSteps.includes(index) && "bg-muted-foreground/30"
                )}
                title={step.label}
              />
            ))}
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-4">
          {wizard.loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <StepContent wizard={wizard} onOpenModule={handleOpenModule} />
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
function StepContent({ 
  wizard, 
  onOpenModule 
}: { 
  wizard: ReturnType<typeof useOperableWizard>;
  onOpenModule: () => void;
}) {
  if (!wizard.currentStep) return null;

  const { step_key, module_route, label } = wizard.currentStep;

  // If step has a module route, show edit button
  if (module_route) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Este passo abre o módulo <strong>{label}</strong> para edição.
        </p>

        <div className="p-6 border rounded-lg bg-muted/30 text-center space-y-4">
          <div className="text-4xl">📝</div>
          <p className="text-sm text-muted-foreground">
            Clique no botão abaixo para abrir o módulo, fazer alterações e salvar.
            Ao salvar, você retornará automaticamente ao próximo passo.
          </p>
          <Button onClick={onOpenModule} size="lg">
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir {label}
          </Button>
        </div>

        {/* Show relevant tasks for context */}
        {step_key === "priorities" && <PriorityTaskList wizard={wizard} />}
        {step_key === "overdue" && <OverdueTaskList wizard={wizard} />}
      </div>
    );
  }

  // Steps without module route - inline content
  switch (step_key) {
    case "alerts":
      return <AlertsContent wizard={wizard} />;
    case "summary":
      return <SummaryContent wizard={wizard} />;
    default:
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>Passo configurado sem conteúdo específico.</p>
        </div>
      );
  }
}

function PriorityTaskList({ wizard }: { wizard: ReturnType<typeof useOperableWizard> }) {
  const priorityTasks = wizard.tasks
    .filter((t) => t.status === "estrutural" || t.status === "andamento")
    .slice(0, 5);

  if (priorityTasks.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-sm font-medium mb-2">Tarefas prioritárias atuais:</p>
      <div className="space-y-1">
        {priorityTasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2 text-sm p-2 bg-card rounded border">
            <div className={cn("w-2 h-2 rounded-full", STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG]?.color)} />
            <span className="truncate">{task.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverdueTaskList({ wizard }: { wizard: ReturnType<typeof useOperableWizard> }) {
  const overdueTasks = wizard.tasks.filter((t) => {
    if (!t.due_date) return false;
    return isBefore(parseISO(t.due_date), new Date()) && t.status !== "concluido";
  }).slice(0, 5);

  if (overdueTasks.length === 0) {
    return (
      <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
        <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <Check className="h-4 w-4" />
          Nenhuma tarefa atrasada!
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-sm font-medium mb-2 text-destructive">
        {overdueTasks.length} tarefa(s) atrasada(s):
      </p>
      <div className="space-y-1">
        {overdueTasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between text-sm p-2 bg-destructive/10 rounded border border-destructive/20">
            <span className="truncate">{task.title}</span>
            <Badge variant="destructive" className="text-xs">
              {format(parseISO(task.due_date!), "dd/MM")}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsContent({ wizard }: { wizard: ReturnType<typeof useOperableWizard> }) {
  const overdueTasks = wizard.tasks.filter((t) => {
    if (!t.due_date) return false;
    return isBefore(parseISO(t.due_date), new Date()) && t.status !== "concluido";
  });

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

function SummaryContent({ wizard }: { wizard: ReturnType<typeof useOperableWizard> }) {
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
            Nenhuma mudança registrada nesta sessão de wizard.
            As alterações feitas diretamente nos módulos já foram salvas.
          </p>
        )}
      </div>

      <div className="p-4 rounded-lg border bg-primary/5">
        <p className="text-sm">
          Ao clicar em <strong>Aplicar Mudanças</strong>, o planejamento será
          marcado como concluído.
        </p>
      </div>
    </div>
  );
}
