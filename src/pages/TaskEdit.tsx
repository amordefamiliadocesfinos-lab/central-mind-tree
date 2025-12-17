import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2, ListChecks, CalendarIcon, X, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";
import { MediaUploader, MediaItem, uploadMedia, loadMediaFromUrls } from "@/components/MediaUploader";
import { OnHoldBadge } from "@/components/OnHoldBadge";
import { OnHoldDialog } from "@/components/OnHoldDialog";
import { useOnHold, OnHoldFormData } from "@/hooks/useOnHold";

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

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
  checklist: ChecklistItem[];
  use_checklist_progress: boolean;
  due_date: string | null;
  scheduled_date: string | null;
  media_urls: string[];
  on_hold: boolean;
  on_hold_who: string | null;
  on_hold_channel: string | null;
  on_hold_deadline: string | null;
  on_hold_note: string | null;
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
    due_date: null as Date | null,
    scheduled_date: null as Date | null,
  });
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [useChecklistProgress, setUseChecklistProgress] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [showOnHoldDialog, setShowOnHoldDialog] = useState(false);
  
  const { toggleOnHold, loading: onHoldLoading } = useOnHold();

  // Calculate progress from checklist
  const calculatedProgress = checklist.length > 0
    ? Math.floor((checklist.filter(item => item.done).length / checklist.length) * 100)
    : 0;

  // Effective progress based on toggle
  const effectiveProgress = useChecklistProgress ? calculatedProgress : formData.progress;

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

      const taskChecklist = Array.isArray(taskData.checklist) 
        ? (taskData.checklist as unknown as ChecklistItem[])
        : [];

      const taskMediaUrls = Array.isArray(taskData.media_urls)
        ? (taskData.media_urls as string[])
        : [];

      setTask(taskData as unknown as Task);
      setFormData({
        title: taskData.title,
        description: taskData.description || "",
        status: taskData.status as Task["status"],
        dependency_id: taskData.dependency_id,
        progress: taskData.progress,
        due_date: taskData.due_date ? parseISO(taskData.due_date) : null,
        scheduled_date: taskData.scheduled_date ? parseISO(taskData.scheduled_date) : null,
      });
      setChecklist(taskChecklist);
      setUseChecklistProgress(taskData.use_checklist_progress || false);
      setShowChecklist(taskChecklist.length > 0);
      setMedia(loadMediaFromUrls(taskMediaUrls));

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
      setAvailableTasks(tasksData as unknown as Task[]);
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

    setSaving(true);
    try {
      // Upload new media files
      const mediaUrls = await uploadMedia(media, "task", id);

      const { error } = await supabase
        .from("tasks")
        .update({
          title: formData.title,
          description: formData.description || null,
          status: formData.status,
          dependency_id: formData.dependency_id,
          progress: effectiveProgress,
          checklist: JSON.parse(JSON.stringify(checklist)) as Json,
          use_checklist_progress: useChecklistProgress,
          due_date: formData.due_date ? format(formData.due_date, "yyyy-MM-dd") : null,
          scheduled_date: formData.scheduled_date ? format(formData.scheduled_date, "yyyy-MM-dd") : null,
          media_urls: mediaUrls,
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
    } finally {
      setSaving(false);
    }
  };

  const addChecklistItem = () => {
    if (!newItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      text: newItemText.trim(),
      done: false,
    };
    setChecklist([...checklist, newItem]);
    setNewItemText("");
  };

  const toggleChecklistItem = (itemId: string) => {
    setChecklist(checklist.map(item =>
      item.id === itemId ? { ...item, done: !item.done } : item
    ));
  };

  const removeChecklistItem = (itemId: string) => {
    setChecklist(checklist.filter(item => item.id !== itemId));
  };

  const handleOnHoldToggle = async (data?: OnHoldFormData) => {
    if (!task || !id) return;
    const success = await toggleOnHold(id, task.on_hold, data);
    if (success) {
      // Refresh task data
      const { data: updated } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", id)
        .single();
      if (updated) {
        setTask(updated as unknown as Task);
      }
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Editar Tarefa</h1>
              <OnHoldBadge
                onHold={task.on_hold}
                who={task.on_hold_who}
                channel={task.on_hold_channel}
                deadline={task.on_hold_deadline}
                note={task.on_hold_note}
              />
            </div>
            {node && (
              <p className="text-sm text-muted-foreground">Nó: {node.title}</p>
            )}
          </div>
          <Button
            variant={task.on_hold ? "default" : "outline"}
            size="sm"
            onClick={() => task.on_hold ? handleOnHoldToggle() : setShowOnHoldDialog(true)}
            disabled={onHoldLoading}
            className="gap-1"
          >
            <Clock className="h-4 w-4" />
            {task.on_hold ? "Remover Espera" : "Em Espera"}
          </Button>
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Descrição</label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChecklist(!showChecklist)}
                className="gap-1"
              >
                <ListChecks className="h-4 w-4" />
                Check-list
              </Button>
            </div>
            <Textarea
              placeholder="Descrição da tarefa (opcional)"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={12}
              className="min-h-[200px]"
            />
          </div>

          {/* Checklist Section */}
          {showChecklist && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Check-list</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Usar check-list para calcular progresso
                  </span>
                  <Switch
                    checked={useChecklistProgress}
                    onCheckedChange={setUseChecklistProgress}
                  />
                </div>
              </div>

              {/* Checklist Items */}
              <div className="space-y-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 rounded bg-background border"
                  >
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={() => toggleChecklistItem(item.id)}
                    />
                    <span className={`flex-1 text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>
                      {item.text}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => removeChecklistItem(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add new item */}
              <div className="flex gap-2">
                <Input
                  placeholder="Novo item..."
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                  className="flex-1"
                />
                <Button size="icon" onClick={addChecklistItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {checklist.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {checklist.filter(i => i.done).length}/{checklist.length} itens concluídos
                  {useChecklistProgress && ` (${calculatedProgress}%)`}
                </p>
              )}
            </div>
          )}

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
            <label className="text-sm font-medium">Data Limite</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !formData.due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date ? format(formData.due_date, "PPP", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.due_date || undefined}
                    onSelect={(date) => setFormData({ ...formData, due_date: date || null })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {formData.due_date && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFormData({ ...formData, due_date: null })}
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
              Quando esta data chegar, a tarefa será promovida automaticamente para "Em Andamento"
            </p>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !formData.scheduled_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.scheduled_date ? format(formData.scheduled_date, "PPP", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.scheduled_date || undefined}
                    onSelect={(date) => setFormData({ ...formData, scheduled_date: date || null })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {formData.scheduled_date && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFormData({ ...formData, scheduled_date: null })}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
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
              <span className="text-sm text-muted-foreground">{effectiveProgress}%</span>
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
              disabled={useChecklistProgress}
            />
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${effectiveProgress}%` }}
              />
            </div>
            {useChecklistProgress && (
              <p className="text-xs text-muted-foreground">
                Progresso calculado automaticamente pelo check-list
              </p>
            )}
          </div>

          {/* Media Attachments */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Anexos de Mídia</label>
            <MediaUploader media={media} onChange={setMedia} entityType="task" entityId={id || ""} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleSave} className="flex-1" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar e Voltar"}
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

      <OnHoldDialog
        open={showOnHoldDialog}
        onOpenChange={setShowOnHoldDialog}
        onConfirm={handleOnHoldToggle}
        taskTitle={task.title}
      />
    </div>
  );
};

export default TaskEdit;