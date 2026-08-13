import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, ListChecks, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveTask } from "@/lib/tasks/saveTask";

type ChecklistItem = { id: string; text: string; done: boolean };

interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  status: "estrutural" | "andamento" | "pendente" | "concluído";
  node_id: string;
  progress: number;
  dependency_id: string | null;
  due_date: string | null;
  checklist: ChecklistItem[] | null;
  use_checklist_progress: boolean | null;
}

interface TaskOption { id: string; title: string; }
interface Collaborator { id: string; name: string; role: string | null; }

interface Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  areaName?: string;
}

/**
 * Edição contextual do Foco. Usa a mesma tabela e os mesmos campos de TaskEdit;
 * a rota /task/:id permanece disponível para a edição completa em outros fluxos.
 */
export function TaskContextPanel({ taskId, open, onOpenChange, onSaved, areaName }: Props) {
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<TaskOption[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [form, setForm] = useState({
    title: "", description: "", status: "pendente" as TaskRecord["status"],
    dependency_id: null as string | null, assigned_to: null as string | null,
    progress: 0, due_date: "", use_checklist_progress: false,
  });
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const checklistProgress = useMemo(() => checklist.length
    ? Math.floor((checklist.filter((item) => item.done).length / checklist.length) * 100)
    : 0, [checklist]);
  const effectiveProgress = form.use_checklist_progress ? checklistProgress : form.progress;

  useEffect(() => {
    if (!open || !taskId) return;
    const load = async () => {
      setLoading(true);
      const { data: taskData, error } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
      if (error || !taskData) {
        toast.error("Não foi possível carregar a tarefa");
        onOpenChange(false);
        setLoading(false);
        return;
      }
      const current = taskData as unknown as TaskRecord & { assigned_to: string | null };
      const items = Array.isArray(current.checklist) ? current.checklist : [];
      setTask(current);
      setChecklist(items);
      setForm({
        title: current.title, description: current.description || "", status: current.status,
        dependency_id: current.dependency_id, assigned_to: current.assigned_to || null,
        progress: current.progress, due_date: current.due_date || "", use_checklist_progress: current.use_checklist_progress || false,
      });
      const [tasksResult, usersResult] = await Promise.all([
        supabase.from("tasks").select("id, title").eq("node_id", current.node_id).neq("id", current.id).order("order_index"),
        supabase.from("app_users").select("id, name, role").eq("is_active", true).order("name"),
      ]);
      setAvailableTasks(tasksResult.data || []);
      setCollaborators(usersResult.data || []);
      setLoading(false);
    };
    load();
  }, [open, taskId, onOpenChange]);

  const addChecklistItem = () => {
    const text = newChecklistItem.trim();
    if (!text) return;
    setChecklist((current) => [...current, { id: crypto.randomUUID(), text, done: false }]);
    setNewChecklistItem("");
  };

  const save = async () => {
    if (!taskId || !form.title.trim()) {
      toast.error("O título não pode ficar vazio");
      return;
    }
    setSaving(true);
    const { error } = await saveTask(taskId, {
      title: form.title.trim(), description: form.description || null, status: form.status,
      dependency_id: form.dependency_id, assigned_to: form.assigned_to,
      due_date: form.due_date || null,
      progress: effectiveProgress, checklist: JSON.parse(JSON.stringify(checklist)) as Json,
      use_checklist_progress: form.use_checklist_progress,
    });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar a tarefa");
      return;
    }
    toast.success("Tarefa atualizada");
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b px-6 py-5 pr-12">
            <SheetTitle>Detalhes da tarefa</SheetTitle>
            <SheetDescription>Edite sem sair da sua fila de execução.</SheetDescription>
            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              <Badge variant="outline">Área: {areaName || "Não informada"}</Badge>
              <Badge variant="secondary">Status: {form.status}</Badge>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading || !task ? <p className="text-sm text-muted-foreground">Carregando tarefa…</p> : (
              <div className="space-y-5">
                <label className="grid gap-2 text-sm font-medium">Título
                  <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                </label>
                <label className="grid gap-2 text-sm font-medium">Descrição
                  <Textarea rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
                <label className="grid gap-2 text-sm font-medium">Status
                  <Select value={form.status} onValueChange={(value: TaskRecord["status"]) => setForm({ ...form, status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="estrutural">Estrutural</SelectItem><SelectItem value="andamento">Em andamento</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem><SelectItem value="concluído">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-2 text-sm font-medium">Prazo
                  <Input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
                </label>
                <label className="grid gap-2 text-sm font-medium">Responsável
                  <Select value={form.assigned_to || "none"} onValueChange={(value) => setForm({ ...form, assigned_to: value === "none" ? null : value })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum responsável" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Nenhum responsável</SelectItem>{collaborators.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}{user.role ? ` (${user.role})` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                <label className="grid gap-2 text-sm font-medium">Dependência
                  <Select value={form.dependency_id || "none"} onValueChange={(value) => setForm({ ...form, dependency_id: value === "none" ? null : value })}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma dependência" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Nenhuma dependência</SelectItem>{availableTasks.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4" />Checklist</h3><p className="text-xs text-muted-foreground">As alterações são salvas junto com a tarefa.</p></div><div className="flex items-center gap-2 text-xs"><span>Calcular progresso</span><Switch checked={form.use_checklist_progress} onCheckedChange={(value) => setForm({ ...form, use_checklist_progress: value })} /></div></div>
                  <div className="space-y-2">{checklist.map((item) => <div key={item.id} className="flex items-center gap-2"><Checkbox checked={item.done} onCheckedChange={() => setChecklist((current) => current.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry))} /><span className={item.done ? "flex-1 text-sm text-muted-foreground line-through" : "flex-1 text-sm"}>{item.text}</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setChecklist((current) => current.filter((entry) => entry.id !== item.id))}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</div>
                  <div className="flex gap-2"><Input value={newChecklistItem} placeholder="Novo item" onChange={(event) => setNewChecklistItem(event.target.value)} onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addChecklistItem())} /><Button type="button" size="icon" onClick={addChecklistItem}><Plus className="h-4 w-4" /></Button></div>
                  <p className="text-xs text-muted-foreground">{checklist.filter((item) => item.done).length}/{checklist.length} itens concluídos{form.use_checklist_progress ? ` · ${checklistProgress}%` : ""}</p>
                </section>
              </div>
            )}
          </div>
          <div className="border-t bg-background px-6 py-4"><Button className="w-full" onClick={save} disabled={loading || saving || !task}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar tarefa"}</Button></div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
