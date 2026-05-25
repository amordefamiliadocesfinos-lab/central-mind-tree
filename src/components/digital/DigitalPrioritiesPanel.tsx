import { useMemo, useState } from 'react';
import { AlertTriangle, Clock, CalendarX, ImageOff, Layers, Sparkles, ChevronDown, ChevronUp, Zap, CheckCircle2 } from 'lucide-react';
import { parseISO, differenceInCalendarDays } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DIGITAL_STATUS, type DigitalIdea, type DigitalVariation } from '@/hooks/useDigital';
import type { Platform } from '@/hooks/usePlatforms';

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface PriorityItem {
  id: string;
  ideaId: string;
  variationId?: string;
  ideaTitle: string;
  serial?: string | null;
  type: 'overdue' | 'in_progress_pending' | 'unscheduled' | 'no_media' | 'concluido_no_metric' | 'stuck_structural';
  severity: Severity;
  score: number;
  title: string;
  description: string;
  platformName?: string;
  icon: React.ComponentType<{ className?: string }>;
}
  score: number;
  title: string;
  description: string;
  platformName?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SEVERITY_STYLES: Record<Severity, { badge: string; bar: string; label: string }> = {
  critical: { badge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30', bar: 'border-l-red-500', label: 'Crítico' },
  high:     { badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30', bar: 'border-l-orange-500', label: 'Alto' },
  medium:   { badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-500 border-amber-500/30', bar: 'border-l-amber-500', label: 'Médio' },
  low:      { badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30', bar: 'border-l-blue-500', label: 'Baixo' },
};

interface Props {
  ideas: DigitalIdea[];
  platforms: Platform[];
  onSelectIdea: (id: string) => void;
}

export function DigitalPrioritiesPanel({ ideas, platforms, onSelectIdea }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<'all' | Severity>('all');

  const platformName = (id: string) => platforms.find(p => p.id === id)?.name || 'Plataforma';

  const items = useMemo<PriorityItem[]>(() => {
    const list: PriorityItem[] = [];
    const today = new Date();

    for (const idea of ideas) {
      if (idea.status === 'concluido') continue;
      const vars = idea.variations || [];

      // 1) Idea em andamento mas variações pendentes
      if (idea.status === 'andamento') {
        const pendentes = vars.filter(v => v.status === 'pendente' || v.status === 'estrutural');
        for (const v of pendentes) {
          list.push({
            id: `inprog-${v.id}`,
            ideaId: idea.id,
            ideaTitle: idea.title,
            serial: idea.serial_number,
            type: 'in_progress_pending',
            severity: 'high',
            score: 70,
            title: 'Ideia em andamento com plataforma pendente',
            description: `Avance a variação de ${platformName(v.platform as string)} para manter o ritmo da ideia.`,
            platformName: platformName(v.platform as string),
            icon: Layers,
          });
        }
      }

      // 2) Variações com data agendada vencida e não concluídas
      for (const v of vars) {
        if (v.status === 'concluido' || !v.scheduled_date) continue;
        try {
          const diff = differenceInCalendarDays(today, parseISO(v.scheduled_date));
          if (diff > 0) {
            list.push({
              id: `overdue-${v.id}`,
              ideaId: idea.id,
              ideaTitle: idea.title,
              serial: idea.serial_number,
              type: 'overdue',
              severity: diff >= 3 ? 'critical' : 'high',
              score: 100 + diff,
              title: `Atrasada há ${diff} dia${diff > 1 ? 's' : ''}`,
              description: `${platformName(v.platform as string)} estava agendada para ${formatBR(v.scheduled_date)}.`,
              platformName: platformName(v.platform as string),
              icon: AlertTriangle,
            });
          } else if (diff === 0) {
            list.push({
              id: `today-${v.id}`,
              ideaId: idea.id,
              ideaTitle: idea.title,
              serial: idea.serial_number,
              type: 'overdue',
              severity: 'high',
              score: 90,
              title: 'Publicação prevista para hoje',
              description: `${platformName(v.platform as string)} precisa ser finalizada hoje.`,
              platformName: platformName(v.platform as string),
              icon: Clock,
            });
          }
        } catch { /* ignore */ }
      }

      // 3) Variações sem agendamento (idea em andamento)
      if (idea.status === 'andamento') {
        const semData = vars.filter(v => v.status !== 'concluido' && !v.scheduled_date);
        if (semData.length > 0) {
          list.push({
            id: `unscheduled-${idea.id}`,
            ideaId: idea.id,
            ideaTitle: idea.title,
            serial: idea.serial_number,
            type: 'unscheduled',
            severity: 'medium',
            score: 40 + semData.length,
            title: `${semData.length} variação(ões) sem data`,
            description: `Defina o agendamento para organizar a publicação.`,
            icon: CalendarX,
          });
        }
      }

      // 4) Variações sem mídia
      const semMidia = vars.filter(v => v.status !== 'concluido' && (!v.media_urls || v.media_urls.length === 0));
      if (semMidia.length > 0 && idea.status !== 'estrutural') {
        list.push({
          id: `nomedia-${idea.id}`,
          ideaId: idea.id,
          ideaTitle: idea.title,
          serial: idea.serial_number,
          type: 'no_media',
          severity: 'medium',
          score: 35 + semMidia.length,
          title: `${semMidia.length} variação(ões) sem mídia`,
          description: `Adicione imagens ou vídeos para destravar a publicação.`,
          icon: ImageOff,
        });
      }

      // 5) Idea estrutural há tempo sem variações
      if (idea.status === 'estrutural' && vars.length === 0) {
        const ageDays = differenceInCalendarDays(today, parseISO(idea.created_at));
        if (ageDays >= 2) {
          list.push({
            id: `stuck-${idea.id}`,
            ideaId: idea.id,
            ideaTitle: idea.title,
            serial: idea.serial_number,
            type: 'stuck_structural',
            severity: ageDays >= 7 ? 'high' : 'low',
            score: 20 + ageDays,
            title: 'Ideia parada na estrutura',
            description: `Criada há ${ageDays} dias sem nenhuma variação de plataforma.`,
            icon: Sparkles,
          });
        }
      }

      // 6) Variação concluída sem métrica registrada
      const concluidasSemMetrica = vars.filter(v =>
        v.status === 'concluido' &&
        !v.metric_reach && !v.metric_engagement && !v.metric_clicks
      );
      if (concluidasSemMetrica.length > 0) {
        list.push({
          id: `metrics-${idea.id}`,
          ideaId: idea.id,
          ideaTitle: idea.title,
          serial: idea.serial_number,
          type: 'concluido_no_metric',
          severity: 'low',
          score: 10 + concluidasSemMetrica.length,
          title: `${concluidasSemMetrica.length} publicação(ões) sem métricas`,
          description: `Registre alcance/engajamento para medir o ROI.`,
          icon: CheckCircle2,
        });
      }
    }

    return list.sort((a, b) => b.score - a.score);
  }, [ideas, platforms]);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    items.forEach(i => { c[i.severity] += 1; });
    return c;
  }, [items]);

  const filtered = filter === 'all' ? items : items.filter(i => i.severity === filter);
  const visible = expanded ? filtered : filtered.slice(0, 4);

  if (items.length === 0) {
    return (
      <div className="px-4 pb-2">
        <Card className="flex items-center gap-3 p-3 border-l-4 border-l-emerald-500 bg-emerald-500/5">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Tudo em dia!</p>
            <p className="text-xs text-muted-foreground">Nenhuma prioridade detectada nas ideias ativas.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 pb-2">
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight">Prioridades automáticas</h3>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {items.length} ação(ões) sugerida(s) para hoje
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {(['critical', 'high', 'medium', 'low'] as Severity[]).map(s => (
              counts[s] > 0 && (
                <button
                  key={s}
                  onClick={() => setFilter(filter === s ? 'all' : s)}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full border font-medium transition-all',
                    SEVERITY_STYLES[s].badge,
                    filter === s && 'ring-2 ring-offset-1 ring-offset-background ring-current'
                  )}
                >
                  {SEVERITY_STYLES[s].label} · {counts[s]}
                </button>
              )
            ))}
          </div>
        </div>

        {/* Items */}
        <ul className="divide-y">
          {visible.map(item => {
            const Icon = item.icon;
            const sev = SEVERITY_STYLES[item.severity];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectIdea(item.ideaId)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 text-left border-l-4 transition-colors',
                    'hover:bg-muted/40 active:bg-muted/60 touch-manipulation',
                    sev.bar
                  )}
                >
                  <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', {
                    'text-red-500': item.severity === 'critical',
                    'text-orange-500': item.severity === 'high',
                    'text-amber-500': item.severity === 'medium',
                    'text-blue-500': item.severity === 'low',
                  })} />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-semibold leading-tight">{item.title}</span>
                      {item.platformName && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                          {item.platformName}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{item.description}</p>
                    <p className="text-[10px] text-muted-foreground/80 truncate">
                      {item.serial && <span className="font-mono text-primary mr-1">#{item.serial}</span>}
                      {item.ideaTitle}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('text-[10px] shrink-0 self-center', sev.badge)}>
                    {sev.label}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer */}
        {filtered.length > 4 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 border-t transition-colors"
          >
            {expanded ? (
              <>Mostrar menos <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>Ver mais {filtered.length - 4} <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </button>
        )}
      </Card>
    </div>
  );
}

function formatBR(iso: string) {
  try {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}
