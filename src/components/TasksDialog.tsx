import { useState, useEffect } from "react";
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "pendente" as Task["status"],
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
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar tarefas",
        description: error.message,
      });
    } else {
      // Sort tasks by status priority
      const statusOrder = {
        estrutural: 1,
        andamento: 2,
        pendente: 3,
        concluído: 4,
      };
      let filteredTasks = data || [];
      
      // Apply filter if filterStatus is set
      if (filterStatus) {
        filteredTasks = filteredTasks.filter((task) => task.status === filterStatus);
      }
      
      const sortedTasks = filteredTasks.sort(
        (a, b) => statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder]
      );
      setTasks(sortedTasks as Task[]);
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

    const { error } = await supabase.from("tasks").insert({
      node_id: nodeId,
      title: formData.title,
      description: formData.description || null,
      status: formData.status,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao criar tarefa",
        description: error.message,
      });
    } else {
      toast({ title: "Tarefa criada" });
      setFormData({ title: "", description: "", status: "pendente" });
      setIsCreating(false);
      fetchTasks();
      onTasksChange();
    }
  };

  const handleUpdate = async (taskId: string) => {
    if (!formData.title.trim()) {
      toast({
        variant: "destructive",
        title: "Título não pode estar vazio",
      });
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({
        title: formData.title,
        description: formData.description || null,
        status: formData.status,
      })
      .eq("id", taskId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar tarefa",
        description: error.message,
      });
    } else {
      toast({ title: "Tarefa atualizada" });
      setEditingId(null);
      setFormData({ title: "", description: "", status: "pendente" });
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

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setFormData({
      title: task.title,
      description: task.description || "",
      status: task.status,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData({ title: "", description: "", status: "pendente" });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tarefas - {nodeTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new task button */}
          {!isCreating && !editingId && (
            <Button
              onClick={() => setIsCreating(true)}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          )}

          {/* Create/Edit form */}
          {(isCreating || editingId) && (
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
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    editingId ? handleUpdate(editingId) : handleCreate()
                  }
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {editingId ? "Salvar" : "Criar"}
                </Button>
                <Button onClick={cancelEdit} variant="outline">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Tasks list */}
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`border rounded-lg p-4 space-y-2 hover:bg-muted/30 transition-colors ${getStatusBorderColor(task.status)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{task.title}</h4>
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
                      onClick={() => startEdit(task)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleDelete(task.id)}
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
            ))}
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
