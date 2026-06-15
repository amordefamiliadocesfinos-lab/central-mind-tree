import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Handshake,
  FileText,
  CheckCircle2,
  Percent,
  Receipt,
  TrendingUp,
  ArrowRight,
  Radio,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, format } from 'date-fns';

interface CommercialMetrics {
  novosLeads: number;
  emNegociacao: number;
  orcamentosEnviados: number;
  pedidosFechados: number;
  taxaConversao: number;
  ticketMedio: number;
  vendasPrevistas: number;
  faturamentoMes: number;
  perdidos: number;
}

const EMPTY: CommercialMetrics = {
  novosLeads: 0,
  emNegociacao: 0,
  orcamentosEnviados: 0,
  pedidosFechados: 0,
  taxaConversao: 0,
  ticketMedio: 0,
  vendasPrevistas: 0,
  faturamentoMes: 0,
  perdidos: 0,
};

function KpiTile({
  label,
  value,
  icon: Icon,
  accent = 'primary',
  hint,
  href,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: 'primary' | 'emerald' | 'amber' | 'blue' | 'purple' | 'cyan' | 'rose';
  hint?: string;
  href?: string;
}) {
  const bg: Record<string, string> = {
    primary: 'from-primary/15 to-primary/5 border-primary/20',
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-500/20',
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-500/20',
    purple: 'from-purple-500/15 to-purple-500/5 border-purple-500/20',
    cyan: 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/20',
    rose: 'from-rose-500/15 to-rose-500/5 border-rose-500/20',
  };
  const ic: Record<string, string> = {
    primary: 'text-primary',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    cyan: 'text-cyan-500',
    rose: 'text-rose-500',
  };

  const inner = (
    <div className={cn('rounded-lg border bg-gradient-to-br p-3 h-full transition hover:shadow-md', bg[accent])}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Icon className={cn('h-4 w-4', ic[accent])} />
      </div>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );

  return href ? <Link to={href}>{inner}</Link> : inner;
}

export function CommercialDashboard() {
  const [m, setM] = useState<CommercialMetrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  const fetchMetrics = useCallback(async () => {
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    // Paginate contacts to bypass PostgREST's 1000-row cap
    const PAGE = 1000;
    const contactsAll: any[] = [];
    let cFrom = 0;
    while (true) {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, funnel_status, valor_estimado')
        .eq('is_active', true)
        .range(cFrom, cFrom + PAGE - 1);
      if (error) { console.error(error); break; }
      if (!data || data.length === 0) break;
      contactsAll.push(...data);
      if (data.length < PAGE) break;
      cFrom += PAGE;
    }

    const ordersRes = await supabase
      .from('orders')
      .select('id, status, total_value, order_date')
      .gte('order_date', monthStart)
      .lte('order_date', monthEnd)
      .is('deleted_at', null);

    const contacts = contactsAll;
    const orders = ordersRes.data || [];


    const novosLeads = contacts.filter(c => c.funnel_status === 'novo_lead').length;
    const emNegociacao = contacts.filter(c =>
      ['negociacao', 'contato_realizado'].includes(c.funnel_status as string)
    ).length;
    const orcamentosEnviados = contacts.filter(c => c.funnel_status === 'proposta_enviada').length;
    const perdidos = contacts.filter(c => c.funnel_status === 'perdido').length;

    const fechadosOrders = orders.filter(o =>
      ['entregue', 'concluido', 'producao', 'pendente'].includes(o.status as string) &&
      o.status !== 'cancelado'
    );
    const faturados = orders.filter(o => ['entregue', 'concluido'].includes(o.status as string));
    const pedidosFechados = fechadosOrders.length;
    const faturamentoMes = faturados.reduce((s, o) => s + Number(o.total_value || 0), 0);
    const ticketMedio = faturados.length > 0 ? faturamentoMes / faturados.length : 0;

    const totalFunnel =
      novosLeads + emNegociacao + orcamentosEnviados + pedidosFechados + perdidos;
    const taxaConversao = totalFunnel > 0 ? (pedidosFechados / totalFunnel) * 100 : 0;

    const vendasPrevistas = contacts
      .filter(c =>
        ['negociacao', 'proposta_enviada', 'contato_realizado'].includes(c.funnel_status as string)
      )
      .reduce((s, c) => s + Number((c as any).valor_estimado || 0), 0);

    setM({
      novosLeads,
      emNegociacao,
      orcamentosEnviados,
      pedidosFechados,
      taxaConversao,
      ticketMedio,
      vendasPrevistas,
      faturamentoMes,
      perdidos,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMetrics();

    // Realtime: refetch on contact or order changes
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(fetchMetrics, 400);
    };

    const channel = supabase
      .channel('commercial-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, trigger)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, trigger)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setLive(true);
        else setLive(false);
      });

    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [fetchMetrics]);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Dashboard Comercial
            <Badge
              variant="outline"
              className={cn(
                'ml-2 gap-1 text-[10px] px-1.5 py-0',
                live ? 'border-emerald-500/40 text-emerald-500' : 'border-muted text-muted-foreground'
              )}
            >
              <Radio className={cn('h-2.5 w-2.5', live && 'animate-pulse')} />
              {live ? 'Ao vivo' : 'Offline'}
            </Badge>
          </span>
          <Link to="/contatos">
            <Button variant="ghost" size="sm" className="h-7 px-2">
              CRM <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando métricas...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiTile
              label="Leads novos"
              value={m.novosLeads}
              icon={Users}
              accent="blue"
              href="/contatos"
            />
            <KpiTile
              label="Em negociação"
              value={m.emNegociacao}
              icon={Handshake}
              accent="amber"
              href="/contatos"
            />
            <KpiTile
              label="Orçamentos enviados"
              value={m.orcamentosEnviados}
              icon={FileText}
              accent="purple"
              href="/contatos"
            />
            <KpiTile
              label="Pedidos fechados"
              value={m.pedidosFechados}
              icon={CheckCircle2}
              accent="emerald"
              hint="No mês"
              href="/operacoes"
            />
            <KpiTile
              label="Taxa de conversão"
              value={`${m.taxaConversao.toFixed(1)}%`}
              icon={Percent}
              accent="cyan"
              hint={`${m.pedidosFechados} fechados / ${m.perdidos} perdidos`}
            />
            <KpiTile
              label="Ticket médio"
              value={formatCurrency(m.ticketMedio, { compact: true })}
              icon={Receipt}
              accent="primary"
              hint={`Faturado: ${formatCurrency(m.faturamentoMes, { compact: true })}`}
            />
            <KpiTile
              label="Vendas previstas"
              value={formatCurrency(m.vendasPrevistas, { compact: true })}
              icon={TrendingUp}
              accent="rose"
              hint="Pipeline em aberto"
            />
            <KpiTile
              label="Pipeline total"
              value={m.novosLeads + m.emNegociacao + m.orcamentosEnviados}
              icon={Users}
              accent="primary"
              hint="Leads ativos no funil"
              href="/contatos"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CommercialDashboard;
