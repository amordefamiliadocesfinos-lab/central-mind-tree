import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Edit, Play, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  status: string;
  node_id: string;
  scheduled_date: string | null;
}

interface Node {
  id: string;
  title: string;
  color: string;
}

interface DayTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  tasks: Task[];
  nodesMap: Record<string, Node>;
  onTaskUpdated: () => void;
}

const statusColors: Record<string, string> = {
  estrutural: "bg-purple-500",
  andamento: "bg-red-500",
  pendente: "bg-yellow-500",
  concluído: "bg-green-500",
};

const statusLabels: Record<string, string> = {
  estrutural: "Estrutural",
  andamento: "Em Andamento",
  pendente: "Pendente",
  concluído: "Concluído",
};

export function DayTasksModal({ isOpen, onClose, date, tasks, nodesMap, onTaskUpdated }: DayTasksModalProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleStartTask = async (taskId: string) => {
    setLoading(taskId);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "andamento", updated_at: new Date().toISOString() })
        .eq("id", taskId);

      if (error) throw error;
      toast({ title: "Tarefa iniciada", description: "Status alterado para Em Andamento" });
      onTaskUpdated();
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível iniciar a tarefa", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleStartAllTasks = async () => {
    const pendingTasks = tasks.filter(t => t.status !== "andamento" && t.status !== "concluído");
    if (pendingTasks.length === 0) return;

    setLoading("all");
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "andamento", updated_at: new Date().toISOString() })
        .in("id", pendingTasks.map(t => t.id));

      if (error) throw error;
      toast({ title: "Tarefas iniciadas", description: `${pendingTasks.length} tarefas em andamento` });
      onTaskUpdated();
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível iniciar as tarefas", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const pendingCount = tasks.filter(t => t.status !== "andamento" && t.status !== "concluído").length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Tarefas em {formatDate(date)}
            <Badge variant="secondary">{tasks.length}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhuma tarefa agendada</p>
          ) : (
            <>
              {tasks.map((task) => {
                const node = nodesMap[task.node_id];
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${statusColors[task.status] || "bg-gray-400"}`} />
                        <span className="font-medium truncate">{task.title}</span>
                      </div>
                      {node && (
                        <span className="text-xs text-muted-foreground">
                          {node.title}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`/task/${task.id}`, "_blank")}
                        title="Abrir tarefa"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`/task/${task.id}`, "_blank")}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {task.status !== "andamento" && task.status !== "concluído" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartTask(task.id)}
                          disabled={loading === task.id}
                          title="Iniciar agora"
                          className="text-green-600 hover:text-green-700"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {pendingCount > 1 && (
                <Button
                  onClick={handleStartAllTasks}
                  disabled={loading === "all"}
                  className="w-full mt-4"
                  variant="outline"
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Iniciar todas do dia ({pendingCount})
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
