import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Settings2,
  X,
  Crosshair,
  Image as ImageIcon,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NodeRow {
  id: string;
  parent_id: string | null;
  title: string;
  color: "roxo" | "vermelho" | "amarelo" | "verde";
  is_visible: boolean;
  order_index: number;
  created_at: string;
  media_urls: any;
}

interface Props {
  onClose: () => void;
  onNodeClick?: (nodeId: string) => void;
}

type SortKey =
  | "index"
  | "title"
  | "color"
  | "parent"
  | "level"
  | "children"
  | "order_index"
  | "media"
  | "created_at";
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
  { key: "index", label: "#", default: 70, min: 50, align: "center" },
  { key: "title", label: "Título", default: 280, min: 160 },
  { key: "color", label: "Cor", default: 120, min: 90 },
  { key: "parent", label: "Pai", default: 220, min: 140 },
  { key: "level", label: "Nível", default: 90, min: 70, align: "center" },
  { key: "children", label: "Filhos", default: 90, min: 70, align: "center" },
  { key: "order_index", label: "Ordem", default: 90, min: 70, align: "center" },
  { key: "media", label: "Mídia", default: 90, min: 70, align: "center" },
  { key: "created_at", label: "Criado", default: 140, min: 110 },
  {
    key: "actions",
    label: "Ações",
    sortable: false,
    default: 120,
    min: 100,
    align: "center",
  },
];

const WIDTH_KEY = "nodes:spreadsheet:widths:v1";
const VIS_KEY = "nodes:spreadsheet:visible:v1";
const ROW_KEY = "nodes:spreadsheet:rowHeight:v1";

const COLOR_STYLES: Record<string, string> = {
  roxo: "bg-[hsl(var(--node-roxo))]",
  vermelho: "bg-[hsl(var(--node-vermelho))]",
  amarelo: "bg-[hsl(var(--node-amarelo))]",
  verde: "bg-[hsl(var(--node-verde))]",
};

export function NodesSpreadsheetView({ onClose, onNodeClick }: Props) {
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("title");
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
      if (raw) return parseInt(raw, 10) || 48;
    } catch {}
    return 48;
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("nodes")
        .select("id,parent_id,title,color,is_visible,order_index,created_at,media_urls")
        .eq("is_visible", true)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setNodes((data as NodeRow[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Compute levels + children counts
  const { levelMap, childrenMap, parentTitleMap } = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const levelMap = new Map<string, number>();
    const childrenMap = new Map<string, number>();
    const parentTitleMap = new Map<string, string>();

    nodes.forEach((n) => {
      if (n.parent_id) {
        childrenMap.set(n.parent_id, (childrenMap.get(n.parent_id) || 0) + 1);
        parentTitleMap.set(n.id, byId.get(n.parent_id)?.title || "—");
      }
    });

    const calcLevel = (id: string, seen = new Set<string>()): number => {
      if (levelMap.has(id)) return levelMap.get(id)!;
      if (seen.has(id)) return 0;
      seen.add(id);
      const n = byId.get(id);
      if (!n || !n.parent_id) {
        levelMap.set(id, 0);
        return 0;
      }
      const lv = calcLevel(n.parent_id, seen) + 1;
      levelMap.set(id, lv);
      return lv;
    };
    nodes.forEach((n) => calcLevel(n.id));
    return { levelMap, childrenMap, parentTitleMap };
  }, [nodes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (parentTitleMap.get(n.id) || "").toLowerCase().includes(q),
    );
  }, [nodes, search, parentTitleMap]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const get = (n: NodeRow): string | number => {
        switch (sortKey) {
          case "index": return 0;
          case "title": return n.title.toLowerCase();
          case "color": return n.color;
          case "parent": return (parentTitleMap.get(n.id) || "").toLowerCase();
          case "level": return levelMap.get(n.id) || 0;
          case "children": return childrenMap.get(n.id) || 0;
          case "order_index": return n.order_index;
          case "media": return Array.isArray(n.media_urls) ? n.media_urls.length : 0;
          case "created_at": return n.created_at;
          default: return 0;
        }
      };
      const av = get(a);
      const bv = get(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir, levelMap, childrenMap, parentTitleMap]);

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

  const visibleCols = useMemo(
    () => COLUMNS.filter((c) => visible[c.key] !== false),
    [visible],
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-card/80">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-lg font-semibold truncate">Árvore — Planilha</h2>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {sorted.length} {sorted.length === 1 ? "nó" : "nós"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-8 pl-7 w-44 text-xs"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <Settings2 className="h-3.5 w-3.5" /> Linhas
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Altura da linha</div>
              <div className="flex gap-1">
                {[
                  { label: "Compacta", v: 36 },
                  { label: "Normal", v: 48 },
                  { label: "Confortável", v: 64 },
                  { label: "Ampla", v: 84 },
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
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
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

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhum nó encontrado.</div>
        ) : (
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
                      c.align === "center" ? "text-center" : "text-left",
                    )}
                  >
                    <span className={cn("inline-flex items-center gap-1.5 truncate", c.align === "center" && "justify-center w-full")}>
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
              {sorted.map((n, idx) => {
                const level = levelMap.get(n.id) ?? 0;
                const children = childrenMap.get(n.id) ?? 0;
                const mediaCount = Array.isArray(n.media_urls) ? n.media_urls.length : 0;
                const parentTitle = n.parent_id ? parentTitleMap.get(n.id) || "—" : "— (raiz)";

                return (
                  <tr
                    key={n.id}
                    onClick={() => onNodeClick?.(n.id)}
                    style={{ height: rowHeight }}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                      "hover:bg-primary/5",
                    )}
                  >
                    {visible.index !== false && (
                      <td className="px-3 border-b border-border/40 align-middle text-center text-xs text-muted-foreground tabular-nums">
                        {idx + 1}
                      </td>
                    )}
                    {visible.title !== false && (
                      <td className="px-3 border-b border-border/40 align-middle">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", COLOR_STYLES[n.color])} />
                          <span className="font-medium truncate text-foreground group-hover:text-primary transition-colors">
                            {n.title || "Sem título"}
                          </span>
                        </div>
                      </td>
                    )}
                    {visible.color !== false && (
                      <td className="px-3 border-b border-border/40 align-middle">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-1 text-xs">
                          <span className={cn("h-1.5 w-1.5 rounded-full", COLOR_STYLES[n.color])} />
                          <span className="capitalize">{n.color}</span>
                        </span>
                      </td>
                    )}
                    {visible.parent !== false && (
                      <td className="px-3 border-b border-border/40 align-middle text-xs text-foreground/80 truncate">
                        {parentTitle}
                      </td>
                    )}
                    {visible.level !== false && (
                      <td className="px-3 border-b border-border/40 align-middle text-center">
                        <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tabular-nums">
                          {level}
                        </span>
                      </td>
                    )}
                    {visible.children !== false && (
                      <td className="px-3 border-b border-border/40 align-middle text-center text-xs tabular-nums">
                        {children > 0 ? children : <span className="text-muted-foreground/60">—</span>}
                      </td>
                    )}
                    {visible.order_index !== false && (
                      <td className="px-3 border-b border-border/40 align-middle text-center text-xs tabular-nums text-muted-foreground">
                        {n.order_index}
                      </td>
                    )}
                    {visible.media !== false && (
                      <td className="px-3 border-b border-border/40 align-middle text-center">
                        {mediaCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-foreground/80">
                            <ImageIcon className="h-3 w-3" /> {mediaCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                    )}
                    {visible.created_at !== false && (
                      <td className="px-3 border-b border-border/40 align-middle text-xs text-muted-foreground tabular-nums">
                        {new Date(n.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    )}
                    {visible.actions !== false && (
                      <td
                        className="px-2 border-b border-border/40 align-middle text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => onNodeClick?.(n.id)}
                          title="Centralizar no mapa"
                        >
                          <Crosshair className="h-3.5 w-3.5" /> Ir
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
