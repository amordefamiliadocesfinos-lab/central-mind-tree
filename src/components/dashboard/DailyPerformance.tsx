import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import {
  Users,
  MessageCircle,
  ShoppingCart,
  TrendingUp,
  Factory,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';

interface MetricPair {
  today: number;
  yesterday: number;
}

interface PerformanceData {
  contactsServed: MetricPair;
  messagesSent: MetricPair;
  ordersCreated: MetricPair;
  salesClosed: MetricPair;
  salesValue: MetricPair;
  productionDone: MetricPair;
}

const EMPTY: PerformanceData = {
  contactsServed: { today: 0, yesterday: 0 },
  messagesSent: { today: 0, yesterday: 0 },
  ordersCreated: { today: 0, yesterday: 0 },
  salesClosed: { today: 0, yesterday: 0 },
  salesValue: { today: 0, yesterday: 0 },
  productionDone: { today: 0, yesterday: 0 },
};

function Delta({ today, yesterday }: MetricPair) {
  if (yesterday === 0 && today === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-3 w-3" /> sem dados
      </span>
    );
  }
  if (yesterday === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-500 font-semibold">
        <ArrowUp className="h-3 w-3" /> novo hoje
      </span>
    );
  }
  const diff = today - yesterday;
  const pct = Math.round((diff / yesterday) * 100);
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-3 w-3" /> igual ontem
      </span>
    );
  }
  const isUp = diff > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-semibold',
        isUp ? 'text-emerald-500' : 'text-red-500'
      )}
    >
      {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {isUp ? '+' : ''}
      {pct}% vs ontem
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  pair,
  color,
  formatter,
}: {
  icon: any;
  label: string;
  value: string | number;
  pair: MetricPair;
  color: string;
  formatter?: (n: number) => string;
}) {
  return (
    <div className="rounded-lg border bg-card p-2.5 sm:p-3 hover:shadow-sm transition-all">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <div className={cn('text-xl sm:text-2xl font-bold leading-none mb-1', color)}>
        {value}
      </div>
      <Delta today={pair.today} yesterday={pair.yesterday} />
      {formatter && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          ontem: {formatter(pair.yesterday)}
        </div>
      )}
      {!formatter && pair.yesterday > 0 && (
        <div className="text-[10px] text-muted-foreground mt-0.5">ontem: {pair.yesterday}</div>
      )}
    </div>
  );
}

export function DailyPerformance() {
  const contactedTodayRef = useRef<Set<string>>(new Set());
  const [data, setData] = useState<PerformanceData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const handleWhatsAppSent = (event: Event) => {
      const contactId = (event as CustomEvent<{ contactId?: string }>).detail?.contactId;
      setData(prev => ({
        ...prev,
        contactsServed: {
          ...prev.contactsServed,
          today: contactId && contactedTodayRef.current.has(contactId)
            ? prev.contactsServed.today
            : prev.contactsServed.today + 1,
        },
        messagesSent: { ...prev.messagesSent, today: prev.messagesSent.today + 1 },
      }));
      if (contactId) contactedTodayRef.current.add(contactId);
      window.setTimeout(() => { void load(); }, 700);
    };

    window.addEventListener('crm:whatsapp-sent', handleWhatsAppSent);
    return () => window.removeEventListener('crm:whatsapp-sent', handleWhatsAppSent);
  }, []);

  async function load() {
    setLoading(true);
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const yStart = startOfDay(subDays(now, 1)).toISOString();
    const yEnd = endOfDay(subDays(now, 1)).toISOString();
    const todayDate = format(now, 'yyyy-MM-dd');
    const yDate = format(subDays(now, 1), 'yyyy-MM-dd');

    try {
      const [
        contactsT,
        contactsY,
        msgsT,
        msgsY,
        ordersT,
        ordersY,
        salesT,
        salesY,
        prodT,
        prodY,
      ] = await Promise.all([
        // Contatos atendidos: interações distintas hoje
        supabase
          .from('contact_history')
          .select('contact_id', { count: 'exact', head: true })
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
        supabase
          .from('contact_history')
          .select('contact_id', { count: 'exact', head: true })
          .gte('created_at', yStart)
          .lte('created_at', yEnd),
        // Mensagens enviadas: tipos de mensagem (whatsapp, mensagem)
        supabase
          .from('contact_history')
          .select('id', { count: 'exact', head: true })
          .in('interaction_type', ['whatsapp', 'mensagem'])
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
        supabase
          .from('contact_history')
          .select('id', { count: 'exact', head: true })
          .in('interaction_type', ['whatsapp', 'mensagem'])
          .gte('created_at', yStart)
          .lte('created_at', yEnd),
        // Pedidos gerados (criados hoje)
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null)
          .gte('created_at', yStart)
          .lte('created_at', yEnd),
        // Vendas fechadas (concluídos hoje) com valor
        supabase
          .from('orders')
          .select('id, total_value')
          .is('deleted_at', null)
          .eq('status', 'concluído')
          .gte('updated_at', todayStart)
          .lte('updated_at', todayEnd),
        supabase
          .from('orders')
          .select('id, total_value')
          .is('deleted_at', null)
          .eq('status', 'concluído')
          .gte('updated_at', yStart)
          .lte('updated_at', yEnd),
        // Produção concluída: production_date
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null)
          .eq('order_type', 'production')
          .eq('status', 'concluído')
          .eq('production_date', todayDate),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null)
          .eq('order_type', 'production')
          .eq('status', 'concluído')
          .eq('production_date', yDate),
      ]);

      // Contatos distintos
      const contactsTodaySet = new Set<string>();
      const contactsYSet = new Set<string>();
      const { data: ct } = await supabase
        .from('contact_history')
        .select('contact_id')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);
      const { data: cy } = await supabase
        .from('contact_history')
        .select('contact_id')
        .gte('created_at', yStart)
        .lte('created_at', yEnd);
      ct?.forEach((r: any) => r.contact_id && contactsTodaySet.add(r.contact_id));
      cy?.forEach((r: any) => r.contact_id && contactsYSet.add(r.contact_id));
      contactedTodayRef.current = contactsTodaySet;

      const sumValue = (rows: any[] | null) =>
        (rows || []).reduce((acc, r) => acc + Number(r.total_value || 0), 0);

      setData({
        contactsServed: { today: contactsTodaySet.size, yesterday: contactsYSet.size },
        messagesSent: { today: msgsT.count || 0, yesterday: msgsY.count || 0 },
        ordersCreated: { today: ordersT.count || 0, yesterday: ordersY.count || 0 },
        salesClosed: {
          today: salesT.data?.length || 0,
          yesterday: salesY.data?.length || 0,
        },
        salesValue: {
          today: sumValue(salesT.data as any),
          yesterday: sumValue(salesY.data as any),
        },
        productionDone: { today: prodT.count || 0, yesterday: prodY.count || 0 },
      });
    } catch (err) {
      console.error('Erro ao carregar performance:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-3 sm:p-4 border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
          <span className="text-lg">📈</span>
          Performance de Hoje
        </h3>
        <span className="text-[10px] sm:text-xs text-muted-foreground">vs ontem</span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Calculando...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <MetricCard
            icon={Users}
            label="Atendidos"
            value={data.contactsServed.today}
            pair={data.contactsServed}
            color="text-blue-500"
          />
          <MetricCard
            icon={MessageCircle}
            label="Mensagens"
            value={data.messagesSent.today}
            pair={data.messagesSent}
            color="text-cyan-500"
          />
          <MetricCard
            icon={ShoppingCart}
            label="Pedidos"
            value={data.ordersCreated.today}
            pair={data.ordersCreated}
            color="text-amber-500"
          />
          <MetricCard
            icon={TrendingUp}
            label="Vendas"
            value={data.salesClosed.today}
            pair={data.salesClosed}
            color="text-emerald-500"
          />
          <MetricCard
            icon={TrendingUp}
            label="Faturado"
            value={formatCurrency(data.salesValue.today, { compact: true })}
            pair={data.salesValue}
            color="text-emerald-600"
            formatter={(n) => formatCurrency(n, { compact: true })}
          />
          <MetricCard
            icon={Factory}
            label="Produção"
            value={data.productionDone.today}
            pair={data.productionDone}
            color="text-purple-500"
          />
        </div>
      )}
    </Card>
  );
}
