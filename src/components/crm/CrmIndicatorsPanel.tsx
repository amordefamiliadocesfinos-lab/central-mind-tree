import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Users, Handshake, FileText, CheckCircle2, Percent, Receipt, TrendingUp,
  Radio, ChevronDown, ChevronUp, UserCheck,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';
import type { DailyMetrics } from '@/hooks/useDailyMetrics';

interface CrmMetrics {
  novosLeads: number;
  emNegociacao: number;
  orcamentos: number;
  clientes: number;
  perdidos: number;
  pedidosMes: number;
  faturamentoMes: number;
  ticketMedio: number;
  taxaConversao: number;
}

const EMPTY: CrmMetrics = {
  novosLeads: 0, emNegociacao: 0, orcamentos: 0, clientes: 0, perdidos: 0,
  pedidosMes: 0, faturamentoMes: 0, ticketMedio: 0, taxaConversao: 0,
};

const ACCENTS = {
  blue: ['from-blue-500/15 to-blue-500/5 border-blue-500/20', 'text-blue-500'],
  amber: ['from-amber-500/15 to-amber-500/5 border-amber-500/20', 'text-amber-500'],
  purple: ['from-purple-500/15 to-purple-500/5 border-purple-500/20', 'text-purple-500'],
  emerald: ['from-emerald-500/15 to-emerald-500/5 border-emerald-500/20', 'text-emerald-500'],
  cyan: ['from-cyan-500/15 to-cyan-500/5 border-cyan-500/20', 'text-cyan-500'],
  primary: ['from-primary/15 to-primary/5 border-primary/20', 'text-primary'],
} as const;

function KpiTile({
  label, value, icon: Icon, accent, hint,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: keyof typeof ACCENTS;
  hint?: string;
}) {
  const [bg, ic] = ACCENTS[accent];
  return (
    <div className={cn('rounded-lg border bg-gradient-to-br p-2.5 transition hover:shadow-sm', bg)}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] text-muted-foreground font-medium truncate">{label}</span>
        <Icon className={cn('h-3.5 w-3.5 shrink-0', ic)} />
      </div>
      <div className="text-xl font-bold leading-tight tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

interface Props {
  dailyMetrics: DailyMetrics;
  followUpHoje: number;
}

/**
 * Painel único de indicadores do CRM.
 * Consolida a antiga faixa de métricas + "Dashboard Comercial" em um só quadro,
 * sem indicadores duplicados ou derivados redundantes.
 */
export function CrmIndicatorsPanel({ dailyMetrics, followUpHoje }: Props) {
  const [m, setM] = useState<CrmMetrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchMetrics = useCallback(async () => {
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const PAGE = 1000;
    const contacts: { funnel_status: string | null }[] = [];
    let from = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from('contacts')
        .select('funnel_status')
        .eq('is_active', true)
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      contacts.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('status, total_value')
      .gte('order_date', monthStart)
      .lte('order_date', monthEnd)
      .is('deleted_at', null);

    const by = (...st: string[]) => contacts.filter(c => st.includes(c.funnel_status || '')).length;

    const novosLeads = by('novo_lead');
    const emNegociacao = by('negociacao', 'contato_realizado');
    const orcamentos = by('proposta_enviada');
    const clientes = by('fechado', 'pos_venda');
    const perdidos = by('perdido');

    const list = orders || [];
    const validos = list.filter(o => o.status !== 'cancelado');
    const faturados = list.filter(o => ['entregue', 'concluido', 'concluído'].includes(o.status || ''));
    const faturamentoMes = faturados.reduce((s, o) => s + Number(o.total_value || 0), 0);

    setM({
      novosLeads,
      emNegociacao,
      orcamentos,
      clientes,
      perdidos,
      pedidosMes: validos.length,
      faturamentoMes,
      ticketMedio: faturados.length ? faturamentoMes / faturados.length : 0,
      taxaConversao: clientes + perdidos > 0 ? (clientes / (clientes + perdidos)) * 100 : 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMetrics();
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(fetchMetrics, 800);
    };
    const channel = supabase
      .channel('crm-indicators')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, trigger)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, trigger)
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [fetchMetrics]);

  const today = [
    { label: 'Follow-up', value: followUpHoje, tone: followUpHoje > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground' },
    { label: 'Atendidos', value: dailyMetrics.contactsAttended, tone: 'text-blue-600 dark:text-blue-400' },
    { label: 'Msgs', value: dailyMetrics.messagesSent, tone: 'text-green-600 dark:text-green-400' },
    { label: 'Respostas', value: dailyMetrics.responsesReceived, tone: 'text-purple-600 dark:text-purple-400' },
    { label: 'Pedidos', value: dailyMetrics.ordersGenerated, tone: 'text-emerald-600 dark:text-emerald-400' },
  ];

  return (
    <Card className="border-border/60 bg-gradient-to-br from-primary/5 via-background to-background">
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* Linha sempre visível: hoje */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-1.5" aria-busy={loading}>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Indicadores CRM
            <Badge
              variant="outline"
              className={cn('gap-1 text-[9px] px-1 py-0', live ? 'border-emerald-500/40 text-emerald-500' : 'border-muted text-muted-foreground')}
            >
              <Radio className={cn('h-2.5 w-2.5', live && 'animate-pulse')} />
              {live ? 'Ao vivo' : 'Offline'}
            </Badge>
          </span>
          {today.map((t) => (
            <span key={t.label} className="flex items-center gap-1">
              <span className={cn('text-xs font-bold leading-none tabular-nums', t.tone)}>{t.value}</span>
              <span className="text-[9px] text-muted-foreground leading-none">{t.label} hoje</span>
            </span>
          ))}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto text-[10px] gap-1 text-muted-foreground">
              {open ? 'Ocultar painel' : 'Ver painel'}
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-2.5 pb-2.5">
            <KpiTile label="Leads novos" value={loading ? '—' : m.novosLeads} icon={Users} accent="blue" />
            <KpiTile label="Em negociação" value={loading ? '—' : m.emNegociacao} icon={Handshake} accent="amber" />
            <KpiTile label="Orçamentos" value={loading ? '—' : m.orcamentos} icon={FileText} accent="purple" hint="Proposta enviada" />
            <KpiTile label="Clientes" value={loading ? '—' : m.clientes} icon={UserCheck} accent="emerald" hint="Fechados / pós-venda" />
            <KpiTile label="Pedidos no mês" value={loading ? '—' : m.pedidosMes} icon={CheckCircle2} accent="emerald" />
            <KpiTile
              label="Faturamento"
              value={loading ? '—' : formatCurrency(m.faturamentoMes, { compact: true, maxDecimals: 2 })}
              icon={Receipt}
              accent="primary"
              hint="Pedidos concluídos no mês"
            />
            <KpiTile
              label="Ticket médio"
              value={loading ? '—' : formatCurrency(m.ticketMedio, { compact: true, maxDecimals: 2 })}
              icon={TrendingUp}
              accent="primary"
            />
            <KpiTile
              label="Taxa de conversão"
              value={loading ? '—' : `${m.taxaConversao.toFixed(1)}%`}
              icon={Percent}
              accent="cyan"
              hint={`${m.clientes} ganhos / ${m.perdidos} perdidos`}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default CrmIndicatorsPanel;
