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
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";

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
    }
  }, [open, nodeId]);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("node_id", nodeId)
      .order("order_index", { ascending: true });

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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tarefas - {nodeTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          {/* Tasks list with dependency connections */}
          <div className="space-y-3 relative">
            {tasks.map((task, index) => {
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
                    onClick={() => navigate(`/task/${task.id}`)}
                    className={`border rounded-lg p-4 space-y-2 hover:bg-muted/30 transition-colors cursor-pointer ${getStatusBorderColor(task.status)} ${
                      draggedTask === task.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-medium">{task.title}</h4>
                          <span className="text-xs text-muted-foreground font-medium">{task.progress}%</span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(task.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeColor(
                          task.status
                        )}`}
                      >
                        {task.status === "estrutural" && "Estrutural"}
                        {task.status === "andamento" && "Em Andamento"}
                        {task.status === "pendente" && "Pendente"}
                        {task.status === "concluído" && "Concluído"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(task.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
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
