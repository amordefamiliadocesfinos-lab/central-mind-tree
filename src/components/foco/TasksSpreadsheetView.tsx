import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  Clock,
  ExternalLink,
  Plus,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  Settings2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

interface Task {
  id: string;
  title: string;
  description: string | null;
  node_id: string;
  progress: number;
  order_index: number;
  dependency_id: string | null;
  status: string;
}

interface NodeMap {
  [id: string]: { id: string; title: string };
}

interface DepMap {
  [id: string]: { id: string; title: string; status: string };
}

interface Props {
  tasks: Task[];
  nodes: NodeMap;
  dependencyTasks: DepMap;
  queue: string[];
  activeTaskId: string | null;
  onSelectTask: (id: string) => void;
  onAddToQueue: (id: string) => void;
  onRemoveFromQueue: (id: string) => void;
  onComplete: (id: string) => void;
  onMoveToPending: (id: string) => void;
  onOpenEdit: (id: string) => void;
}

type SortKey =
  | 'queueIndex'
  | 'title'
  | 'status'
  | 'progress'
  | 'node'
  | 'dependency'
  | 'description';
type SortDir = 'asc' | 'desc';

interface ColDef {
  key: SortKey | 'actions';
  label: string;
  sortable?: boolean;
  default: number;
  min: number;
  align?: 'left' | 'center';
}

const COLUMNS: ColDef[] = [
  { key: 'queueIndex', label: '#', default: 70, min: 50, align: 'center' },
  { key: 'title', label: 'Título', default: 280, min: 160 },
  { key: 'status', label: 'Status', default: 140, min: 100 },
  { key: 'progress', label: 'Progresso', default: 150, min: 110 },
  { key: 'node', label: 'Nó', default: 180, min: 120 },
  { key: 'dependency', label: 'Dependência', default: 200, min: 140 },
  { key: 'description', label: 'Descrição', default: 320, min: 160 },
  { key: 'actions', label: 'Ações', sortable: false, default: 180, min: 140, align: 'center' },
];

const WIDTH_KEY = 'foco:spreadsheet:widths:v1';
const VIS_KEY = 'foco:spreadsheet:visible:v1';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  andamento: { label: 'Em andamento', color: 'bg-blue-500' },
  pendente: { label: 'Pendente', color: 'bg-amber-500' },
  'em pausa': { label: 'Em pausa', color: 'bg-orange-500' },
  concluído: { label: 'Concluído', color: 'bg-emerald-500' },
};

export function TasksSpreadsheetView({
  tasks,
  nodes,
  dependencyTasks,
  queue,
  activeTaskId,
  onSelectTask,
  onAddToQueue,
  onRemoveFromQueue,
  onComplete,
  onMoveToPending,
  onOpenEdit,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('queueIndex');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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
      const raw = localStorage.getItem('foco:spreadsheet:rowHeight:v1');
      if (raw) return parseInt(raw, 10) || 52;
    } catch {}
    return 52;
  });

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, JSON.stringify(widths));
    } catch {}
  }, [widths]);

  useEffect(() => {
    try {
      localStorage.setItem(VIS_KEY, JSON.stringify(visible));
    } catch {}
  }, [visible]);

  useEffect(() => {
    try {
      localStorage.setItem('foco:spreadsheet:rowHeight:v1', String(rowHeight));
    } catch {}
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
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const visibleCols = useMemo(() => COLUMNS.filter((c) => visible[c.key] !== false), [visible]);

  const sorted = useMemo(() => {
    const arr = [...tasks];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const getVal = (t: Task): string | number => {
        switch (sortKey) {
          case 'queueIndex': {
            const ai = queue.indexOf(t.id);
            return ai === -1 ? 9999 : ai;
          }
          case 'title':
            return (t.title || '').toLowerCase();
          case 'status':
            return t.status || '';
          case 'progress':
            return t.progress || 0;
          case 'node':
            return (nodes[t.node_id]?.title || '').toLowerCase();
          case 'dependency':
            return (t.dependency_id ? dependencyTasks[t.dependency_id]?.title || '' : '').toLowerCase();
          case 'description':
            return (t.description || '').toLowerCase();
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
  }, [tasks, sortKey, sortDir, queue, nodes, dependencyTasks]);

  const toggleSort = (k: SortKey | 'actions') => {
    const col = COLUMNS.find((c) => c.key === k);
    if (col?.sortable === false) return;
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k as SortKey);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey | 'actions' }) =>
    sortKey !== k ? (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    ) : sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary" />
    );

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-12 text-center text-sm text-muted-foreground">
        Nenhuma tarefa em andamento.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
        <div className="text-[11px] text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? 'tarefa' : 'tarefas'}
        </div>
        <div className="flex items-center gap-2">
          {/* Row height */}
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
                  { label: 'Compacta', v: 40 },
                  { label: 'Normal', v: 52 },
                  { label: 'Confortável', v: 72 },
                  { label: 'Ampla', v: 96 },
                ].map((opt) => (
                  <Button
                    key={opt.v}
                    size="sm"
                    variant={rowHeight === opt.v ? 'default' : 'outline'}
                    className="h-7 px-2 text-[11px] flex-1"
                    onClick={() => setRowHeight(opt.v)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Columns toggle */}
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
          style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}
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
                    'group relative sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground select-none border-b border-border/60',
                    c.sortable === false ? 'cursor-default' : 'cursor-pointer hover:text-foreground transition-colors',
                    c.align === 'center' ? 'text-center' : 'text-left',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 truncate',
                      c.align === 'center' && 'justify-center w-full',
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
              const status = STATUS_LABEL[task.status] || { label: task.status, color: 'bg-muted-foreground' };
              const dep = task.dependency_id ? dependencyTasks[task.dependency_id] : null;
              const node = nodes[task.node_id];
              const queueIdx = queue.indexOf(task.id);
              const isActive = activeTaskId === task.id;

              return (
                <tr
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  style={{ height: rowHeight }}
                  className={cn(
                    'group cursor-pointer transition-colors',
                    idx % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                    isActive && 'bg-destructive/10 hover:bg-destructive/15',
                    !isActive && 'hover:bg-primary/5',
                  )}
                >
                  {visible.queueIndex !== false && (
                    <td className="px-3 border-b border-border/40 align-middle text-center">
                      {queueIdx >= 0 ? (
                        <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tabular-nums">
                          {queueIdx + 1}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      )}
                    </td>
                  )}

                  {visible.title !== false && (
                    <td className="px-3 border-b border-border/40 align-middle">
                      <span className={cn(
                        'font-medium truncate block transition-colors',
                        isActive ? 'text-destructive' : 'text-foreground group-hover:text-primary',
                      )}>
                        {task.title || 'Sem título'}
                      </span>
                    </td>
                  )}

                  {visible.status !== false && (
                    <td className="px-3 border-b border-border/40 align-middle">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-1 text-xs font-medium max-w-full truncate">
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', status.color)} />
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

                  {visible.node !== false && (
                    <td className="px-3 border-b border-border/40 align-middle">
                      <span className="text-xs text-foreground/80 truncate block">
                        {node?.title || <span className="text-muted-foreground/60 italic">—</span>}
                      </span>
                    </td>
                  )}

                  {visible.dependency !== false && (
                    <td className="px-3 border-b border-border/40 align-middle">
                      {dep ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'cursor-pointer text-xs max-w-full',
                            dep.status !== 'concluído'
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-600'
                              : '',
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/task/${dep.id}`, '_blank');
                          }}
                        >
                          {dep.status !== 'concluído' && <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />}
                          <span className="truncate">{dep.title}</span>
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic">—</span>
                      )}
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
                    <td
                      className="px-2 border-b border-border/40 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                          title="Concluir"
                          onClick={() => onComplete(task.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                          title="Pendente"
                          onClick={() => onMoveToPending(task.id)}
                        >
                          <Clock className="h-3.5 w-3.5" />
                        </Button>
                        {queueIdx >= 0 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="Remover da fila"
                            onClick={() => onRemoveFromQueue(task.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            title="Adicionar à fila"
                            onClick={() => onAddToQueue(task.id)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Abrir"
                          onClick={() => onOpenEdit(task.id)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
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
      <div className="px-3 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>{sorted.length} {sorted.length === 1 ? 'tarefa' : 'tarefas'}</span>
        <span className="hidden sm:inline">
          Clique nas colunas para ordenar · Arraste a borda direita para redimensionar · Use "Colunas" e "Linhas" para personalizar
        </span>
      </div>
    </div>
  );
}
