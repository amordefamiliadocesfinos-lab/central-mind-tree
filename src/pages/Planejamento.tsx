import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Star, Check, Save, RotateCcw, Pencil, GripVertical, ChevronUp, ChevronDown, CalendarIcon, X, LayoutGrid, Table as TableIcon } from "lucide-react";
import { SelectionSpreadsheetView } from "@/components/planejamento/SelectionSpreadsheetView";
import { SortableList, SortableHandle } from "@/components/ui/sortable-list";
import { toast } from "sonner";
import { format, subWeeks, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getWeekStartSaoPaulo, getWeekEndSaoPaulo, getWeekStartISO, formatWeekRange } from "@/lib/dateUtils";
import { FollowUpBanner } from "@/components/FollowUpBanner";
import { ReplanningBanner } from "@/components/ReplanningBanner";
import { DueDateBanner } from "@/components/DueDateBanner";
import { DueDatePill } from "@/components/DueDatePill";

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  node_id: string;
  progress: number;
  updated_at: string;
  due_date?: string | null;
  scheduled_date?: string | null;
}

interface Node {
  id: string;
  title: string;
  color: string;
}

interface AreaItem {
  name: string;
  note: string;
  status: "ok" | "pendente";
}

interface PlanTemplate {
  areas: string[];
}

interface CurrentPlan {
  weekStartISO: string;
  notesByArea: Record<string, string>;
  statusByArea: Record<string, "ok" | "pendente">;
  selectedTaskIds: string[];
  prioritizedTaskIds: string[];
}

const DEFAULT_AREAS = [
  "Produção semanal",
  "Controle de pedidos",
  "Controle de tarefas",
  "Insumos a comprar",
];

const STATUS_COLORS: Record<string, string> = {
  andamento: "bg-red-500",
  pendente: "bg-yellow-500",
};

// Use centralized date utility for consistent timezone handling

const Planejamento = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedThisWeek, setCompletedThisWeek] = useState(0);
  const [closingTaskIds, setClosingTaskIds] = useState<string[]>([]);
  const [closingAction, setClosingAction] = useState<"keep" | "pending" | null>(null);

  // Template (customizable areas)
  const [template, setTemplate] = useState<PlanTemplate>(() => {
    const saved = localStorage.getItem("pc.plan.template");
    return saved ? JSON.parse(saved) : { areas: DEFAULT_AREAS };
  });

  // Current plan state
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan>(() => {
    const saved = localStorage.getItem("pc.plan.current");
    const weekStart = getWeekStartISO();
    if (saved) {
      const parsed = JSON.parse(saved);
      // Reset if it's a new week
      if (parsed.weekStartISO !== weekStart) {
        return {
          weekStartISO: weekStart,
          notesByArea: {},
          statusByArea: {},
          selectedTaskIds: [],
          prioritizedTaskIds: [],
        };
      }
      return parsed;
    }
    return {
      weekStartISO: weekStart,
      notesByArea: {},
      statusByArea: {},
      selectedTaskIds: [],
      prioritizedTaskIds: [],
    };
  });

  const [newAreaName, setNewAreaName] = useState("");
  const [selectionView, setSelectionView] = useState<"cards" | "spreadsheet">(() => {
    return (localStorage.getItem("planejamento:selectionView") as any) || "cards";
  });
  useEffect(() => {
    localStorage.setItem("planejamento:selectionView", selectionView);
  }, [selectionView]);

  // Drag & drop state for priority reordering
  const [draggedPriorityIndex, setDraggedPriorityIndex] = useState<number | null>(null);

  // Task form state
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "pendente",
    node_id: "",
    progress: 0,
    due_date: null as Date | null,
    scheduled_date: null as Date | null,
  });

  // Persist template
  useEffect(() => {
    localStorage.setItem("pc.plan.template", JSON.stringify(template));
  }, [template]);

  // Persist current plan
  useEffect(() => {
    localStorage.setItem("pc.plan.current", JSON.stringify(currentPlan));
  }, [currentPlan]);

  // Load tasks and nodes
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [tasksRes, completedRes, nodesRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, description, status, node_id, progress, updated_at")
        .in("status", ["andamento", "pendente"]),
      supabase
        .from("tasks")
        .select("id, title, status, updated_at")
        .eq("status", "concluído")
        .gte("updated_at", weekStart.toISOString()),
      supabase.from("nodes").select("id, title, color"),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data);
    if (completedRes.data) setCompletedThisWeek(completedRes.data.length);
    if (nodesRes.data) setNodes(nodesRes.data);
    setLoading(false);
  };

  // Group tasks by node
  const tasksByNode = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      if (!grouped[task.node_id]) grouped[task.node_id] = [];
      grouped[task.node_id].push(task);
    });
    return grouped;
  }, [tasks]);

  const nodesMap = useMemo(() => {
    const map: Record<string, Node> = {};
    nodes.forEach((n) => (map[n.id] = n));
    return map;
  }, [nodes]);

  // Week period display - using Sao Paulo timezone
  const weekStart = getWeekStartSaoPaulo();
  const weekEnd = getWeekEndSaoPaulo();
  const prevWeekStart = subWeeks(weekStart, 1);
  const weekPeriod = formatWeekRange();

  // Tasks from previous week still in "andamento"
  const previousWeekAndamentoTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.status === "andamento" &&
        new Date(t.updated_at) < weekStart
    );
  }, [tasks, weekStart]);

  // Area handlers
  const addArea = () => {
    if (!newAreaName.trim()) return;
    setTemplate((prev) => ({ areas: [...prev.areas, newAreaName.trim()] }));
    setNewAreaName("");
  };

  const removeArea = (index: number) => {
    setTemplate((prev) => ({
      areas: prev.areas.filter((_, i) => i !== index),
    }));
  };

  const updateAreaNote = (area: string, note: string) => {
    setCurrentPlan((prev) => ({
      ...prev,
      notesByArea: { ...prev.notesByArea, [area]: note },
    }));
  };

  const toggleAreaStatus = (area: string) => {
    setCurrentPlan((prev) => ({
      ...prev,
      statusByArea: {
        ...prev.statusByArea,
        [area]: prev.statusByArea[area] === "ok" ? "pendente" : "ok",
      },
    }));
  };

  // Task selection handlers
  const toggleTaskSelected = (taskId: string) => {
    setCurrentPlan((prev) => {
      const isSelected = prev.selectedTaskIds.includes(taskId);
      return {
        ...prev,
        selectedTaskIds: isSelected
          ? prev.selectedTaskIds.filter((id) => id !== taskId)
          : [...prev.selectedTaskIds, taskId],
      };
    });
  };

  const toggleTaskPrioritized = (taskId: string) => {
    setCurrentPlan((prev) => {
      const isPrioritized = prev.prioritizedTaskIds.includes(taskId);
      let newPrioritized = isPrioritized
        ? prev.prioritizedTaskIds.filter((id) => id !== taskId)
        : [...prev.prioritizedTaskIds, taskId];
      
      // Also add to selected if prioritizing
      let newSelected = prev.selectedTaskIds;
      if (!isPrioritized && !prev.selectedTaskIds.includes(taskId)) {
        newSelected = [...prev.selectedTaskIds, taskId];
      }
      
      return {
        ...prev,
        selectedTaskIds: newSelected,
        prioritizedTaskIds: newPrioritized,
      };
    });
  };

  // Drag & drop handlers for priority reordering
  const handlePriorityDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedPriorityIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    // Make the dragged element semi-transparent
    if (e.currentTarget) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handlePriorityDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handlePriorityDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const dragIndex = draggedPriorityIndex ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
    
    if (isNaN(dragIndex) || dragIndex === dropIndex) {
      setDraggedPriorityIndex(null);
      return;
    }

    setCurrentPlan((prev) => {
      const newOrder = [...prev.prioritizedTaskIds];
      const [removed] = newOrder.splice(dragIndex, 1);
      newOrder.splice(dropIndex, 0, removed);
      return { ...prev, prioritizedTaskIds: newOrder };
    });
    setDraggedPriorityIndex(null);
  };

  const handlePriorityDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedPriorityIndex(null);
    // Reset opacity
    if (e.currentTarget) {
      e.currentTarget.style.opacity = "1";
    }
  };

  // Action handlers
  const handleSendToFocus = () => {
    localStorage.setItem(
      "pc.focus.queue",
      JSON.stringify(currentPlan.prioritizedTaskIds)
    );
    if (currentPlan.prioritizedTaskIds.length > 0) {
      localStorage.setItem(
        "pc.focus.currentTaskId",
        currentPlan.prioritizedTaskIds[0]
      );
    }
    toast.success("Fila do Foco atualizada!");
  };

  const handleSavePlan = () => {
    localStorage.setItem("pc.plan.current", JSON.stringify(currentPlan));
    toast.success("Plano salvo!");
  };

  const handleCompletePlanning = () => {
    localStorage.setItem("pc.plan.lastCompletedAt", Date.now().toString());
    toast.success("Planejamento concluído!", {
      action: {
        label: "Ir para Foco",
        onClick: () => window.location.href = "/foco",
      },
    });
  };

  // Quick closing handler
  const handleQuickClose = async (action: "keep" | "pending") => {
    if (previousWeekAndamentoTasks.length === 0) return;
    
    const taskIds = previousWeekAndamentoTasks.map((t) => t.id);
    
    if (action === "pending") {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "pendente" })
        .in("id", taskIds);
      
      if (error) {
        toast.error("Erro ao atualizar tarefas");
        return;
      }
      
      // Update local state
      setTasks((prev) =>
        prev.map((t) =>
          taskIds.includes(t.id) ? { ...t, status: "pendente" } : t
        )
      );
    }
    
    localStorage.setItem("pc.plan.lastCompletedAt", Date.now().toString());
    setClosingAction(null);
    toast.success(
      action === "keep"
        ? "Tarefas mantidas em andamento. Semana fechada!"
        : "Tarefas movidas para pendente. Semana fechada!"
    );
  };

  // Task form handlers
  const openNewTaskForm = (preselectedNodeId?: string) => {
    setEditingTask(null);
    setTaskForm({
      title: "",
      description: "",
      status: "pendente",
      node_id: preselectedNodeId || "",
      progress: 0,
      due_date: null,
      scheduled_date: null,
    });
    setIsTaskFormOpen(true);
  };

  const openEditTaskForm = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      node_id: task.node_id,
      progress: task.progress,
      due_date: task.due_date ? parseISO(task.due_date) : null,
      scheduled_date: task.scheduled_date ? parseISO(task.scheduled_date) : null,
    });
    setIsTaskFormOpen(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    if (!taskForm.node_id) {
      toast.error("Nó-pai é obrigatório");
      return;
    }

    if (editingTask) {
      // Update existing task
      const { error } = await supabase
        .from("tasks")
        .update({
          title: taskForm.title,
          description: taskForm.description || null,
          status: taskForm.status,
          node_id: taskForm.node_id,
          progress: taskForm.progress,
          due_date: taskForm.due_date ? format(taskForm.due_date, "yyyy-MM-dd") : null,
          scheduled_date: taskForm.scheduled_date ? format(taskForm.scheduled_date, "yyyy-MM-dd") : null,
        })
        .eq("id", editingTask.id);

      if (error) {
        toast.error("Erro ao atualizar tarefa");
        return;
      }
      toast.success("Tarefa atualizada!");
    } else {
      // Create new task
      const { error } = await supabase.from("tasks").insert({
        title: taskForm.title,
        description: taskForm.description || null,
        status: taskForm.status,
        node_id: taskForm.node_id,
        progress: taskForm.progress,
        due_date: taskForm.due_date ? format(taskForm.due_date, "yyyy-MM-dd") : null,
        scheduled_date: taskForm.scheduled_date ? format(taskForm.scheduled_date, "yyyy-MM-dd") : null,
      });

      if (error) {
        toast.error("Erro ao criar tarefa");
        return;
      }
      toast.success("Tarefa criada!");
    }

    setIsTaskFormOpen(false);
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b safe-area-pt">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">Planejamento</h1>
              <Badge variant="outline" className="text-xs">{weekPeriod}</Badge>
            </div>
          </div>
          <Link to="/foco">
            <Button variant="outline" size="sm" className="h-10 px-3">
              <span className="hidden sm:inline">Ir para </span>Foco
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Checklist de Áreas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {template.areas.map((area, index) => (
              <div
                key={area}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <Checkbox
                  checked={currentPlan.statusByArea[area] === "ok"}
                  onCheckedChange={() => toggleAreaStatus(area)}
                />
                <span className="font-medium flex-shrink-0 w-40">{area}</span>
                <Input
                  placeholder="Observações..."
                  value={currentPlan.notesByArea[area] || ""}
                  onChange={(e) => updateAreaNote(area, e.target.value)}
                  className="flex-1"
                />
                <Badge
                  variant={
                    currentPlan.statusByArea[area] === "ok"
                      ? "default"
                      : "secondary"
                  }
                >
                  {currentPlan.statusByArea[area] === "ok" ? "OK" : "Pendente"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeArea(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Nova área..."
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addArea()}
              />
              <Button onClick={addArea} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Block 2: Seleção de Tarefas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base sm:text-lg">Seleção de Tarefas</CardTitle>
            <Button size="sm" onClick={() => openNewTaskForm()} className="h-9">
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Nova tarefa</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(tasksByNode).map(([nodeId, nodeTasks]) => {
              const node = nodesMap[nodeId];
              if (!node) return null;
              return (
                <div key={nodeId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3
                      className="font-semibold px-2 py-1 rounded text-sm"
                      style={{ backgroundColor: node.color + "33" }}
                    >
                      {node.title}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openNewTaskForm(nodeId)}
                      className="h-8 w-8 p-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-2 pl-2">
                    {nodeTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded border bg-card active:scale-[0.99] transition-transform"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[task.status]}`}
                          />
                          <span className="text-sm truncate flex-1">{task.title}</span>
                          <DueDatePill dueDate={task.due_date || null} />
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditTaskForm(task)}
                            className="h-9 w-9 p-0"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant={currentPlan.selectedTaskIds.includes(task.id) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleTaskSelected(task.id)}
                            className="h-9 px-2"
                          >
                            <Check className="h-3 w-3" />
                            <span className="hidden sm:inline ml-1">Plano</span>
                          </Button>
                          <Button
                            variant={currentPlan.prioritizedTaskIds.includes(task.id) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleTaskPrioritized(task.id)}
                            className={cn(
                              "h-9 px-2",
                              currentPlan.prioritizedTaskIds.includes(task.id) && "bg-amber-500 hover:bg-amber-600"
                            )}
                          >
                            <Star className="h-3 w-3" />
                            <span className="hidden sm:inline ml-1">Prio</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {Object.keys(tasksByNode).length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma tarefa em andamento ou pendente.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Block 3: Plano da Semana */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Plano da Semana</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg border">
                <p className="text-muted-foreground mb-1 text-xs sm:text-sm">Tarefas no Plano</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {currentPlan.selectedTaskIds.length}
                </p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-muted-foreground mb-1 text-xs sm:text-sm">Priorizadas</p>
                <p className="text-xl sm:text-2xl font-bold text-amber-500">
                  {currentPlan.prioritizedTaskIds.length}
                </p>
              </div>
            </div>

            {currentPlan.prioritizedTaskIds.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Fila de prioridades (arraste para reordenar):
                </p>
                <SortableList
                  items={currentPlan.prioritizedTaskIds}
                  keyExtractor={(id) => id}
                  onReorder={(newOrder) => {
                    setCurrentPlan((prev) => ({
                      ...prev,
                      prioritizedTaskIds: newOrder,
                    }));
                  }}
                  renderItem={(id, index, isDragging) => {
                    const task = tasks.find((t) => t.id === id);
                    return task ? (
                      <div
                        className={cn(
                          "flex items-center gap-2 text-sm p-2 rounded bg-amber-500/10 border border-transparent",
                          isDragging && "border-amber-500 shadow-lg"
                        )}
                      >
                        <SortableHandle />
                        <span className="text-muted-foreground font-medium w-5">{index + 1}.</span>
                        <span className="flex-1 truncate">{task.title}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-60 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskPrioritized(task.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : null;
                  }}
                  className="max-h-48 overflow-y-auto"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button onClick={handleSendToFocus} className="flex-1 h-11">
                <Star className="h-4 w-4 mr-2" />
                Enviar ao Foco
              </Button>
              <Button onClick={handleSavePlan} variant="outline" className="flex-1 h-11">
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
              <Button onClick={handleCompletePlanning} variant="secondary" className="flex-1 h-11">
                <Check className="h-4 w-4 mr-2" />
                Concluir
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Block 4: Fechamento Rápido */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Fechamento Rápido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg border">
                <p className="text-muted-foreground mb-1 text-xs sm:text-sm">Concluídas esta semana</p>
                <p className="text-xl sm:text-2xl font-bold text-green-500">
                  {completedThisWeek}
                </p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-muted-foreground mb-1 text-xs sm:text-sm">Em andamento (anterior)</p>
                <p className="text-xl sm:text-2xl font-bold text-red-500">
                  {previousWeekAndamentoTasks.length}
                </p>
              </div>
            </div>

            {previousWeekAndamentoTasks.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Tarefas em andamento da semana passada:
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {previousWeekAndamentoTasks.map((task) => {
                    const node = nodesMap[task.node_id];
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 text-sm p-2 rounded bg-red-500/10"
                      >
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="flex-1 truncate">{task.title}</span>
                        {node && (
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {node.title}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    onClick={() => handleQuickClose("keep")}
                    variant="outline"
                    className="flex-1 h-11"
                  >
                    Manter em Andamento
                  </Button>
                  <Button
                    onClick={() => handleQuickClose("pending")}
                    variant="secondary"
                    className="flex-1 h-11"
                  >
                    Mover para Pendente
                  </Button>
                </div>
              </div>
            )}

            {previousWeekAndamentoTasks.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma tarefa pendente de fechamento.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <ReplanningBanner />

      {/* Task Form Dialog - Responsive */}
      <ResponsiveDialog 
        open={isTaskFormOpen} 
        onOpenChange={setIsTaskFormOpen}
        title={editingTask ? "Editar Tarefa" : "Nova Tarefa"}
      >
        <div className="space-y-4 p-4 sm:p-0">
          <div className="space-y-2">
            <label className="text-sm font-medium">Título *</label>
            <Input
              placeholder="Título da tarefa"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="h-11"
            />
          </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                placeholder="Descrição (opcional)"
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, description: e.target.value })
                }
                rows={6}
                className="min-h-[120px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nó-pai *</label>
              <Select
                value={taskForm.node_id}
                onValueChange={(value) =>
                  setTaskForm({ ...taskForm, node_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o nó" />
                </SelectTrigger>
                <SelectContent className="bg-background border">
                  {nodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={taskForm.status}
                onValueChange={(value) =>
                  setTaskForm({ ...taskForm, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border">
                  <SelectItem value="estrutural">Estrutural</SelectItem>
                  <SelectItem value="andamento">Em Andamento</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="concluído">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Limite</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !taskForm.due_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {taskForm.due_date ? format(taskForm.due_date, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={taskForm.due_date || undefined}
                      onSelect={(date) => setTaskForm({ ...taskForm, due_date: date || null })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {taskForm.due_date && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTaskForm({ ...taskForm, due_date: null })}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data de Agendamento</label>
              <p className="text-xs text-muted-foreground">
                Tarefa será promovida para "Em Andamento" nesta data
              </p>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !taskForm.scheduled_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {taskForm.scheduled_date ? format(taskForm.scheduled_date, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={taskForm.scheduled_date || undefined}
                      onSelect={(date) => setTaskForm({ ...taskForm, scheduled_date: date || null })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {taskForm.scheduled_date && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTaskForm({ ...taskForm, scheduled_date: null })}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Progresso</label>
                <span className="text-sm text-muted-foreground">
                  {taskForm.progress}%
                </span>
              </div>
              <Input
                type="number"
                min="0"
                max="100"
                value={taskForm.progress}
                onChange={(e) =>
                  setTaskForm({
                    ...taskForm,
                    progress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                  })
                }
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsTaskFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSaveTask}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </div>
          </div>
      </ResponsiveDialog>
      <DueDateBanner />
    </div>
  );
};

export default Planejamento;
