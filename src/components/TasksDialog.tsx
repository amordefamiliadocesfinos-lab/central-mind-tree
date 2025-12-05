import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, X, Check, MoveHorizontal } from "lucide-react";
import { DueDatePill } from "@/components/DueDatePill";

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
  due_date: string | null;
}

interface TasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  nodeTitle: string;
  onTasksChange: () => void;
  filterStatus?: string | null;
}

export function TasksDialog({
  open,
  onOpenChange,
  nodeId,
  nodeTitle,
  onTasksChange,
  filterStatus,
}: TasksDialogProps) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [nodes, setNodes] = useState<{ id: string; title: string }[]>([]);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "pendente" as Task["status"],
    dependency_id: null as string | null,
    progress: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTasks();
      fetchNodes();
    }
  }, [open, nodeId]);

  const fetchNodes = async () => {
    const { data, error } = await supabase
      .from("nodes")
      .select("id, title")
      .eq("is_visible", true)
      .order("title", { ascending: true });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar nós",
        description: error.message,
      });
    } else {
      setNodes(data || []);
    }
  };

  // Status hierarchy order: estrutural (0), andamento (1), pendente (2), concluído (3)
  const STATUS_ORDER: Record<string, number> = {
    estrutural: 0,
    andamento: 1,
    pendente: 2,
    "concluído": 3,
  };

  const STATUS_LABELS: Record<string, string> = {
    estrutural: "Estrutural",
    andamento: "Em Andamento",
    pendente: "Pendente",
    "concluído": "Concluído",
  };

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("node_id", nodeId)
      .order("updated_at", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar tarefas",
        description: error.message,
      });
    } else {
      let filteredTasks = data || [];
      
      // Apply filter if filterStatus is set
      if (filterStatus) {
        filteredTasks = filteredTasks.filter((task) => task.status === filterStatus);
      }
      
      // Sort by status hierarchy, then by updated_at desc (already sorted from DB)
      filteredTasks.sort((a, b) => {
        const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
        if (statusDiff !== 0) return statusDiff;
        // Within same status, keep updated_at desc order (already from DB)
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      
      setTasks(filteredTasks as Task[]);
    }
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast({
        variant: "destructive",
        title: "Título não pode estar vazio",
      });
      return;
    }

    // Get max order_index and add 1
    const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order_index)) : -1;

    const { error } = await supabase.from("tasks").insert({
      node_id: nodeId,
      title: formData.title,
      description: formData.description || null,
      status: formData.status,
      dependency_id: formData.dependency_id,
      progress: formData.progress,
      order_index: maxOrder + 1,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao criar tarefa",
        description: error.message,
      });
    } else {
      toast({ title: "Tarefa criada" });
      setFormData({ title: "", description: "", status: "pendente", dependency_id: null, progress: 0 });
      setIsCreating(false);
      fetchTasks();
      onTasksChange();
    }
  };

  const handleDelete = async (taskId: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir tarefa",
        description: error.message,
      });
    } else {
      toast({ title: "Tarefa excluída" });
      fetchTasks();
      onTasksChange();
    }
  };

  const handleMoveTask = async (taskId: string, newNodeId: string) => {
    if (newNodeId === nodeId) {
      setMovingTaskId(null);
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({ node_id: newNodeId })
      .eq("id", taskId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao mover tarefa",
        description: error.message,
      });
    } else {
      const targetNode = nodes.find(n => n.id === newNodeId);
      toast({ 
        title: "Tarefa movida",
        description: `Tarefa movida para ${targetNode?.title || "outro nó"}` 
      });
      
      // Update UI immediately by removing the task from the list
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
      setMovingTaskId(null);
      onTasksChange();
    }
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setFormData({ title: "", description: "", status: "pendente", dependency_id: null, progress: 0 });
  };

  const getStatusBadgeColor = (status: Task["status"]) => {
    switch (status) {
      case "estrutural":
        return "bg-node-roxo/20 text-node-roxo-foreground";
      case "andamento":
        return "bg-node-vermelho/20 text-node-vermelho-foreground";
      case "pendente":
        return "bg-node-amarelo/20 text-node-amarelo-foreground";
      case "concluído":
        return "bg-node-verde/20 text-node-verde-foreground";
    }
  };

  const getStatusBorderColor = (status: Task["status"]) => {
    switch (status) {
      case "estrutural":
        return "border-l-4 border-l-node-roxo";
      case "andamento":
        return "border-l-4 border-l-node-vermelho";
      case "pendente":
        return "border-l-4 border-l-node-amarelo";
      case "concluído":
        return "border-l-4 border-l-node-verde";
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    
    if (!draggedTask || draggedTask === targetTaskId) {
      setDraggedTask(null);
      return;
    }

    const draggedIndex = tasks.findIndex(t => t.id === draggedTask);
    const targetIndex = tasks.findIndex(t => t.id === targetTaskId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTask(null);
      return;
    }

    // Reorder tasks array
    const newTasks = [...tasks];
    const [removed] = newTasks.splice(draggedIndex, 1);
    newTasks.splice(targetIndex, 0, removed);

    // Update order_index for all affected tasks
    const updates = newTasks.map((task, index) => ({
      id: task.id,
      order_index: index,
    }));

    // Update UI immediately
    setTasks(newTasks.map((task, index) => ({ ...task, order_index: index })));

    // Update database
    try {
      for (const update of updates) {
        await supabase
          .from("tasks")
          .update({ order_index: update.order_index })
          .eq("id", update.id);
      }
      
      toast({ title: "Tarefas reordenadas" });
      onTasksChange();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao reordenar tarefas",
      });
      fetchTasks();
    }

    setDraggedTask(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl h-[90vh] flex flex-col p-4"
        style={{ pointerEvents: "auto" }}
      >
        <DialogHeader className="pb-3">
          <DialogTitle>Tarefas - {nodeTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-3 min-h-0">
          {/* Create new task button */}
          {!isCreating && (
            <Button
              onClick={() => setIsCreating(true)}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          )}

          {/* Create form */}
          {isCreating && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <Input
                placeholder="Título da tarefa"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
              <Textarea
                placeholder="Descrição (opcional)"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
              />
              <Select
                value={formData.status}
                onValueChange={(value: Task["status"]) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="estrutural">Estrutural</SelectItem>
                  <SelectItem value="andamento">Em Andamento</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="concluído">Concluído</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={formData.dependency_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, dependency_id: value === "none" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Depende de..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma dependência</SelectItem>
                  {tasks
                    .map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Progresso</label>
                  <span className="text-sm text-muted-foreground">{formData.progress}%</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) =>
                    setFormData({ ...formData, progress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreate}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Criar
                </Button>
                <Button onClick={cancelEdit} variant="outline">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Tasks list grouped by status */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {/* Group tasks by status */}
            {(["estrutural", "andamento", "pendente", "concluído"] as const).map((status) => {
              const statusTasks = tasks.filter((t) => t.status === status);
              if (statusTasks.length === 0) return null;
              
              return (
                <div key={status} className="space-y-2">
                  {/* Group subtitle with counter */}
                  <div className="flex items-center gap-2 pt-2 first:pt-0">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {STATUS_LABELS[status]}
                    </h3>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {statusTasks.length}
                    </span>
                  </div>
                  
                  {statusTasks.map((task) => {
              const dependencyTask = task.dependency_id 
                ? tasks.find(t => t.id === task.dependency_id)
                : null;
              
              return (
                <div key={task.id} className="relative">
                  {/* Connection line if task has a dependency */}
                  {dependencyTask && (
                    <div className="absolute -top-3 left-4 flex items-center gap-1 text-xs text-muted-foreground">
                      <svg width="20" height="12" className="opacity-50">
                        <line 
                          x1="10" 
                          y1="0" 
                          x2="10" 
                          y2="12" 
                          stroke="currentColor" 
                          strokeWidth="1.5"
                          strokeDasharray="3,3"
                        />
                      </svg>
                      <span className="text-[10px]">depende de: {dependencyTask.title}</span>
                    </div>
                  )}
                  
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, task.id)}
                    className={`border rounded-lg p-2 hover:bg-muted/30 transition-colors ${getStatusBorderColor(task.status)} ${
                      draggedTask === task.id ? "opacity-50" : ""
                    }`}
                  >
                    <div 
                      className="cursor-pointer"
                      onClick={() => navigate(`/task/${task.id}`, { 
                        state: { nodeId, nodeTitle } 
                      })}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <h4 className="text-sm font-medium flex-1 min-w-0 truncate">{task.title}</h4>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <DueDatePill dueDate={task.due_date} />
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${getStatusBadgeColor(
                              task.status
                            )}`}
                          >
                            {task.status === "estrutural" && "Estrutural"}
                            {task.status === "andamento" && "Em Andamento"}
                            {task.status === "pendente" && "Pendente"}
                            {task.status === "concluído" && "Concluído"}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(task.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium flex-shrink-0 w-8 text-right">{task.progress}%</span>
                      </div>
                    </div>

                    {/* Move task section */}
                    {movingTaskId === task.id ? (
                      <div className="mt-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2 items-center">
                          <Select
                            value={nodeId}
                            onValueChange={(value) => handleMoveTask(task.id, value)}
                          >
                            <SelectTrigger className="h-7 text-xs flex-1">
                              <SelectValue placeholder="Selecione o novo nó" />
                            </SelectTrigger>
                            <SelectContent>
                              {nodes.map((node) => (
                                <SelectItem key={node.id} value={node.id}>
                                  {node.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMovingTaskId(null);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-full text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMovingTaskId(task.id);
                          }}
                        >
                          <MoveHorizontal className="h-3 w-3 mr-1" />
                          Alterar Nó Pai
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                  );
                })}
                </div>
              );
            })}
            {tasks.length === 0 && !isCreating && (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma tarefa criada ainda
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
