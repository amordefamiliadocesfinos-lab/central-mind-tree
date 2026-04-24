import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { format, startOfDay, endOfDay } from 'date-fns';

interface FinanceData {
  expectedIncome: number; // entradas previstas hoje (a receber com vencimento hoje)
  expectedIncomeCount: number;
  pendingPayments: number; // a pagar pendentes (vencidos + hoje)
  pendingPaymentsCount: number;
  overdueClients: number; // qtd de clientes distintos em atraso
  overdueValue: number; // valor total em atraso
  operationalBalance: number; // entradas pagas hoje - saídas pagas hoje
  inflowToday: number;
  outflowToday: number;
}

const EMPTY: FinanceData = {
  expectedIncome: 0,
  expectedIncomeCount: 0,
  pendingPayments: 0,
  pendingPaymentsCount: 0,
  overdueClients: 0,
  overdueValue: 0,
  operationalBalance: 0,
  inflowToday: 0,
  outflowToday: 0,
};

export function QuickFinance() {
  const [data, setData] = useState<FinanceData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();

    try {
      const [
        expectedQ,
        pendingPayQ,
        overdueQ,
        inflowQ,
        outflowQ,
      ] = await Promise.all([
        // Entradas previstas hoje (a receber, vence hoje, não pago)
        supabase
          .from('financial_entries')
          .select('value, value_paid')
          .eq('type', 'receber')
          .eq('due_date', todayStr)
          .is('payment_date', null),

        // Pagamentos pendentes (a pagar até hoje, não pago)
        supabase
          .from('financial_entries')
          .select('value, value_paid')
          .eq('type', 'pagar')
          .lte('due_date', todayStr)
          .is('payment_date', null),

        // Clientes em atraso (a receber vencido)
        supabase
          .from('financial_entries')
          .select('contact_id, value, value_paid')
          .eq('type', 'receber')
          .lt('due_date', todayStr)
          .is('payment_date', null),

        // Movimentações: entradas pagas hoje
        supabase
          .from('financial_movements')
          .select('value, entry_id, financial_entries!inner(type)')
          .eq('financial_entries.type', 'receber')
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),

        // Movimentações: saídas pagas hoje
        supabase
          .from('financial_movements')
          .select('value, entry_id, financial_entries!inner(type)')
          .eq('financial_entries.type', 'pagar')
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
      ]);

      const sumPending = (rows: any[] | null) =>
        (rows || []).reduce(
          (acc, r) => acc + (Number(r.value) - Number(r.value_paid || 0)),
          0
        );

      const overdueRows = (overdueQ.data as any[]) || [];
      const overdueClientSet = new Set<string>();
      let overdueValue = 0;
      overdueRows.forEach((r) => {
        const pendente = Number(r.value) - Number(r.value_paid || 0);
        if (pendente > 0) {
          overdueValue += pendente;
          if (r.contact_id) overdueClientSet.add(r.contact_id);
        }
      });

      const inflowToday = (inflowQ.data || []).reduce(
        (acc, r: any) => acc + Number(r.value || 0),
        0
      );
      const outflowToday = (outflowQ.data || []).reduce(
        (acc, r: any) => acc + Number(r.value || 0),
        0
      );

      setData({
        expectedIncome: sumPending(expectedQ.data as any),
        expectedIncomeCount: (expectedQ.data || []).length,
        pendingPayments: sumPending(pendingPayQ.data as any),
        pendingPaymentsCount: (pendingPayQ.data || []).length,
        overdueClients: overdueClientSet.size,
        overdueValue,
        operationalBalance: inflowToday - outflowToday,
        inflowToday,
        outflowToday,
      });
    } catch (err) {
      console.error('Erro ao carregar financeiro rápido:', err);
    } finally {
      setLoading(false);
    }
  }

  const balancePositive = data.operationalBalance >= 0;

  const cards = [
    {
      key: 'expected',
      label: 'Entradas previstas',
      sub: `${data.expectedIncomeCount} a receber hoje`,
      value: formatCurrency(data.expectedIncome, { compact: true }),
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      href: '/financeiro?tab=receber',
    },
    {
      key: 'pending',
      label: 'Pagamentos pendentes',
      sub: `${data.pendingPaymentsCount} a pagar`,
      value: formatCurrency(data.pendingPayments, { compact: true }),
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-500/10 border-red-500/30',
      href: '/financeiro?tab=pagar',
      alert: data.pendingPayments > 0,
    },
    {
      key: 'overdue',
      label: 'Clientes em atraso',
      sub: formatCurrency(data.overdueValue, { compact: true }),
      value: data.overdueClients,
      icon: AlertCircle,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/30',
      href: '/financeiro?tab=receber',
      alert: data.overdueClients > 0,
    },
    {
      key: 'balance',
      label: 'Saldo operacional do dia',
      sub: `↑ ${formatCurrency(data.inflowToday, { compact: true })} · ↓ ${formatCurrency(data.outflowToday, { compact: true })}`,
      value: formatCurrency(data.operationalBalance, { compact: true }),
      icon: Wallet,
      color: balancePositive ? 'text-emerald-500' : 'text-red-500',
      bg: balancePositive
        ? 'bg-emerald-500/10 border-emerald-500/30'
        : 'bg-red-500/10 border-red-500/30',
      href: '/financeiro',
    },
  ];

  return (
    <Card className="p-3 sm:p-4 border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
          <span className="text-lg">💸</span>
          Financeiro Rápido
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/financeiro')}
          className="h-7 text-xs gap-1"
        >
          Abrir <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Calculando caixa...</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                onClick={() => navigate(c.href)}
                className={cn(
                  'group text-left rounded-lg border p-2.5 sm:p-3 transition-all',
                  'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
                  c.bg,
                  c.alert && 'animate-pulse-subtle'
                )}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className={cn('h-3.5 w-3.5', c.color)} />
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">
                    {c.label}
                  </span>
                </div>
                <div className={cn('text-lg sm:text-xl font-bold leading-none', c.color)}>
                  {c.value}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 truncate">{c.sub}</div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
