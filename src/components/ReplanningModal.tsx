import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CalendarCheck, CheckCircle2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  node_id: string;
  progress: number;
}

interface Node {
  id: string;
  title: string;
}

interface ReplanningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG = {
  estrutural: { label: "Estrutural", color: "bg-purple-500" },
  andamento: { label: "Em Andamento", color: "bg-red-500" },
  pendente: { label: "Pendente", color: "bg-yellow-500" },
  concluido: { label: "Concluído", color: "bg-green-500" },
};

export function ReplanningModal({ open, onOpenChange }: ReplanningModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nodes, setNodes] = useState<Record<string, Node>>({});
  const [updatedStatuses, setUpdatedStatuses] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTasks();
    }
  }, [open]);

  const fetchTasks = async () => {
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("id, title, description, status, node_id, progress")
      .in("status", ["pendente", "andamento"])
      .order("status")
      .order("order_index");

    if (tasksData) {
      setTasks(tasksData);
      setUpdatedStatuses({});
      
      const nodeIds = [...new Set(tasksData.map((t) => t.node_id))];
      if (nodeIds.length > 0) {
        const { data: nodesData } = await supabase
          .from("nodes")
          .select("id, title")
          .in("id", nodeIds);
        if (nodesData) {
          setNodes(Object.fromEntries(nodesData.map((n) => [n.id, n])));
        }
      }
    }
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    setUpdatedStatuses((prev) => ({ ...prev, [taskId]: newStatus }));
  };

  const handleSaveAll = async () => {
    const updates = Object.entries(updatedStatuses);
    if (updates.length === 0) {
      toast({ title: "Nenhuma alteração para salvar" });
      return;
    }

    for (const [taskId, status] of updates) {
      await supabase.from("tasks").update({ status }).eq("id", taskId);
    }

    toast({ title: `${updates.length} tarefa(s) atualizada(s)` });
    fetchTasks();
  };

  const handleMarkAllComplete = async (status: "pendente" | "andamento") => {
    const tasksToUpdate = tasks.filter((t) => t.status === status);
    for (const task of tasksToUpdate) {
      await supabase.from("tasks").update({ status: "concluido" }).eq("id", task.id);
    }
    toast({ title: `${tasksToUpdate.length} tarefa(s) concluída(s)` });
    fetchTasks();
  };

  const pendenteTasks = tasks.filter(
    (t) => (updatedStatuses[t.id] || t.status) === "pendente"
  );
  const andamentoTasks = tasks.filter(
    (t) => (updatedStatuses[t.id] || t.status) === "andamento"
  );

  const hasChanges = Object.keys(updatedStatuses).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Replanejamento Semanal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tarefas em Andamento */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                Em Andamento ({andamentoTasks.length})
              </h3>
              {andamentoTasks.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => handleMarkAllComplete("andamento")}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Concluir todas
                </Button>
              )}
            </div>
            {andamentoTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa em andamento</p>
            ) : (
              <div className="space-y-2">
                {andamentoTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    nodeName={nodes[task.node_id]?.title}
                    currentStatus={updatedStatuses[task.id] || task.status}
                    onStatusChange={(status) => handleStatusChange(task.id, status)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Tarefas Pendentes */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                Pendentes ({pendenteTasks.length})
              </h3>
              {pendenteTasks.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => handleMarkAllComplete("pendente")}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Concluir todas
                </Button>
              )}
            </div>
            {pendenteTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente</p>
            ) : (
              <div className="space-y-2">
                {pendenteTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    nodeName={nodes[task.node_id]?.title}
                    currentStatus={updatedStatuses[task.id] || task.status}
                    onStatusChange={(status) => handleStatusChange(task.id, status)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {hasChanges && (
              <Button onClick={handleSaveAll}>
                Salvar alterações ({Object.keys(updatedStatuses).length})
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TaskRowProps {
  task: Task;
  nodeName?: string;
  currentStatus: string;
  onStatusChange: (status: string) => void;
}

function TaskRow({ task, nodeName, currentStatus, onStatusChange }: TaskRowProps) {
  const statusConfig = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG];
  const hasChanged = currentStatus !== task.status;

  return (
    <div
      className={`p-3 rounded-lg border bg-card ${
        hasChanged ? "border-primary" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{task.title}</p>
          <p className="text-xs text-muted-foreground">{nodeName || "Nó desconhecido"}</p>
          {task.progress > 0 && (
            <Badge variant="outline" className="mt-1 text-xs">
              {task.progress}%
            </Badge>
          )}
        </div>
        <Select value={currentStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${statusConfig?.color}`} />
                {statusConfig?.label}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${config.color}`} />
                  {config.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
