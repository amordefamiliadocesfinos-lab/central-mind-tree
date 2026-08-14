import { useState, type ReactNode } from 'react';
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
import type { Contact } from '@/hooks/useContacts';
import type { AttentionCounts, AttentionKey } from '@/lib/crm/attentionFilters';

export type AutomationChipKey = Exclude<AttentionKey, 'all'>;

interface CrmAutomationHubProps {
  /** Chip ativo — filtro único que rege lista, kanban e painel de leads */
  attentionFilter: AttentionKey;
  setAttentionFilter: (v: AttentionKey) => void;
  counts: AttentionCounts;
  /** Total de registros visíveis após todos os filtros */
  resultCount: number;
  /** Fila priorizada já filtrada */
  queue: Contact[];
  onClearAllFilters: () => void;
  activeFilterCount: number;
  onStartQueue?: (queue: Contact[]) => void;
  filtersSlot: ReactNode;
  leadsPanelSlot: ReactNode;
}

interface ChipDef {
  key: AutomationChipKey;
  label: string;
  Icon: typeof Flame;
  tone: string;
  toneActive: string;
}

const CHIP_DEFS: ChipDef[] = [
  {
    key: 'urgentes',
    label: 'Urgentes',
    Icon: Flame,
    tone: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
    toneActive: 'bg-red-600 text-white border-red-600 hover:bg-red-700',
  },
  {
    key: 'follow_up',
    label: 'Follow-up',
    Icon: AlertTriangle,
    tone: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    toneActive: 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700',
  },
  {
    key: 'hoje',
    label: 'Hoje',
    Icon: CalendarClock,
    tone: 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    toneActive: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
  },
  {
    key: 'esfriando',
    label: 'Esfriando',
    Icon: Snowflake,
    tone: 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800',
    toneActive: 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700',
  },
];

const CHIP_LABEL: Record<AutomationChipKey, string> = {
  urgentes: 'Urgentes',
  follow_up: 'Follow-up',
  hoje: 'Hoje',
  esfriando: 'Esfriando',
};

export function CrmAutomationHub({
  attentionFilter,
  setAttentionFilter,
  counts,
  resultCount,
  queue,
  onClearAllFilters,
  activeFilterCount,
  onStartQueue,
  filtersSlot,
  leadsPanelSlot,
}: CrmAutomationHubProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Um mesmo lead pode ser urgente, estar em follow-up e vencer hoje.
  // A fila já contém contatos únicos; use-a para não inflar o total exibido.
  const totalAttention = queue.length;

  const applyChip = (key: AutomationChipKey) => {
    setAttentionFilter(attentionFilter === key ? 'all' : key);
  };

  // FRENTE 7A — a fila operacional vive na Caixa de Entrada.
  // Aqui ficam apenas os filtros de gestão; chips/fila/painel em lote foram ocultados
  // (a lógica permanece disponível via props para compatibilidade).
  void applyChip; void CHIP_DEFS; void CHIP_LABEL; void counts; void queue; void onStartQueue; void leadsPanelSlot;

  return (
    <Card className="p-2 border-border/60 bg-gradient-to-br from-primary/5 via-background to-background">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">Gestão de Contatos</h3>
        </div>
        {totalAttention > 0 && (
          <Badge variant="secondary" className="text-[10px] h-5">
            {totalAttention} exigem atenção
          </Badge>
        )}
        <Button asChild variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1">
          <a href="/contatos/inbox">
            <PlayCircle className="h-3.5 w-3.5" />
            Operar na Caixa de Entrada
          </a>
        </Button>
        {(activeFilterCount > 0 || attentionFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 ml-auto text-muted-foreground"
            onClick={onClearAllFilters}
          >
            <X className="h-3 w-3" />
            Limpar filtros
          </Button>
        )}
      </div>

      {attentionFilter !== 'all' && (
        <p className="mb-1 text-[10px] text-muted-foreground">
          Mostrando <span className="font-semibold text-foreground">{resultCount}</span> registro{resultCount === 1 ? '' : 's'} filtrado{resultCount === 1 ? '' : 's'}.
        </p>
      )}

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="flex items-center gap-1.5">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] gap-1">
              <SlidersHorizontal className="h-3 w-3" />
              {filtersOpen ? 'Ocultar filtros' : 'Filtros'}
              {filtersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          {activeFilterCount > 0 && !filtersOpen && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {activeFilterCount} ativo{activeFilterCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <CollapsibleContent className="pt-1.5">
          {filtersSlot}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
