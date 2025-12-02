import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Task {
  id: string;
  title: string;
  description: string | null;
  node_id: string;
  progress: number;
  order_index: number;
}

interface Node {
  id: string;
  title: string;
}

export default function Foco() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nodes, setNodes] = useState<Record<string, Node>>({});
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    fetchTasks();
    
    const channel = supabase
      .channel('foco-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning) {
      interval = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const fetchTasks = async () => {
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('id, title, description, node_id, progress, order_index')
      .eq('status', 'andamento')
      .order('order_index');

    if (tasksData) {
      setTasks(tasksData);
      const nodeIds = [...new Set(tasksData.map(t => t.node_id))];
      if (nodeIds.length > 0) {
        const { data: nodesData } = await supabase
          .from('nodes')
          .select('id, title')
          .in('id', nodeIds);
        if (nodesData) {
          setNodes(Object.fromEntries(nodesData.map(n => [n.id, n])));
        }
      }
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartTask = (taskId: string) => {
    setActiveTaskId(taskId);
    setTimerSeconds(0);
    setTimerRunning(true);
  };

  const handleToggleTimer = () => {
    setTimerRunning(!timerRunning);
  };

  const handleResetTimer = () => {
    setTimerSeconds(0);
    setTimerRunning(false);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Foco — Em andamento</h1>
        </div>

        {/* Timer fixo */}
        <Card className="p-4 mb-6 bg-destructive/10 border-destructive/30">
          <div className="flex items-center justify-between">
            <div className="text-3xl font-mono font-bold text-destructive">
              {formatTime(timerSeconds)}
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant={timerRunning ? "destructive" : "default"}
                onClick={handleToggleTimer}
                disabled={!activeTaskId}
              >
                {timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="outline" onClick={handleResetTimer}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {activeTaskId && (
            <p className="text-sm text-muted-foreground mt-2">
              {tasks.find(t => t.id === activeTaskId)?.title}
            </p>
          )}
        </Card>

        {/* Lista de tarefas */}
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma tarefa em andamento
            </p>
          ) : (
            tasks.map(task => (
              <Card
                key={task.id}
                className={`p-4 cursor-pointer transition-all ${
                  activeTaskId === task.id 
                    ? 'border-destructive bg-destructive/5' 
                    : 'hover:border-muted-foreground/30'
                }`}
                onClick={() => handleStartTask(task.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{task.title}</h3>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {nodes[task.node_id]?.title || 'Nó desconhecido'}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {task.progress}%
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
