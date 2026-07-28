import { useMemo, useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Zap,
  Flame,
  AlertTriangle,
  Snowflake,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  PlayCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, isSameDay, isBefore, startOfDay } from 'date-fns';
import type { Contact } from '@/hooks/useContacts';
import type { NoResponseInfo } from '@/hooks/useNoResponseDetection';

export type AutomationChipKey =
  | 'urgentes'
  | 'follow_up'
  | 'hoje'
  | 'esfriando';

const EXCLUDED_STAGES = ['fechado', 'perdido'];

interface CrmAutomationHubProps {
  contacts: Contact[];
  getUrgencyLevel: (c: Contact) => string;
  getNoResponseInfo: (id: string) => NoResponseInfo | null;
  // Filter state from parent (source of truth stays there)
  tempFilter: string;
  setTempFilter: (v: string) => void;
  actionFilter: string;
  setActionFilter: (v: string) => void;
  contactDateFilter: string;
  setContactDateFilter: (v: string) => void;
  onClearAllFilters: () => void;
  activeFilterCount: number;
  /** Inicia o Modo Fila com a lista de leads que exigem atenção (ordenada) */
  onStartQueue?: (queue: Contact[]) => void;
  // Slots
  filtersSlot: ReactNode;
  leadsPanelSlot: ReactNode;
}

interface ChipDef {
  key: AutomationChipKey;
  label: string;
  emoji: string;
  Icon: typeof Flame;
  tone: string;
  toneActive: string;
}

const CHIP_DEFS: ChipDef[] = [
  {
    key: 'urgentes',
    label: 'Urgentes',
    emoji: '🔴',
    Icon: Flame,
    tone: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
    toneActive: 'bg-red-600 text-white border-red-600 hover:bg-red-700',
  },
  {
    key: 'follow_up',
    label: 'Follow-up',
    emoji: '⚠',
    Icon: AlertTriangle,
    tone: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    toneActive: 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700',
  },
  {
    key: 'hoje',
    label: 'Hoje',
    emoji: '📅',
    Icon: CalendarClock,
    tone: 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    toneActive: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
  },
  {
    key: 'esfriando',
    label: 'Esfriando',
    emoji: '❄',
    Icon: Snowflake,
    tone: 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800',
    toneActive: 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700',
  },
];

export function CrmAutomationHub({
  contacts,
  getUrgencyLevel,
  getNoResponseInfo,
  tempFilter,
  setTempFilter,
  actionFilter,
  setActionFilter,
  contactDateFilter,
  setContactDateFilter,
  onClearAllFilters,
  activeFilterCount,
  onStartQueue,
  filtersSlot,
  leadsPanelSlot,
}: CrmAutomationHubProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dismissedGuide, setDismissedGuide] = useState(false);

  const { counts, queue } = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    let urgentes = 0;
    let followUp = 0;
    let hoje = 0;
    let esfriando = 0;
    const scored: Array<{ c: Contact; score: number }> = [];

    for (const c of contacts) {
      if (!c.is_active) continue;
      if (EXCLUDED_STAGES.includes(c.funnel_status)) continue;

      let score = 0;

      // Urgentes: alta urgência calculada
      const isUrgent = getUrgencyLevel(c) === 'urgente';
      if (isUrgent) { urgentes++; score += 100; }

      // Follow-up: sem resposta detectado
      const nr = getNoResponseInfo(c.id);
      if (nr) { followUp++; score += 50; }

      // Hoje: próximo contato/ação hoje ou vencido
      const hasTodayContact = c.next_contact_date && (() => {
        try {
          const d = parseISO(c.next_contact_date);
          return isSameDay(d, now) || isBefore(startOfDay(d), today);
        } catch { return false; }
      })();
      const hasTodayAction = c.next_action_date && (() => {
        try {
          const d = parseISO(c.next_action_date);
          return isSameDay(d, now) || isBefore(startOfDay(d), today);
        } catch { return false; }
      })();
      if (hasTodayContact || hasTodayAction) { hoje++; score += 70; }

      // Esfriando: >= 10 dias sem contato ou nunca contatado + lead
      if (!c.ultimo_contato) {
        if (c.type === 'lead' || c.contact_type === 'orcamento') { esfriando++; score += 30; }
      } else {
        try {
          const d = differenceInDays(now, parseISO(c.ultimo_contato));
          if (d >= 10) { esfriando++; score += 20 + Math.min(d, 60) / 10; }
        } catch { /* noop */ }
      }

      if (score > 0) scored.push({ c, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return {
      counts: { urgentes, followUp, hoje, esfriando },
      queue: scored.map(s => s.c),
    };
  }, [contacts, getUrgencyLevel, getNoResponseInfo]);

  const chipCounts: Record<AutomationChipKey, number> = {
    urgentes: counts.urgentes,
    follow_up: counts.followUp,
    hoje: counts.hoje,
    esfriando: counts.esfriando,
  };

  // Derive which chip is active from current filter state
  const activeChip: AutomationChipKey | null = useMemo(() => {
    if (tempFilter === 'quente' && actionFilter === 'all' && contactDateFilter === 'all') return 'urgentes';
    if (contactDateFilter === 'hoje_contato' && actionFilter === 'all') return 'hoje';
    if (actionFilter === 'atrasados') return 'follow_up';
    return null;
  }, [tempFilter, actionFilter, contactDateFilter]);

  const applyChip = (key: AutomationChipKey) => {
    // Toggle off if already active
    if (activeChip === key) {
      setTempFilter('all');
      setActionFilter('all');
      setContactDateFilter('all');
      return;
    }
    // Reset the chip-controlled filters first
    setTempFilter('all');
    setActionFilter('all');
    setContactDateFilter('all');
    switch (key) {
      case 'urgentes':
        setTempFilter('quente');
        break;
      case 'follow_up':
        setActionFilter('atrasados');
        setFiltersOpen(true); // reveals list refinement
        break;
      case 'hoje':
        setContactDateFilter('hoje_contato');
        break;
      case 'esfriando':
        // Handled purely by scroll to the leads panel below (no equivalent filter today)
        document.getElementById('crm-leads-need-contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
    }
    setDismissedGuide(true);
  };

  const totalAttention = counts.urgentes + counts.followUp + counts.hoje + counts.esfriando;

  return (
    <Card className="p-3 border-border/60 bg-gradient-to-br from-primary/5 via-background to-background">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">Centro de Automação do CRM</h3>
        </div>
        {totalAttention > 0 && (
          <Badge variant="secondary" className="text-[10px] h-5">
            {totalAttention} exigem atenção
          </Badge>
        )}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 ml-auto text-muted-foreground"
            onClick={onClearAllFilters}
          >
            <X className="h-3 w-3" />
            Limpar filtros ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Guide */}
      {!dismissedGuide && activeChip === null && activeFilterCount === 0 && (
        <p className="text-[11px] text-muted-foreground mb-2">
          <span className="font-semibold text-foreground">1.</span> Veja o que precisa de atenção
          <span className="mx-1.5 opacity-40">→</span>
          <span className="font-semibold text-foreground">2.</span> Refine se quiser
          <span className="mx-1.5 opacity-40">→</span>
          <span className="font-semibold text-foreground">3.</span> Aja em lote
        </p>
      )}

      {/* PASSO 1 — Diagnóstico */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 mr-1">
          Passo 1
        </span>
        {CHIP_DEFS.map((chip) => {
          const isActive = activeChip === chip.key;
          const count = chipCounts[chip.key];
          const Icon = chip.Icon;
          return (
            <Button
              key={chip.key}
              variant="outline"
              size="sm"
              onClick={() => applyChip(chip.key)}
              className={cn(
                'h-8 shrink-0 gap-1.5 text-xs font-semibold border transition-all',
                isActive ? chip.toneActive : chip.tone,
                count === 0 && !isActive && 'opacity-50',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {chip.label}
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1',
                  isActive ? 'bg-white/25 text-white' : 'bg-background/70',
                )}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Modo Fila — tratar um lead por vez */}
      {onStartQueue && queue.length > 0 && (
        <Button
          size="sm"
          className="mt-2 w-full h-9 gap-2 text-xs font-semibold"
          onClick={() => onStartQueue(queue)}
        >
          <PlayCircle className="h-4 w-4" />
          Começar — tratar {queue.length} lead{queue.length > 1 ? 's' : ''} um por vez
        </Button>
      )}

      {/* PASSO 2 — Refinar (collapsible) */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="mt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
            Passo 2
          </span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] gap-1">
              <SlidersHorizontal className="h-3 w-3" />
              {filtersOpen ? 'Ocultar filtros avançados' : 'Refinar (filtros avançados)'}
              {filtersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          {activeFilterCount > 0 && !filtersOpen && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {activeFilterCount} ativo{activeFilterCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <CollapsibleContent className="pt-2">
          {filtersSlot}
        </CollapsibleContent>
      </Collapsible>

      {/* PASSO 3 — Agir */}
      {counts.esfriando > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50" id="crm-leads-need-contact">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Passo 3 — Aja em lote
            </span>
          </div>
          {leadsPanelSlot}
        </div>
      )}
    </Card>
  );
}
