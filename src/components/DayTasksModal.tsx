import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Edit, Play, PlayCircle, Users, Clock, MapPin, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
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
    <ResponsiveDialog
      open={isOpen}
      onOpenChange={onClose}
      title={`${formatDate(date)} • ${totalItems} item(s)`}
    >
      <div className="space-y-4">
        {/* Meetings Section */}
        {meetings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground px-1">
              <Users className="h-4 w-4" />
              Reuniões ({meetings.length})
            </h4>
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                onClick={() => handleOpenMeeting(meeting.id)}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border bg-card",
                  "hover:bg-accent/50 transition-colors cursor-pointer",
                  "touch-manipulation active:scale-[0.98]"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${meetingStatusColors[meeting.status] || "bg-sky-500"}`} />
                    <span className="font-medium truncate text-base">{meeting.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(meeting.start_time)} ({meeting.duration_minutes}min)
                    </span>
                    {meeting.location && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{meeting.location}</span>
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0 ml-2"
                  title="Abrir reunião"
                >
                  <ExternalLink className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Tasks Section */}
        {tasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground px-1">
              <Play className="h-4 w-4" />
              Tarefas ({tasks.length})
            </h4>
            {tasks.map((task) => {
              const node = nodesMap[task.node_id];
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border bg-card",
                    "hover:bg-accent/50 transition-colors",
                    "touch-manipulation active:scale-[0.98]"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColors[task.status] || "bg-gray-400"}`} />
                      <span className="font-medium truncate text-base">{task.title}</span>
                    </div>
                    {node && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <div 
                          className="w-2 h-2 rounded-full shrink-0" 
                          style={{ backgroundColor: node.color }} 
                        />
                        {node.title}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => window.open(`/task/${task.id}`, "_blank")}
                      title="Abrir tarefa"
                      className="h-10 w-10"
                    >
                      <ExternalLink className="h-5 w-5" />
                    </Button>
                    {task.status !== "andamento" && task.status !== "concluído" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleStartTask(task.id)}
                        disabled={loading === task.id}
                        title="Iniciar agora"
                        className="h-10 w-10 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <Play className="h-5 w-5" />
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
                className="w-full h-12 text-base"
                variant="outline"
              >
                <PlayCircle className="h-5 w-5 mr-2" />
                Iniciar todas do dia ({pendingCount})
              </Button>
            )}
          </div>
        )}

        {/* Empty state */}
        {totalItems === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Nenhum item neste dia</p>
          </div>
        )}

        {/* Create buttons - Large touch targets */}
        {(onCreateTask || onCreateMeeting) && (
          <div className="flex gap-3 pt-4 border-t">
            {onCreateTask && (
              <Button 
                variant="outline" 
                className="flex-1 h-12 text-base touch-manipulation active:scale-[0.98]" 
                onClick={onCreateTask}
              >
                <Plus className="h-5 w-5 mr-2" />
                Tarefa
              </Button>
            )}
            {onCreateMeeting && (
              <Button 
                variant="outline" 
                className="flex-1 h-12 text-base touch-manipulation active:scale-[0.98]" 
                onClick={onCreateMeeting}
              >
                <Users className="h-5 w-5 mr-2" />
                Reunião
              </Button>
            )}
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
