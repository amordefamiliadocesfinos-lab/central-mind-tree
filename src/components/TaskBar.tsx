import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Network, List } from "lucide-react";

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

export function TaskBar() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showConnections, setShowConnections] = useState(true);

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

  const renderTasksWithConnections = () => {
    if (!showConnections) {
      return (
        <div className="flex gap-2 flex-wrap">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`h-6 w-6 rounded-full ${getStatusColor(task.status)}`}
              title={task.title}
            />
          ))}
        </div>
      );
    }

    // Simple dependency visualization
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const rendered = new Set<string>();

    const renderTaskChain = (task: Task, level = 0) => {
      if (rendered.has(task.id)) return null;
      rendered.add(task.id);

      const dependentTasks = tasks.filter(t => t.dependency_id === task.id);

      return (
        <div key={task.id} className="flex items-center gap-2" style={{ marginLeft: level * 32 }}>
          <div
            className={`h-6 w-6 rounded-full ${getStatusColor(task.status)} flex-shrink-0`}
            title={task.title}
          />
          {dependentTasks.length > 0 && (
            <svg width="20" height="2" className="flex-shrink-0">
              <line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeWidth="1" opacity="0.3" />
            </svg>
          )}
          <div className="flex flex-col gap-1">
            {dependentTasks.map(dt => renderTaskChain(dt, level + 1))}
          </div>
        </div>
      );
    };

    const rootTasks = tasks.filter(t => !t.dependency_id);

    return (
      <div className="flex flex-col gap-2">
        {rootTasks.map(task => renderTaskChain(task))}
      </div>
    );
  };

  if (tasks.length === 0) return null;

  return (
    <Card className="fixed left-5 bottom-[120px] z-[9999] p-3 shadow-lg max-w-[400px] max-h-[300px] overflow-auto">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-muted-foreground">
            Tarefas ({tasks.length})
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setShowConnections(!showConnections)}
            title={showConnections ? "Ocultar conexões" : "Mostrar conexões"}
          >
            {showConnections ? <Network className="h-3 w-3" /> : <List className="h-3 w-3" />}
          </Button>
        </div>
        {renderTasksWithConnections()}
      </div>
    </Card>
  );
}