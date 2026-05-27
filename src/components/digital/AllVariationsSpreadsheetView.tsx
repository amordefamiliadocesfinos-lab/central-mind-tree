import { useEffect, useMemo, useRef, useState } from 'react';
import { DigitalIdea, DigitalVariation, DIGITAL_STATUS } from '@/hooks/useDigital';
import type { Platform } from '@/hooks/usePlatforms';
import { formatDisplayDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Film,
  Calendar,
  CheckSquare,
  Link2,
  Hash,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PlatformIcon } from './PlatformsManager';

interface Row {
  idea: DigitalIdea;
  variation: DigitalVariation;
}

interface Props {
  ideas: DigitalIdea[];
  platforms: Platform[];
  onSelectIdea: (ideaId: string) => void;
}

type SortKey =
  | 'serial'
  | 'cover'
  | 'idea'
  | 'platform'
  | 'title'
  | 'status'
  | 'scheduled'
  | 'checklist'
  | 'media'
  | 'aspect'
  | 'link'
  | 'hashtags'
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
  { key: 'idea', label: 'Ideia', default: 220, min: 140 },
  { key: 'platform', label: 'Plataforma', default: 170, min: 120 },
  { key: 'title', label: 'Variação', default: 240, min: 140 },
  { key: 'status', label: 'Status', default: 140, min: 110 },
  { key: 'scheduled', label: 'Agendamento', default: 150, min: 120 },
  { key: 'checklist', label: 'Checklist', default: 150, min: 120 },
  { key: 'media', label: 'Mídia', default: 90, min: 70 },
  { key: 'aspect', label: 'Formato', default: 110, min: 90 },
  { key: 'link', label: 'Link', sortable: false, default: 80, min: 60, align: 'center' },
  { key: 'hashtags', label: 'Hashtags', default: 220, min: 140 },
  { key: 'updated', label: 'Atualizado', default: 130, min: 100 },
];

const STORAGE_KEY = 'digital:all-variations-spreadsheet:widths:v1';

export function AllVariationsSpreadsheetView({ ideas, platforms, onSelectIdea }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('scheduled');
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

  const rows: Row[] = useMemo(() => {
    const r: Row[] = [];
    for (const idea of ideas) {
      for (const v of idea.variations || []) {
        r.push({ idea, variation: v });
      }
    }
    return r;
  }, [ideas]);

  const getCover = (idea: DigitalIdea, v: DigitalVariation): string | null => {
    if (v.cover_url) return v.cover_url;
    if (v.thumbnail_url) return v.thumbnail_url;
    if (v.media_urls?.[0]) return v.media_urls[0];
    if (idea.media_urls?.[0]) return idea.media_urls[0];
    return null;
  };

  const sorted = useMemo(() => {
    const arr = [...rows];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const getVal = ({ idea, variation: v }: Row): string | number => {
        switch (sortKey) {
          case 'serial':
            return parseInt(idea.serial_number || '0', 10) || 0;
          case 'idea':
            return (idea.title || '').toLowerCase();
          case 'platform':
            return platformsMap.get(v.platform as string)?.name?.toLowerCase() || '';
          case 'title':
            return (v.title || '').toLowerCase();
          case 'status':
            return DIGITAL_STATUS[v.status]?.priority ?? 99;
          case 'scheduled':
            return v.scheduled_date || '';
          case 'checklist': {
            const total = v.checklist?.length || 0;
            if (!total) return -1;
            const done = v.checklist!.filter((c) => c.done).length;
            return done / total;
          }
          case 'media':
            return v.media_urls?.length || 0;
          case 'aspect':
            return v.aspect_ratio || '';
          case 'hashtags':
            return (v.hashtags || '').toLowerCase();
          case 'updated':
            return v.updated_at || '';
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
  }, [rows, sortKey, sortDir, platformsMap]);

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

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-12 text-center text-sm text-muted-foreground">
        Nenhuma variação para exibir.
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
            {sorted.map(({ idea, variation }, idx) => {
              const status = DIGITAL_STATUS[variation.status];
              const platform = platformsMap.get(variation.platform as string);
              const cover = getCover(idea, variation);
              const isVideo = cover ? /\.(mp4|webm|mov|m4v)(\?|$)/i.test(cover) : false;
              const total = variation.checklist?.length || 0;
              const done = variation.checklist?.filter((c) => c.done).length || 0;
              const progress = total > 0 ? Math.round((done / total) * 100) : 0;
              const mediaCount = variation.media_urls?.length || 0;
              const cfv = variation.custom_field_values as Record<string, string> | undefined;
              const displayTitle =
                variation.title?.trim() ||
                (cfv && platform?.custom_fields?.length
                  ? (() => {
                      for (const f of platform.custom_fields) {
                        const val = cfv[f.id];
                        if (val && String(val).trim()) return String(val).trim();
                      }
                      return null;
                    })()
                  : null);

              return (
                <tr
                  key={`${idea.id}-${variation.id}`}
                  onDoubleClick={() => onSelectIdea(idea.id)}
                  title="Clique duplo para abrir"
                  className={cn(
                    'group transition-colors',
                    idx % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                    'hover:bg-primary/5'
                  )}
                >
                  {/* Cover */}
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
                            alt={displayTitle || idea.title || 'capa'}
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

                  {/* Idea title */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <span className="font-medium text-foreground/90 truncate block group-hover:text-primary transition-colors">
                      {idea.title || 'Sem título'}
                    </span>
                  </td>

                  {/* Platform */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <span className="inline-flex items-center gap-2 max-w-full">
                      {platform ? (
                        <>
                          <PlatformIcon icon={platform.icon} size="sm" />
                          <span className="font-medium text-foreground/90 truncate">{platform.name}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </span>
                  </td>

                  {/* Variation title */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    {displayTitle ? (
                      <span className="text-sm text-foreground truncate block">{displayTitle}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">Sem título</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-1 text-xs font-medium max-w-full truncate">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', status?.color || 'bg-muted-foreground')} />
                      <span className="truncate">{status?.label || variation.status}</span>
                    </span>
                  </td>

                  {/* Scheduled */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    {variation.scheduled_date ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80 tabular-nums">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {formatDisplayDate(variation.scheduled_date)}
                          {variation.scheduled_time ? ` · ${variation.scheduled_time.slice(0, 5)}` : ''}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">—</span>
                    )}
                  </td>

                  {/* Checklist */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    {total > 0 ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs tabular-nums font-medium shrink-0">
                          {done}/{total}
                        </span>
                        <div className="flex-1 min-w-[24px] h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">—</span>
                    )}
                  </td>

                  {/* Media */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{mediaCount}</span>
                    </div>
                  </td>

                  {/* Aspect */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    {variation.aspect_ratio ? (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {variation.aspect_ratio}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">—</span>
                    )}
                  </td>

                  {/* Link */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle text-center">
                    {variation.link ? (
                      <a
                        href={variation.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={variation.link}
                        className="inline-flex items-center justify-center text-primary hover:text-primary/80"
                      >
                        <Link2 className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">—</span>
                    )}
                  </td>

                  {/* Hashtags */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    {variation.hashtags ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80 truncate max-w-full">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{variation.hashtags}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">—</span>
                    )}
                  </td>

                  {/* Updated */}
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <span className="text-xs text-muted-foreground tabular-nums truncate block">
                      {formatDisplayDate(variation.updated_at)}
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
          {sorted.length} {sorted.length === 1 ? 'variação' : 'variações'}
        </span>
        <span className="hidden sm:inline">
          Clique nas colunas para ordenar · Arraste a borda direita para redimensionar · Clique duplo na linha para abrir
        </span>
      </div>
    </div>
  );
}
