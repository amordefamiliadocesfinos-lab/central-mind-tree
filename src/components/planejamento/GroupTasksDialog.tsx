import { useEffect, useMemo, useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { assignTasksToGroup, buildNodePath, createGroupNode, type NodeRef } from "@/lib/tasks/taskGroups";

interface TaskLike {
  id: string;
  title: string;
  node_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: TaskLike[];
  nodes: NodeRef[];
  /** Tarefas pré-marcadas (ex.: selecionadas no plano). */
  initialTaskIds?: string[];
  onGrouped: () => void;
}

/**
 * Associa tarefas existentes a um Projeto/Agrupamento (um `node`).
 * Só altera `tasks.node_id`; nada é apagado, fundido ou reescrito.
 */
export function GroupTasksDialog({ open, onOpenChange, tasks, nodes, initialTaskIds = [], onGrouped }: Props) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [targetNodeId, setTargetNodeId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [parentNodeId, setParentNodeId] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(initialTaskIds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(initialTaskIds);
      setSearch("");
      setNewTitle("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nodesMap = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])) as Record<string, NodeRef>, [nodes]);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return tasks;
    return tasks.filter((task) => task.title.toLocaleLowerCase("pt-BR").includes(query));
  }, [tasks, search]);

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const handleConfirm = async () => {
    if (selected.length === 0) {
      toast.error("Selecione ao menos uma tarefa.");
      return;
    }
    if (mode === "existing" && !targetNodeId) {
      toast.error("Escolha o agrupamento de destino.");
      return;
    }
    if (mode === "new" && (!newTitle.trim() || !parentNodeId)) {
      toast.error("Informe o nome do projeto e a área.");
      return;
    }
    setSaving(true);
    try {
      const nodeId =
        mode === "existing"
          ? targetNodeId
          : (await createGroupNode({ title: newTitle.trim(), parentId: parentNodeId })).id;
      await assignTasksToGroup(selected, nodeId);
      toast.success(`${selected.length} tarefa(s) agrupada(s).`);
      onOpenChange(false);
      onGrouped();
    } catch {
      toast.error("Não foi possível agrupar as tarefas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Agrupar em Projeto">
      <div className="space-y-4 p-4 sm:p-0">
        <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
          <Button size="sm" variant={mode === "existing" ? "default" : "ghost"} onClick={() => setMode("existing")}>
            Projeto existente
          </Button>
          <Button size="sm" variant={mode === "new" ? "default" : "ghost"} onClick={() => setMode("new")}>
            Novo projeto
          </Button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Projeto/Agrupamento</label>
            <Select value={targetNodeId} onValueChange={setTargetNodeId}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Escolha o destino" /></SelectTrigger>
              <SelectContent>
                {nodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>{buildNodePath(nodesMap, node.id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do projeto</label>
              <Input className="h-11" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Ex.: Lançamento linha nova" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Área (nó-pai)</label>
              <Select value={parentNodeId} onValueChange={setParentNodeId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Escolha a área" /></SelectTrigger>
                <SelectContent>
                  {nodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>{buildNodePath(nodesMap, node.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Tarefas ({selected.length} selecionada(s))</label>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar tarefa..." />
          <div className="max-h-64 space-y-1 overflow-y-auto rounded border p-2">
            {visibleTasks.map((task) => (
              <label key={task.id} className="flex items-center gap-2 rounded p-2 text-sm hover:bg-muted/50">
                <Checkbox checked={selected.includes(task.id)} onCheckedChange={() => toggle(task.id)} />
                <span className="flex-1 truncate">{task.title}</span>
                <span className="text-[11px] text-muted-foreground truncate max-w-[40%]">{buildNodePath(nodesMap, task.node_id)}</span>
              </label>
            ))}
            {visibleTasks.length === 0 && <p className="p-2 text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>}
          </div>
          <p className="text-xs text-muted-foreground">As tarefas continuam individuais; apenas passam a pertencer ao projeto.</p>
        </div>

        <Button className="w-full" onClick={handleConfirm} disabled={saving}>
          {saving ? "Agrupando…" : "Agrupar tarefas"}
        </Button>
      </div>
    </ResponsiveDialog>
  );
}
