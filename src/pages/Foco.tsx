import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, ArrowLeft, CalendarCheck, Plus, X, Check, Clock, ExternalLink, AlertTriangle, Timer, GripVertical, LayoutGrid, Table as TableIcon } from "lucide-react";
import { TasksSpreadsheetView } from "@/components/foco/TasksSpreadsheetView";
import { 
  DndContext, 
  closestCenter, 
  PointerSensor, 
  TouchSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ReplanningBanner } from "@/components/ReplanningBanner";
import { DueDateBanner } from "@/components/DueDateBanner";
import { FollowUpBanner } from "@/components/FollowUpBanner";
import { useTimeTracking } from "@/hooks/useTimeTracking";
import { cn } from "@/lib/utils";

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

// Sortable Queue Item component
interface SortableQueueItemProps {
  task: Task;
  index: number;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

function SortableQueueItem({ task, index, isActive, onSelect, onRemove }: SortableQueueItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap flex-shrink-0",
        isActive 
          ? 'bg-destructive/20 text-destructive border border-destructive/30' 
          : 'bg-muted text-muted-foreground',
        isDragging && 'shadow-lg'
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="h-3 w-3 opacity-50" />
      </div>
      <span className="text-xs opacity-60">{index + 1}.</span>
      <span 
        className="cursor-pointer hover:underline"
        onClick={() => onSelect(task.id)}
      >
        {task.title}
      </span>
      <button
        onClick={() => onRemove(task.id)}
        className="ml-1 hover:text-destructive p-1"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// Queue List with drag & drop
interface QueueListProps {
  tasks: Task[];
  activeTaskId: string | null;
  queue: string[];
  setQueue: React.Dispatch<React.SetStateAction<string[]>>;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

function QueueList({ tasks, activeTaskId, queue, setQueue, onSelect, onRemove }: QueueListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = queue.indexOf(active.id as string);
      const newIndex = queue.indexOf(over.id as string);
      const newQueue = arrayMove(queue, oldIndex, newIndex);
      setQueue(newQueue);
    }
  };

  return (
    <div>
      <h2 className="text-sm font-medium text-muted-foreground mb-2">Fila ativa (arraste para reordenar)</h2>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={queue} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
            {tasks.map((task, index) => (
              <SortableQueueItem
                key={task.id}
                task={task}
                index={index}
                isActive={activeTaskId === task.id}
                onSelect={onSelect}
                onRemove={onRemove}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default function Foco() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'cards' | 'spreadsheet'>(() => {
    return (localStorage.getItem('pc.focus.viewMode') as 'cards' | 'spreadsheet') || 'cards';
  });
  useEffect(() => { localStorage.setItem('pc.focus.viewMode', viewMode); }, [viewMode]);
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
  const { startTracking, stopTracking, getTaskTotalTime, formatDuration, refreshActiveTimer, activeEntry } = useTimeTracking();

  const isRunning = session.startedAt !== null && session.pausedAt === null;
  const isPaused = session.startedAt !== null && session.pausedAt !== null;

  // Verifica se é sexta ou segunda para mostrar lembrete
  const isReplanningDay = () => {
    const day = new Date().getDay();
    return day === 1 || day === 5; // 1 = Segunda, 5 = Sexta
  };

  // On mount: check for active time_entry and restore session from it
  useEffect(() => {
    fetchTasks();
    
    // Restore timer from active time_entry (survives tab close)
    refreshActiveTimer().then((entry) => {
      if (entry && entry.started_at) {
        const startedAtMs = new Date(entry.started_at).getTime();
        const elapsedMs = Date.now() - startedAtMs;
        
        // Restore active task
        if (entry.task_id) {
          setActiveTaskId(entry.task_id);
          // Add to queue if not already there
          setQueue(prev => {
            if (!prev.includes(entry.task_id)) {
              return [entry.task_id, ...prev];
            }
            return prev;
          });
        }
        
        // Restore session as running
        setSession({
          startedAt: Date.now(),
          pausedAt: null,
          elapsedMs: Math.max(0, elapsedMs),
        });
      }
    });
    
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

    let interval: ReturnType<typeof setInterval> | undefined;
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

  const fetchTasks = useCallback(async () => {
    // Fetch tasks that are either in the queue OR have status 'andamento'
    const currentQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.queue) || '[]');
    
    let tasksData: Task[] = [];
    
    // First, get all tasks in the queue (regardless of status)
    if (currentQueue.length > 0) {
      const { data: queueTasks } = await supabase
        .from('tasks')
        .select('id, title, description, node_id, progress, order_index, dependency_id, status')
        .in('id', currentQueue)
        .in('status', ['andamento', 'pendente']);
      
      if (queueTasks) {
        tasksData = queueTasks;
      }
    }
    
    // Also fetch any 'andamento' tasks not in queue for potential addition
    const { data: andamentoTasks } = await supabase
      .from('tasks')
      .select('id, title, description, node_id, progress, order_index, dependency_id, status')
      .eq('status', 'andamento')
      .order('order_index');
    
    if (andamentoTasks) {
      // Merge, avoiding duplicates
      const existingIds = new Set(tasksData.map(t => t.id));
      andamentoTasks.forEach(t => {
        if (!existingIds.has(t.id)) {
          tasksData.push(t);
        }
      });
    }

    if (tasksData.length > 0) {
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
    } else {
      setTasks([]);
    }
  }, []);

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
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b safe-area-pt">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">Foco</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
                className="h-8 px-2"
                title="Visualização em cards"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'spreadsheet' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('spreadsheet')}
                className="h-8 px-2"
                title="Visualização em planilha"
              >
                <TableIcon className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              variant={isReplanningDay() ? "default" : "outline"} 
              size="sm"
              onClick={() => navigate('/planejamento')}
              className="h-10 px-3"
            >
              <CalendarCheck className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Replanejar</span>
            </Button>
          </div>
        </div>
      </div>

      <div className={cn("p-4 space-y-4", viewMode === 'spreadsheet' ? "max-w-[1600px] mx-auto" : "max-w-2xl mx-auto")}>
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
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-destructive/20">
              <Button
                size="sm"
                variant="default"
                onClick={handleCompleteTask}
                className="flex-1 h-11"
              >
                <Check className="h-4 w-4 mr-1" />
                Concluir
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleMoveToPending}
                className="flex-1 h-11"
              >
                <Clock className="h-4 w-4 mr-1" />
                Pendente
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleOpenEdit}
                className="h-11 w-11 p-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>

        {/* Fila ativa - horizontal drag & drop */}
        {queuedTasks.length > 0 && (
          <QueueList
            tasks={queuedTasks}
            activeTaskId={activeTaskId}
            queue={queue}
            setQueue={setQueue}
            onSelect={handleSelectTask}
            onRemove={handleRemoveFromQueue}
          />
        )}

        {/* Lista de tarefas - touch-friendly cards */}
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma tarefa em andamento
            </p>
          ) : (
            tasks.map(task => (
              <Card
                key={task.id}
                className={cn(
                  "p-4 cursor-pointer transition-all active:scale-[0.98]",
                  activeTaskId === task.id 
                    ? 'border-destructive bg-destructive/5' 
                    : 'hover:border-muted-foreground/30'
                )}
                onClick={() => handleSelectTask(task.id)}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
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
                          className={cn(
                            "mt-2 cursor-pointer text-xs",
                            dep.status !== 'concluído' 
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 hover:bg-amber-500/30' 
                              : 'hover:bg-muted'
                          )}
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm text-muted-foreground">
                      {task.progress}%
                    </span>
                    {!queue.includes(task.id) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 w-10 p-0"
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
