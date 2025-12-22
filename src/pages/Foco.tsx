import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, ArrowLeft, CalendarCheck, Plus, X, Check, Clock, ExternalLink, AlertTriangle, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ReplanningBanner } from "@/components/ReplanningBanner";
import { DueDateBanner } from "@/components/DueDateBanner";
import { FollowUpBanner } from "@/components/FollowUpBanner";
import { useTimeTracking } from "@/hooks/useTimeTracking";

interface Task {
  id: string;
  title: string;
  description: string | null;
  node_id: string;
  progress: number;
  order_index: number;
  dependency_id: string | null;
  status: string;
}

interface Node {
  id: string;
  title: string;
}

const STORAGE_KEYS = {
  queue: 'pc.focus.queue',
  currentTaskId: 'pc.focus.currentTaskId',
  session: 'pc.focus.session',
};

interface SessionState {
  startedAt: number | null;
  pausedAt: number | null;
  elapsedMs: number;
}

const SESSION_DURATION_MS = 25 * 60 * 1000; // 25 minutes

const loadSession = (): SessionState => {
  const stored = localStorage.getItem(STORAGE_KEYS.session);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { startedAt: null, pausedAt: null, elapsedMs: 0 };
    }
  }
  return { startedAt: null, pausedAt: null, elapsedMs: 0 };
};

export default function Foco() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nodes, setNodes] = useState<Record<string, Node>>({});
  const [dependencyTasks, setDependencyTasks] = useState<Record<string, { id: string; title: string; status: string }>>({});
  const [activeTaskId, setActiveTaskId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.currentTaskId) || null;
  });
  const [queue, setQueue] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.queue);
    const parsed = stored ? JSON.parse(stored) : [];
    
    // Auto-load from plan if queue is empty
    if (parsed.length === 0) {
      const planStored = localStorage.getItem('pc.plan.current');
      if (planStored) {
        try {
          const plan = JSON.parse(planStored);
          if (plan.prioritizedTaskIds && plan.prioritizedTaskIds.length > 0) {
            localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(plan.prioritizedTaskIds));
            if (plan.prioritizedTaskIds[0]) {
              localStorage.setItem(STORAGE_KEYS.currentTaskId, plan.prioritizedTaskIds[0]);
            }
            return plan.prioritizedTaskIds;
          }
        } catch {}
      }
    }
    return parsed;
  });
  const [session, setSession] = useState<SessionState>(loadSession);
  const [displayMs, setDisplayMs] = useState(0);
  const [taskTotalTime, setTaskTotalTime] = useState<number>(0);
  
  // Time tracking hook
  const { startTracking, stopTracking, getTaskTotalTime, formatDuration } = useTimeTracking();

  const isRunning = session.startedAt !== null && session.pausedAt === null;
  const isPaused = session.startedAt !== null && session.pausedAt !== null;

  // Verifica se é sexta ou segunda para mostrar lembrete
  const isReplanningDay = () => {
    const day = new Date().getDay();
    return day === 1 || day === 5; // 1 = Segunda, 5 = Sexta
  };

  useEffect(() => {
    fetchTasks();
    
    const channel = supabase
      .channel('foco-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (!activeTaskId) return;
          if (isRunning) {
            handlePause();
          } else if (isPaused) {
            handleResume();
          } else {
            handleStart();
          }
          break;
        case 'Enter':
          e.preventDefault();
          // Select next task in queue
          if (queue.length > 0 && activeTaskId) {
            const currentIndex = queue.indexOf(activeTaskId);
            const nextIndex = (currentIndex + 1) % queue.length;
            setActiveTaskId(queue[nextIndex]);
          }
          break;
        case 'KeyC':
          e.preventDefault();
          if (activeTaskId) {
            handleCompleteTask();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTaskId, isRunning, isPaused, queue]);

  // Calculate display time based on session state
  useEffect(() => {
    const calculateElapsed = () => {
      if (!session.startedAt) return 0;
      if (session.pausedAt) {
        return session.elapsedMs;
      }
      return session.elapsedMs + (Date.now() - session.startedAt);
    };

    const updateDisplay = () => {
      const elapsed = calculateElapsed();
      setDisplayMs(Math.min(elapsed, SESSION_DURATION_MS));
    };

    updateDisplay();

    let interval: NodeJS.Timeout | undefined;
    if (isRunning) {
      interval = setInterval(updateDisplay, 100);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [session, isRunning]);

  // Persist session
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  }, [session]);

  // Persist activeTaskId
  useEffect(() => {
    if (activeTaskId) {
      localStorage.setItem(STORAGE_KEYS.currentTaskId, activeTaskId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.currentTaskId);
    }
  }, [activeTaskId]);

  // Persist queue
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(queue));
  }, [queue]);

  const fetchTasks = async () => {
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('id, title, description, node_id, progress, order_index, dependency_id, status')
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
      
      // Fetch dependency tasks info
      const depIds = tasksData.filter(t => t.dependency_id).map(t => t.dependency_id!);
      if (depIds.length > 0) {
        const { data: depTasks } = await supabase
          .from('tasks')
          .select('id, title, status')
          .in('id', depIds);
        if (depTasks) {
          setDependencyTasks(Object.fromEntries(depTasks.map(t => [t.id, t])));
        }
      }
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Load total time for active task
  useEffect(() => {
    if (activeTaskId) {
      getTaskTotalTime(activeTaskId).then(setTaskTotalTime);
    } else {
      setTaskTotalTime(0);
    }
  }, [activeTaskId, getTaskTotalTime]);

  const handleSelectTask = (taskId: string) => {
    setActiveTaskId(taskId);
  };

  const handleStart = async () => {
    if (activeTaskId) {
      const activeTask = tasks.find(t => t.id === activeTaskId);
      await startTracking(activeTaskId, activeTask?.node_id, 'focus');
    }
    setSession({
      startedAt: Date.now(),
      pausedAt: null,
      elapsedMs: 0,
    });
  };

  const handlePause = async () => {
    if (!session.startedAt) return;
    if (activeTaskId) {
      await stopTracking(activeTaskId);
    }
    const elapsed = session.elapsedMs + (Date.now() - session.startedAt);
    setSession({
      startedAt: session.startedAt,
      pausedAt: Date.now(),
      elapsedMs: elapsed,
    });
  };

  const handleResume = async () => {
    if (activeTaskId) {
      const activeTask = tasks.find(t => t.id === activeTaskId);
      await startTracking(activeTaskId, activeTask?.node_id, 'focus');
    }
    setSession({
      startedAt: Date.now(),
      pausedAt: null,
      elapsedMs: session.elapsedMs,
    });
  };

  const handleReset = async () => {
    if (activeTaskId) {
      await stopTracking(activeTaskId);
      // Refresh total time
      const total = await getTaskTotalTime(activeTaskId);
      setTaskTotalTime(total);
    }
    setSession({
      startedAt: null,
      pausedAt: null,
      elapsedMs: 0,
    });
  };

  const handleCompleteTask = async () => {
    if (!activeTaskId) return;
    
    // Stop time tracking first
    await stopTracking(activeTaskId);
    
    await supabase
      .from('tasks')
      .update({ status: 'concluído', progress: 100 })
      .eq('id', activeTaskId);
    
    // Remove from queue and select next
    const currentIndex = queue.indexOf(activeTaskId);
    const newQueue = queue.filter(id => id !== activeTaskId);
    setQueue(newQueue);
    
    // Select next task from queue
    if (newQueue.length > 0) {
      const nextIndex = Math.min(currentIndex, newQueue.length - 1);
      setActiveTaskId(newQueue[nextIndex]);
    } else {
      setActiveTaskId(null);
    }
    
    setSession({
      startedAt: null,
      pausedAt: null,
      elapsedMs: 0,
    });
    toast.success("Tarefa concluída!");
  };

  const handleMoveToPending = async () => {
    if (!activeTaskId) return;
    
    // Stop time tracking
    await stopTracking(activeTaskId);
    
    await supabase
      .from('tasks')
      .update({ status: 'pendente' })
      .eq('id', activeTaskId);
    
    // Remove from queue and select next
    const currentIndex = queue.indexOf(activeTaskId);
    const newQueue = queue.filter(id => id !== activeTaskId);
    setQueue(newQueue);
    
    if (newQueue.length > 0) {
      const nextIndex = Math.min(currentIndex, newQueue.length - 1);
      setActiveTaskId(newQueue[nextIndex]);
    } else {
      setActiveTaskId(null);
    }
    
    setSession({
      startedAt: null,
      pausedAt: null,
      elapsedMs: 0,
    });
    toast.info("Tarefa movida para pendente");
  };

  const handleOpenEdit = () => {
    if (!activeTaskId) return;
    window.open(`/task/${activeTaskId}`, '_blank');
  };

  const handleAddToQueue = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!queue.includes(taskId)) {
      setQueue([...queue, taskId]);
    }
  };

  const handleRemoveFromQueue = (taskId: string) => {
    setQueue(queue.filter(id => id !== taskId));
  };

  const queuedTasks = queue
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Foco — Em andamento</h1>
          </div>
          <Button 
            variant={isReplanningDay() ? "default" : "outline"} 
            size="sm"
            onClick={() => navigate('/planejamento')}
          >
            <CalendarCheck className="h-4 w-4 mr-2" />
            Replanejar
          </Button>
        </div>

        {/* Timer fixo */}
        <Card className="p-4 mb-6 bg-destructive/10 border-destructive/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-mono font-bold text-destructive">
                {formatTime(displayMs)}
              </div>
              {taskTotalTime > 0 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  <span>Total: {formatDuration(taskTotalTime)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {!isRunning && !isPaused && (
                <Button
                  size="icon"
                  variant="default"
                  onClick={handleStart}
                  disabled={!activeTaskId}
                  title="Iniciar"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              {isRunning && (
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={handlePause}
                  title="Pausar"
                >
                  <Pause className="h-4 w-4" />
                </Button>
              )}
              {isPaused && (
                <Button
                  size="icon"
                  variant="default"
                  onClick={handleResume}
                  title="Retomar"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              <Button size="icon" variant="outline" onClick={handleReset} title="Zerar">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {activeTaskId && (() => {
            const activeTask = tasks.find(t => t.id === activeTaskId);
            const dep = activeTask?.dependency_id ? dependencyTasks[activeTask.dependency_id] : null;
            return (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">
                  {activeTask?.title}
                </p>
                {dep && (
                  <Badge
                    variant="outline"
                    className={`mt-1 cursor-pointer text-xs ${
                      dep.status !== 'concluído' 
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 hover:bg-amber-500/30' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/task/${dep.id}`, '_blank');
                    }}
                  >
                    {dep.status !== 'concluído' && <AlertTriangle className="h-3 w-3 mr-1" />}
                    Depende de: {dep.title}
                  </Badge>
                )}
              </div>
            );
          })()}
          {activeTaskId && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-destructive/20">
              <Button
                size="sm"
                variant="default"
                onClick={handleCompleteTask}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-1" />
                Concluir
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleMoveToPending}
                className="flex-1"
              >
                <Clock className="h-4 w-4 mr-1" />
                Pendente
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleOpenEdit}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>

        {/* Fila ativa */}
        {queuedTasks.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Fila ativa</h2>
            <div className="flex flex-wrap gap-2">
              {queuedTasks.map((task, index) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${
                    activeTaskId === task.id 
                      ? 'bg-destructive/20 text-destructive border border-destructive/30' 
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <span className="text-xs opacity-60">{index + 1}.</span>
                  <span 
                    className="cursor-pointer hover:underline"
                    onClick={() => handleSelectTask(task.id)}
                  >
                    {task.title}
                  </span>
                  <button
                    onClick={() => handleRemoveFromQueue(task.id)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                onClick={() => handleSelectTask(task.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{task.title}</h3>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    {task.dependency_id && dependencyTasks[task.dependency_id] && (() => {
                      const dep = dependencyTasks[task.dependency_id];
                      return (
                        <Badge
                          variant="outline"
                          className={`mt-2 cursor-pointer text-xs ${
                            dep.status !== 'concluído' 
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 hover:bg-amber-500/30' 
                              : 'hover:bg-muted'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/task/${dep.id}`, '_blank');
                          }}
                        >
                          {dep.status !== 'concluído' && <AlertTriangle className="h-3 w-3 mr-1" />}
                          Depende de: {dep.title}
                        </Badge>
                      );
                    })()}
                    <p className="text-xs text-muted-foreground mt-2">
                      {nodes[task.node_id]?.title || 'Nó desconhecido'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {task.progress}%
                    </span>
                    {!queue.includes(task.id) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={(e) => handleAddToQueue(task.id, e)}
                        title="Adicionar à fila"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <ReplanningBanner />
        <DueDateBanner />
        <FollowUpBanner />
      </div>
    </div>
  );
}
