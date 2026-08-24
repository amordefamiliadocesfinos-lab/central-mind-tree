import { useEffect, useMemo, useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { buildNodePath, type NodeRef } from "@/lib/tasks/taskGroups";
import { findRelatedTasks, type RelatableTask } from "@/lib/tasks/relatedTasks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tarefa analisada. */
  baseTask: RelatableTask | null;
  /** Universo de tarefas abertas. */
  tasks: RelatableTask[];
  nodesMap: Record<string, NodeRef>;
  /** Abre o fluxo de Projeto/Agrupamento já existente com as tarefas escolhidas. */
  onGroupSelected: (taskIds: string[]) => void;
}

const MAX_CANDIDATES = 10;

export function RelatedTasksDialog({ open, onOpenChange, baseTask, tasks, nodesMap, onGroupSelected }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const candidates = useMemo(() => {
    if (!baseTask) return [];
    return findRelatedTasks(baseTask, tasks, {
      limit: MAX_CANDIDATES,
      isGroupedNode: (nodeId) => nodesMap[nodeId]?.node_type === "function",
    });
  }, [baseTask, tasks, nodesMap]);

  useEffect(() => {
    if (open) setSelected(candidates.map((task) => task.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, baseTask?.id]);

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Encontrar relacionadas">
      <div className="space-y-4 p-4 sm:p-0">
        <div>
          <p className="text-xs text-muted-foreground">Tarefa analisada</p>
          <p className="text-sm font-medium">{baseTask?.title}</p>
        </div>

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma relação evidente encontrada.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Possivelmente relacionadas</p>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded border p-2">
              {candidates.map((task) => (
                <label key={task.id} className="flex items-center gap-2 rounded p-2 text-sm hover:bg-muted/50">
                  <Checkbox checked={selected.includes(task.id)} onCheckedChange={() => toggle(task.id)} />
                  <span className="flex-1 truncate">{task.title}</span>
                  <span className="max-w-[40%] truncate text-[11px] text-muted-foreground">
                    {buildNodePath(nodesMap, task.node_id)}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">As tarefas continuam individuais; nada é fundido ou reescrito.</p>
          </div>
        )}

        {candidates.length > 0 && (
          <Button
            className="w-full"
            disabled={selected.length === 0}
            onClick={() => {
              onGroupSelected(baseTask ? [baseTask.id, ...selected] : selected);
              onOpenChange(false);
            }}
          >
            Agrupar selecionadas
          </Button>
        )}
      </div>
    </ResponsiveDialog>
  );
}
