import { useEffect, useMemo, useRef, useState } from 'react';
import { DigitalIdea, DIGITAL_STATUS } from '@/hooks/useDigital';
import type { Platform } from '@/hooks/usePlatforms';
import { formatDisplayDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Layers,
  Target,
  Users,
  MessageSquare,
  TrendingUp,
  Film,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  ideas: DigitalIdea[];
  platforms: Platform[];
  onSelectIdea: (id: string) => void;
}

type SortKey =
  | 'serial'
  | 'cover'
  | 'title'
  | 'status'
  | 'type'
  | 'objective'
  | 'audience'
  | 'message'
  | 'kpi'
  | 'platforms'
  | 'variations'
  | 'media'
  | 'created'
  | 'updated';
type SortDir = 'asc' | 'desc';

interface ColDef {
  key: SortKey;
  label: string;
  sortable?: boolean;
  default: number;
  min: number;
  align?: 'left' | 'center';
}

const COLUMNS: ColDef[] = [
  { key: 'cover', label: 'Capa', sortable: false, default: 72, min: 56, align: 'center' },
  { key: 'serial', label: '#', default: 80, min: 60 },
  { key: 'title', label: 'Título', default: 280, min: 160 },
  { key: 'status', label: 'Status', default: 150, min: 110 },
  { key: 'type', label: 'Tipo', default: 130, min: 100 },
  { key: 'objective', label: 'Objetivo', default: 200, min: 120 },
  { key: 'audience', label: 'Público', default: 180, min: 120 },
  { key: 'message', label: 'Mensagem-chave', default: 220, min: 140 },
  { key: 'kpi', label: 'KPI', default: 140, min: 100 },
  { key: 'platforms', label: 'Plataformas', sortable: false, default: 180, min: 120 },
  { key: 'variations', label: 'Variações', default: 140, min: 110 },
  { key: 'media', label: 'Mídia', default: 90, min: 70 },
  { key: 'created', label: 'Criado', default: 120, min: 100 },
  { key: 'updated', label: 'Atualizado', default: 130, min: 100 },
];

const STORAGE_KEY = 'digital:spreadsheet:widths:v1';

export function IdeasSpreadsheetView({ ideas, platforms, onSelectIdea }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('serial');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return Object.fromEntries(COLUMNS.map((c) => [c.key, c.default]));
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch {}
  }, [widths]);

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

  const platformsMap = useMemo(
    () => new Map(platforms.map((p) => [p.id, p])),
    [platforms]
  );

  const getCover = (idea: DigitalIdea): string | null => {
    if (idea.media_urls?.[0]) return idea.media_urls[0];
    for (const v of idea.variations || []) {
      if (v.cover_url) return v.cover_url;
      if (v.thumbnail_url) return v.thumbnail_url;
      if (v.media_urls?.[0]) return v.media_urls[0];
    }
    return null;
  };

  const sorted = useMemo(() => {
    const arr = [...ideas];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const getVal = (i: DigitalIdea): string | number => {
        switch (sortKey) {
          case 'serial':
            return parseInt(i.serial_number || '0', 10) || 0;
          case 'title':
            return (i.title || '').toLowerCase();
          case 'status':
            return DIGITAL_STATUS[i.status]?.priority ?? 99;
          case 'type':
            return i.idea_type || '';
          case 'objective':
            return (i.objective || '').toLowerCase();
          case 'audience':
            return (i.target_audience || '').toLowerCase();
          case 'message':
            return (i.key_message || '').toLowerCase();
          case 'kpi':
            return (i.kpi || '').toLowerCase();
          case 'variations':
            return i.variations?.length || 0;
          case 'media':
            return (
              (i.media_urls?.length || 0) +
              (i.variations || []).reduce((acc, v) => acc + (v.media_urls?.length || 0), 0)
            );
          case 'created':
            return i.created_at || '';
          case 'updated':
            return i.updated_at || '';
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
  }, [ideas, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    const col = COLUMNS.find((c) => c.key === k);
    if (col?.sortable === false) return;
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    ) : sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary" />
    );

  if (ideas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-12 text-center text-sm text-muted-foreground">
        Nenhuma ideia para exibir.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-auto max-h-[calc(100vh-22rem)]">
        <table
          className="text-sm border-separate border-spacing-0"
          style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}
        >
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: `${widths[c.key] ?? c.default}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={cn(
                    'group relative sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground select-none border-b border-border/60',
                    c.sortable === false ? 'cursor-default' : 'cursor-pointer hover:text-foreground transition-colors',
                    c.align === 'center' ? 'text-center' : 'text-left'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 truncate',
                      c.align === 'center' && 'justify-center w-full'
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
            {sorted.map((idea, idx) => {
              const status = DIGITAL_STATUS[idea.status];
              const ideaPlatformIds = Array.from(
                new Set((idea.variations || []).map((v) => v.platform).filter(Boolean))
              );
              const variationCount = idea.variations?.length || 0;
              const doneCount = (idea.variations || []).filter((v) => v.status === 'concluido').length;
              const progress = variationCount > 0 ? Math.round((doneCount / variationCount) * 100) : 0;
              const mediaCount =
                (idea.media_urls?.length || 0) +
                (idea.variations || []).reduce((acc, v) => acc + (v.media_urls?.length || 0), 0);
              const cover = getCover(idea);
              const isVideo = cover ? /\.(mp4|webm|mov|m4v)(\?|$)/i.test(cover) : false;

              return (
                <tr
                  key={idea.id}
                  onClick={() => onSelectIdea(idea.id)}
                  className={cn(
                    'group cursor-pointer transition-colors',
                    idx % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                    'hover:bg-primary/5'
                  )}
                >
                  {/* Capa */}
                  <td className="px-2 py-2 border-b border-border/40 align-middle">
                    <div className="mx-auto h-12 w-12 rounded-md overflow-hidden bg-muted ring-1 ring-border/60 flex items-center justify-center">
                      {cover ? (
                        isVideo ? (
                          <div className="relative h-full w-full bg-black/80 flex items-center justify-center">
                            <Film className="h-4 w-4 text-white/80" />
                          </div>
                        ) : (
                          <img
                            src={cover}
                            alt={idea.title || 'capa'}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        )
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
                      )}
                    </div>
                  </td>

                  {/* Serial */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                      {idea.serial_number || '—'}
                    </span>
                  </td>

                  {/* Title */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <span className="font-medium text-foreground truncate block group-hover:text-primary transition-colors">
                      {idea.title || 'Sem título'}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-1 text-xs font-medium max-w-full truncate">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', status?.color || 'bg-muted-foreground')} />
                      <span className="truncate">{status?.label || idea.status}</span>
                    </span>
                  </td>

                  {/* Type */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <Badge variant="outline" className="text-xs font-normal capitalize truncate max-w-full">
                      {idea.idea_type}
                    </Badge>
                  </td>

                  {/* Objective */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    {idea.objective ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80 truncate max-w-full">
                        <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{idea.objective}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">—</span>
                    )}
                  </td>

                  {/* Audience */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    {idea.target_audience ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80 truncate max-w-full">
                        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{idea.target_audience}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">—</span>
                    )}
                  </td>

                  {/* Key Message */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    {idea.key_message ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80 truncate max-w-full">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{idea.key_message}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">—</span>
                    )}
                  </td>

                  {/* KPI */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    {idea.kpi ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80 truncate max-w-full">
                        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{idea.kpi}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">—</span>
                    )}
                  </td>

                  {/* Platforms */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <div className="flex items-center -space-x-1.5">
                      {ideaPlatformIds.slice(0, 5).map((pid) => {
                        const p = platformsMap.get(pid as string);
                        if (!p) return null;
                        const isUrl = typeof p.icon === 'string' && /^https?:\/\//.test(p.icon);
                        return (
                          <div
                            key={pid}
                            title={p.name}
                            className="h-6 w-6 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-xs overflow-hidden shrink-0"
                          >
                            {isUrl ? (
                              <img src={p.icon} alt={p.name} className="h-full w-full object-cover" />
                            ) : (
                              <span>{p.icon || '·'}</span>
                            )}
                          </div>
                        );
                      })}
                      {ideaPlatformIds.length > 5 && (
                        <div className="h-6 w-6 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground shrink-0">
                          +{ideaPlatformIds.length - 5}
                        </div>
                      )}
                      {ideaPlatformIds.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </div>
                  </td>

                  {/* Variations */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs tabular-nums font-medium shrink-0">
                        {doneCount}/{variationCount}
                      </span>
                      {variationCount > 0 && (
                        <div className="flex-1 min-w-[24px] h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Media count */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{mediaCount}</span>
                    </div>
                  </td>

                  {/* Created */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <span className="text-xs text-muted-foreground tabular-nums truncate block">
                      {formatDisplayDate(idea.created_at)}
                    </span>
                  </td>

                  {/* Updated */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <span className="text-xs text-muted-foreground tabular-nums truncate block">
                      {formatDisplayDate(idea.updated_at)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>
          {sorted.length} {sorted.length === 1 ? 'ideia' : 'ideias'}
        </span>
        <span className="hidden sm:inline">
          Clique nas colunas para ordenar · Arraste a borda direita para redimensionar · Clique na linha para abrir
        </span>
      </div>
    </div>
  );
}
