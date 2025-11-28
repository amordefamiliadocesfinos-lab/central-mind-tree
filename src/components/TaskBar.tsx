import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Task {
  id: string;
  node_id: string;
  title: string;
  description: string | null;
  status: "estrutural" | "andamento" | "pendente" | "concluído";
  dependency_id: string | null;
  progress: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface TaskBarProps {
  showNodeLines: boolean;
  onToggleNodeLines: () => void;
}

export function TaskBar({ showNodeLines, onToggleNodeLines }: TaskBarProps) {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel('tasks-bar')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTasks(data as Task[]);
    }
  };

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "estrutural":
        return "bg-node-roxo";
      case "andamento":
        return "bg-node-vermelho";
      case "pendente":
        return "bg-node-amarelo";
      case "concluído":
        return "bg-node-verde";
    }
  };

  const statusCounts = {
    estrutural: tasks.filter(t => t.status === "estrutural").length,
    andamento: tasks.filter(t => t.status === "andamento").length,
    pendente: tasks.filter(t => t.status === "pendente").length,
    concluído: tasks.filter(t => t.status === "concluído").length,
  };

  if (tasks.length === 0) return null;

  return (
    <div className="flex items-center gap-2 pb-3 border-b">
      {/* Status counter buttons */}
      <button
        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
          statusCounts.estrutural > 0 ? "bg-node-roxo text-white" : "bg-muted text-muted-foreground"
        }`}
        title={`Estrutural: ${statusCounts.estrutural}`}
      >
        {statusCounts.estrutural}
      </button>
      
      <button
        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
          statusCounts.andamento > 0 ? "bg-node-vermelho text-white" : "bg-muted text-muted-foreground"
        }`}
        title={`Em andamento: ${statusCounts.andamento}`}
      >
        {statusCounts.andamento}
      </button>
      
      <button
        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
          statusCounts.pendente > 0 ? "bg-node-amarelo text-white" : "bg-muted text-muted-foreground"
        }`}
        title={`Pendente: ${statusCounts.pendente}`}
      >
        {statusCounts.pendente}
      </button>
      
      <button
        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
          statusCounts.concluído > 0 ? "bg-node-verde text-white" : "bg-muted text-muted-foreground"
        }`}
        title={`Concluído: ${statusCounts.concluído}`}
      >
        {statusCounts.concluído}
      </button>

      {/* Divider */}
      <div className="h-6 w-px bg-border mx-1" />

      {/* Toggle connections button */}
      <Button
        size="sm"
        variant={showNodeLines ? "default" : "ghost"}
        className="h-8 px-3 text-xs"
        onClick={onToggleNodeLines}
        title={showNodeLines ? "Ocultar linhas" : "Mostrar linhas"}
      >
        Linhas
      </Button>
    </div>
  );
}