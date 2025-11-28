import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { ArrowLeft, Save } from "lucide-react";

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

interface Node {
  id: string;
  title: string;
}

const TaskEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const { nodeId: locationNodeId, nodeTitle: locationNodeTitle } = location.state || {};
  
  const [task, setTask] = useState<Task | null>(null);
  const [node, setNode] = useState<Node | null>(null);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "pendente" as Task["status"],
    dependency_id: null as string | null,
    progress: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTask();
    }
  }, [id]);

  const fetchTask = async () => {
    if (!id) return;

    try {
      // Fetch task data
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (taskError) throw taskError;
      if (!taskData) {
        toast({
          variant: "destructive",
          title: "Tarefa não encontrada",
        });
        navigate(-1);
        return;
      }

      setTask(taskData as Task);
      setFormData({
        title: taskData.title,
        description: taskData.description || "",
        status: taskData.status as Task["status"],
        dependency_id: taskData.dependency_id,
        progress: taskData.progress,
      });

      // Fetch node data
      const { data: nodeData, error: nodeError } = await supabase
        .from("nodes")
        .select("id, title")
        .eq("id", taskData.node_id)
        .maybeSingle();

      if (nodeError) throw nodeError;
      setNode(nodeData as Node);

      // Fetch available tasks for dependencies (from same node, excluding current task)
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("node_id", taskData.node_id)
        .neq("id", id)
        .order("order_index", { ascending: true });

      if (tasksError) throw tasksError;
      setAvailableTasks(tasksData as Task[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar tarefa",
        description: error.message,
      });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({
        variant: "destructive",
        title: "Título não pode estar vazio",
      });
      return;
    }

    if (!id) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: formData.title,
          description: formData.description || null,
          status: formData.status,
          dependency_id: formData.dependency_id,
          progress: formData.progress,
        })
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Tarefa atualizada com sucesso" });
      navigate("/", { 
        state: { 
          openTasksDialog: true, 
          nodeId: task?.node_id,
          nodeTitle: node?.title 
        } 
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar tarefa",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-background">
        <p className="text-muted-foreground">Carregando tarefa...</p>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/", { 
              state: { 
                openTasksDialog: true, 
                nodeId: task?.node_id,
                nodeTitle: node?.title 
              } 
            })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Editar Tarefa</h1>
            {node && (
              <p className="text-sm text-muted-foreground">Nó: {node.title}</p>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4 bg-card border rounded-lg p-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Título</label>
            <Input
              placeholder="Título da tarefa"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Descrição</label>
            <Textarea
              placeholder="Descrição da tarefa (opcional)"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
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
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Dependência</label>
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
                {availableTasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                setFormData({ 
                  ...formData, 
                  progress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) 
                })
              }
            />
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${formData.progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Salvar e Voltar
          </Button>
          <Button variant="outline" onClick={() => navigate("/", { 
            state: { 
              openTasksDialog: true, 
              nodeId: task?.node_id,
              nodeTitle: node?.title 
            } 
          })}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TaskEdit;
