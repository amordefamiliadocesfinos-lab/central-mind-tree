import { useMemo, useState } from 'react';
import { DigitalIdea, DIGITAL_STATUS } from '@/hooks/useDigital';
import type { Platform } from '@/hooks/usePlatforms';
import { formatDisplayDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown, Image as ImageIcon, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  ideas: DigitalIdea[];
  platforms: Platform[];
  onSelectIdea: (id: string) => void;
}

type SortKey = 'serial' | 'title' | 'status' | 'type' | 'variations' | 'created' | 'updated';
type SortDir = 'asc' | 'desc';

export function IdeasSpreadsheetView({ ideas, platforms, onSelectIdea }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('serial');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const platformsMap = useMemo(
    () => new Map(platforms.map((p) => [p.id, p])),
    [platforms]
  );

  const sorted = useMemo(() => {
    const arr = [...ideas];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const getVal = (i: DigitalIdea) => {
        switch (sortKey) {
          case 'serial':
            return parseInt(i.serial_number || '0', 10) || 0;
          case 'title':
            return (i.title || '').toLowerCase();
          case 'status':
            return DIGITAL_STATUS[i.status]?.priority ?? 99;
          case 'type':
            return i.idea_type || '';
          case 'variations':
            return i.variations?.length || 0;
          case 'created':
            return i.created_at || '';
          case 'updated':
            return i.updated_at || '';
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

  const HeaderCell = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <th
      onClick={() => toggleSort(k)}
      className={cn(
        'sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors border-b border-border/60',
        className
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        <SortIcon k={k} />
      </span>
    </th>
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
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <HeaderCell k="serial" label="#" className="w-20" />
              <HeaderCell k="title" label="Título" />
              <HeaderCell k="status" label="Status" className="w-36" />
              <HeaderCell k="type" label="Tipo" className="w-32" />
              <th className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 w-44">
                Plataformas
              </th>
              <HeaderCell k="variations" label="Variações" className="w-24" />
              <th className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 w-20">
                Mídia
              </th>
              <HeaderCell k="updated" label="Atualizado" className="w-32" />
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
              const mediaCount = (idea.media_urls?.length || 0) +
                (idea.variations || []).reduce((acc, v) => acc + (v.media_urls?.length || 0), 0);

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
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                      {idea.serial_number || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-foreground truncate max-w-md group-hover:text-primary transition-colors">
                        {idea.title || 'Sem título'}
                      </span>
                      {idea.objective && (
                        <span className="text-xs text-muted-foreground truncate max-w-md">
                          {idea.objective}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-1 text-xs font-medium">
                      <span className={cn('w-1.5 h-1.5 rounded-full', status?.color || 'bg-muted-foreground')} />
                      {status?.label || idea.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <Badge variant="outline" className="text-xs font-normal capitalize">
                      {idea.idea_type}
                    </Badge>
                  </td>
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
                            className="h-6 w-6 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-xs overflow-hidden"
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
                        <div className="h-6 w-6 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                          +{ideaPlatformIds.length - 5}
                        </div>
                      )}
                      {ideaPlatformIds.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs tabular-nums font-medium">
                        {doneCount}/{variationCount}
                      </span>
                      {variationCount > 0 && (
                        <div className="w-10 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{mediaCount}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 border-b border-border/40 align-middle">
                    <span className="text-xs text-muted-foreground tabular-nums">
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
        <span>{sorted.length} {sorted.length === 1 ? 'ideia' : 'ideias'}</span>
        <span className="hidden sm:inline">Clique nas colunas para ordenar · Clique na linha para abrir</span>
      </div>
    </div>
  );
}
