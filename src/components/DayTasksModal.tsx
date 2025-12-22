import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Edit, Play, PlayCircle, Users, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Meeting } from "@/hooks/useMeetings";

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
  meetings?: Meeting[];
  nodesMap: Record<string, Node>;
  onTaskUpdated: () => void;
  onCreateTask?: () => void;
  onCreateMeeting?: () => void;
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

const meetingStatusColors: Record<string, string> = {
  agendada: "bg-sky-500",
  em_andamento: "bg-blue-600",
  concluida: "bg-green-500",
  cancelada: "bg-gray-400",
};

export function DayTasksModal({ 
  isOpen, 
  onClose, 
  date, 
  tasks, 
  meetings = [],
  nodesMap, 
  onTaskUpdated,
  onCreateTask,
  onCreateMeeting,
}: DayTasksModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const navigate = useNavigate();

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

  const handleOpenMeeting = (meetingId: string) => {
    onClose();
    navigate(`/reunioes/${meetingId}`);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatTime = (time: string) => time.slice(0, 5);

  const pendingCount = tasks.filter(t => t.status !== "andamento" && t.status !== "concluído").length;
  const totalItems = tasks.length + meetings.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {formatDate(date)}
            <Badge variant="secondary">{totalItems} item(s)</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Meetings Section */}
          {meetings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                Reuniões ({meetings.length})
              </h4>
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  onClick={() => handleOpenMeeting(meeting.id)}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${meetingStatusColors[meeting.status] || "bg-sky-500"}`} />
                      <span className="font-medium truncate">{meeting.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(meeting.start_time)} ({meeting.duration_minutes}min)
                      </span>
                      {meeting.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {meeting.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Abrir reunião"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Tasks Section */}
          {tasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Play className="h-4 w-4" />
                Tarefas ({tasks.length})
              </h4>
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
                  className="w-full"
                  variant="outline"
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Iniciar todas do dia ({pendingCount})
                </Button>
              )}
            </div>
          )}

          {/* Empty state */}
          {totalItems === 0 && (
            <p className="text-muted-foreground text-center py-4">Nenhum item neste dia</p>
          )}

          {/* Create buttons */}
          {(onCreateTask || onCreateMeeting) && (
            <div className="flex gap-2 pt-2 border-t">
              {onCreateTask && (
                <Button variant="outline" size="sm" className="flex-1" onClick={onCreateTask}>
                  <Play className="h-4 w-4 mr-1" />
                  Nova Tarefa
                </Button>
              )}
              {onCreateMeeting && (
                <Button variant="outline" size="sm" className="flex-1" onClick={onCreateMeeting}>
                  <Users className="h-4 w-4 mr-1" />
                  Nova Reunião
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
