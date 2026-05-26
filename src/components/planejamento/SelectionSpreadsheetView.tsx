import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  Star,
  Pencil,
  Eye,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { DueDatePill } from "@/components/DueDatePill";

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  node_id: string;
  progress: number;
  due_date?: string | null;
  scheduled_date?: string | null;
}

interface NodeLite {
  id: string;
  title: string;
  color: string;
}

interface Props {
  tasks: Task[];
  nodesMap: Record<string, NodeLite>;
  selectedIds: string[];
  prioritizedIds: string[];
  onToggleSelected: (id: string) => void;
  onTogglePrioritized: (id: string) => void;
  onEdit: (task: Task) => void;
}

type SortKey =
  | "title"
  | "status"
  | "progress"
  | "node"
  | "due_date"
  | "selected"
  | "prioritized"
  | "description";
type SortDir = "asc" | "desc";

interface ColDef {
  key: SortKey | "actions";
  label: string;
  sortable?: boolean;
  default: number;
  min: number;
  align?: "left" | "center";
}

const COLUMNS: ColDef[] = [
  { key: "title", label: "Título", default: 280, min: 160 },
  { key: "node", label: "Nó / Área", default: 180, min: 120 },
  { key: "status", label: "Status", default: 130, min: 100 },
  { key: "progress", label: "Progresso", default: 150, min: 110 },
  { key: "due_date", label: "Prazo", default: 130, min: 100, align: "center" },
  { key: "selected", label: "Plano", default: 90, min: 70, align: "center" },
  { key: "prioritized", label: "Prio", default: 90, min: 70, align: "center" },
  { key: "description", label: "Descrição", default: 280, min: 160 },
  { key: "actions", label: "Ações", sortable: false, default: 220, min: 180, align: "center" },
];

const WIDTH_KEY = "planejamento:spreadsheet:widths:v1";
const VIS_KEY = "planejamento:spreadsheet:visible:v1";
const ROW_KEY = "planejamento:spreadsheet:rowHeight:v1";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  andamento: { label: "Em andamento", color: "bg-red-500" },
  pendente: { label: "Pendente", color: "bg-yellow-500" },
  "em pausa": { label: "Em pausa", color: "bg-orange-500" },
  concluído: { label: "Concluído", color: "bg-emerald-500" },
};

export function SelectionSpreadsheetView({
  tasks,
  nodesMap,
  selectedIds,
  prioritizedIds,
  onToggleSelected,
  onTogglePrioritized,
  onEdit,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("node");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(WIDTH_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return Object.fromEntries(COLUMNS.map((c) => [c.key, c.default]));
  });

  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(VIS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return Object.fromEntries(COLUMNS.map((c) => [c.key, true]));
  });

  const [rowHeight, setRowHeight] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(ROW_KEY);
      if (raw) return parseInt(raw, 10) || 52;
    } catch {}
    return 52;
  });

  useEffect(() => {
    try { localStorage.setItem(WIDTH_KEY, JSON.stringify(widths)); } catch {}
  }, [widths]);
  useEffect(() => {
    try { localStorage.setItem(VIS_KEY, JSON.stringify(visible)); } catch {}
  }, [visible]);
  useEffect(() => {
    try { localStorage.setItem(ROW_KEY, String(rowHeight)); } catch {}
  }, [rowHeight]);

  const resizing = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const onResizeStart = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    const col = COLUMNS.find((c) => c.key === key);
    resizing.current = {
      key,
      startX: e.clientX,
      startW: widths[key] ?? col?.default ?? 120,
    };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientX - resizing.current.startX;
      const min = COLUMNS.find((c) => c.key === resizing.current!.key)?.min ?? 60;
      const next = Math.max(min, resizing.current.startW + delta);
      setWidths((w) => ({ ...w, [resizing.current!.key]: next }));
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const visibleCols = useMemo(
    () => COLUMNS.filter((c) => visible[c.key] !== false),
    [visible]
  );

  const sorted = useMemo(() => {
    const arr = [...tasks];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const getVal = (t: Task): string | number => {
        switch (sortKey) {
          case "title":
            return (t.title || "").toLowerCase();
          case "status":
            return t.status || "";
          case "progress":
            return t.progress || 0;
          case "node":
            return (nodesMap[t.node_id]?.title || "").toLowerCase();
          case "due_date":
            return t.due_date || "9999-99-99";
          case "selected":
            return selectedIds.includes(t.id) ? 0 : 1;
          case "prioritized":
            return prioritizedIds.includes(t.id) ? 0 : 1;
          case "description":
            return (t.description || "").toLowerCase();
          default:
            return 0;
        }
      };
      const av = getVal(a);
      const bv = getVal(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [tasks, sortKey, sortDir, nodesMap, selectedIds, prioritizedIds]);

  const toggleSort = (k: SortKey | "actions") => {
    const col = COLUMNS.find((c) => c.key === k);
    if (col?.sortable === false) return;
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k as SortKey);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey | "actions" }) =>
    sortKey !== k ? (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    ) : sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary" />
    );

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-12 text-center text-sm text-muted-foreground">
        Nenhuma tarefa em andamento ou pendente.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
        <div className="text-[11px] text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "tarefa" : "tarefas"}
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                <Settings2 className="h-3.5 w-3.5" /> Linhas
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Altura da linha</div>
              <div className="flex gap-1">
                {[
                  { label: "Compacta", v: 40 },
                  { label: "Normal", v: 52 },
                  { label: "Confortável", v: 72 },
                  { label: "Ampla", v: 96 },
                ].map((opt) => (
                  <Button
                    key={opt.v}
                    size="sm"
                    variant={rowHeight === opt.v ? "default" : "outline"}
                    className="h-7 px-2 text-[11px] flex-1"
                    onClick={() => setRowHeight(opt.v)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                <Eye className="h-3.5 w-3.5" /> Colunas
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                Colunas visíveis
              </div>
              <div className="space-y-0.5">
                {COLUMNS.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={visible[c.key] !== false}
                      onCheckedChange={(checked) =>
                        setVisible((v) => ({ ...v, [c.key]: !!checked }))
                      }
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="overflow-auto max-h-[calc(100vh-22rem)]">
        <table
          className="text-sm border-separate border-spacing-0"
          style={{ width: "max-content", minWidth: "100%", tableLayout: "fixed" }}
        >
          <colgroup>
            {visibleCols.map((c) => (
              <col key={c.key} style={{ width: `${widths[c.key] ?? c.default}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {visibleCols.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={cn(
                    "group relative sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground select-none border-b border-border/60",
                    c.sortable === false ? "cursor-default" : "cursor-pointer hover:text-foreground transition-colors",
                    c.align === "center" ? "text-center" : "text-left"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 truncate",
                      c.align === "center" && "justify-center w-full"
                    )}
                  >
                    {c.label}
                    {c.sortable !== false && <SortIcon k={c.key} />}
                  </span>
                  <span
                    onMouseDown={(e) => onResizeStart(e, c.key)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
                    title="Arraste para redimensionar"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((task, idx) => {
              const status = STATUS_LABEL[task.status] || { label: task.status, color: "bg-muted-foreground" };
              const node = nodesMap[task.node_id];
              const isSelected = selectedIds.includes(task.id);
              const isPrio = prioritizedIds.includes(task.id);

              return (
                <tr
                  key={task.id}
                  style={{ height: rowHeight }}
                  className={cn(
                    "group transition-colors",
                    idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                    "hover:bg-primary/5"
                  )}
                >
                  {visible.title !== false && (
                    <td className="px-3 border-b border-border/40 align-middle">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn("w-2 h-2 rounded-full shrink-0", status.color)}
                        />
                        <span className="font-medium truncate block">
                          {task.title || "Sem título"}
                        </span>
                      </div>
                    </td>
                  )}

                  {visible.node !== false && (
                    <td className="px-3 border-b border-border/40 align-middle">
                      {node ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium truncate max-w-full"
                          style={{ backgroundColor: node.color + "33", color: "inherit" }}
                        >
                          {node.title}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic">—</span>
                      )}
                    </td>
                  )}

                  {visible.status !== false && (
                    <td className="px-3 border-b border-border/40 align-middle">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-1 text-xs font-medium max-w-full truncate">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", status.color)} />
                        <span className="truncate">{status.label}</span>
                      </span>
                    </td>
                  )}

                  {visible.progress !== false && (
                    <td className="px-3 border-b border-border/40 align-middle">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs tabular-nums font-medium shrink-0 w-9">
                          {task.progress}%
                        </span>
                        <div className="flex-1 min-w-[24px] h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  )}

                  {visible.due_date !== false && (
                    <td className="px-3 border-b border-border/40 align-middle text-center">
                      {task.due_date ? (
                        <DueDatePill dueDate={task.due_date} />
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic">—</span>
                      )}
                    </td>
                  )}

                  {visible.selected !== false && (
                    <td className="px-3 border-b border-border/40 align-middle text-center">
                      <Button
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSelected(task.id);
                        }}
                        className="h-8 px-2"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </td>
                  )}

                  {visible.prioritized !== false && (
                    <td className="px-3 border-b border-border/40 align-middle text-center">
                      <Button
                        variant={isPrio ? "default" : "outline"}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePrioritized(task.id);
                        }}
                        className={cn(
                          "h-8 px-2",
                          isPrio && "bg-amber-500 hover:bg-amber-600"
                        )}
                      >
                        <Star className="h-3 w-3" />
                      </Button>
                    </td>
                  )}

                  {visible.description !== false && (
                    <td className="px-3 border-b border-border/40 align-middle">
                      {task.description ? (
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {task.description}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic">—</span>
                      )}
                    </td>
                  )}

                  {visible.actions !== false && (
                    <td className="px-2 border-b border-border/40 align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(task);
                          }}
                          className="h-8 w-8 p-0"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelected(task.id);
                          }}
                          className="h-8 px-2 text-xs"
                        >
                          <Check className="h-3 w-3 mr-1" /> Plano
                        </Button>
                        <Button
                          variant={isPrio ? "default" : "outline"}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePrioritized(task.id);
                          }}
                          className={cn(
                            "h-8 px-2 text-xs",
                            isPrio && "bg-amber-500 hover:bg-amber-600"
                          )}
                        >
                          <Star className="h-3 w-3 mr-1" /> Prio
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
