import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListChecks, ArrowRight, RefreshCw } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface NextAction {
  title: string;
  reason: string;
  href: string;
  cta: string;
  score: number; // higher = more urgent
  area: 'Gargalo' | 'Financeiro' | 'Produção' | 'Vendas' | 'Metas';
}

const PRIORITY_STYLES = [
  { bg: 'bg-red-500/10 border-red-500/30', badge: 'bg-red-500 text-white', label: 'Prioridade 1' },
  { bg: 'bg-amber-500/10 border-amber-500/30', badge: 'bg-amber-500 text-white', label: 'Prioridade 2' },
  { bg: 'bg-blue-500/10 border-blue-500/30', badge: 'bg-blue-500 text-white', label: 'Prioridade 3' },
];

export function NextActionsCard() {
  const [actions, setActions] = useState<NextAction[]>([]);
  const [loading, setLoading] = useState(true);

  const compute = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const [accountsR, entriesR, ordersR, monthOrdersR, tasksR, productsR] = await Promise.all([
      supabase.from('financial_accounts').select('current_balance').eq('is_active', true),
      supabase.from('financial_entries').select('type, value, value_paid, due_date, payment_date'),
      supabase.from('orders').select('id, status, due_date').is('deleted_at', null),
      supabase.from('orders').select('id, total_value').gte('order_date', monthStart).lte('order_date', monthEnd).is('deleted_at', null),
      supabase.from('tasks').select('id, status, due_date').is('deleted_at', null),
      supabase.from('products').select('id, name, current_stock, min_stock').eq('is_active', true),
    ]);

    const saldo = (accountsR.data || []).reduce((s, a: any) => s + (a.current_balance || 0), 0);
    const entries = entriesR.data || [];
    const receberAtrasado = entries
      .filter((e: any) => e.type === 'receber' && !e.payment_date && e.due_date < today)
      .reduce((s, e: any) => s + (e.value - (e.value_paid || 0)), 0);
    const pagarAtrasado = entries
      .filter((e: any) => e.type === 'pagar' && !e.payment_date && e.due_date < today)
      .reduce((s, e: any) => s + (e.value - (e.value_paid || 0)), 0);

    const orders = ordersR.data || [];
    const pendentes = orders.filter((o: any) => ['rascunho', 'pendente', 'aguardando'].includes(o.status)).length;
    const producaoAtrasada = orders.filter((o: any) =>
      ['producao', 'em_producao', 'production'].includes(o.status) && o.due_date && o.due_date < today
    ).length;

    const monthOrders = monthOrdersR.data || [];
    const faturamento = monthOrders.reduce((s, o: any) => s + (o.total_value || 0), 0);

    const tasks = tasksR.data || [];
    const tarefasAtrasadas = tasks.filter((t: any) =>
      t.due_date && t.status !== 'concluído' && t.due_date < today
    ).length;

    const lowStock = (productsR.data || []).filter((p: any) =>
      p.min_stock != null && (p.current_stock || 0) <= p.min_stock
    );

    const candidates: NextAction[] = [];

    if (saldo < 0) {
      candidates.push({
        title: 'Cobrir caixa negativo',
        reason: `Saldo atual abaixo de zero (R$ ${saldo.toFixed(2)})`,
        href: '/financeiro',
        cta: 'Abrir financeiro',
        score: 100,
        area: 'Financeiro',
      });
    } else if (saldo < 1000) {
      candidates.push({
        title: 'Reforçar caixa',
        reason: `Saldo baixo (R$ ${saldo.toFixed(2)})`,
        href: '/financeiro',
        cta: 'Abrir financeiro',
        score: 70,
        area: 'Financeiro',
      });
    }

    if (receberAtrasado > 0) {
      candidates.push({
        title: 'Cobrar recebíveis atrasados',
        reason: `R$ ${receberAtrasado.toFixed(2)} em aberto vencidos`,
        href: '/financeiro',
        cta: 'Ver a receber',
        score: 90 + Math.min(receberAtrasado / 1000, 10),
        area: 'Financeiro',
      });
    }

    if (pagarAtrasado > 0) {
      candidates.push({
        title: 'Negociar contas a pagar atrasadas',
        reason: `R$ ${pagarAtrasado.toFixed(2)} vencidos`,
        href: '/financeiro',
        cta: 'Ver a pagar',
        score: 80 + Math.min(pagarAtrasado / 1000, 10),
        area: 'Financeiro',
      });
    }

    if (producaoAtrasada > 0) {
      candidates.push({
        title: 'Acelerar produção atrasada',
        reason: `${producaoAtrasada} pedido(s) em produção fora do prazo`,
        href: '/operacoes',
        cta: 'Abrir produção',
        score: 85 + producaoAtrasada,
        area: 'Produção',
      });
    }

    if (pendentes > 0) {
      candidates.push({
        title: 'Despachar pedidos pendentes',
        reason: `${pendentes} pedido(s) aguardando ação`,
        href: '/operacoes',
        cta: 'Ver pedidos',
        score: 60 + Math.min(pendentes * 2, 30),
        area: 'Vendas',
      });
    }

    if (tarefasAtrasadas > 0) {
      candidates.push({
        title: 'Concluir tarefas atrasadas',
        reason: `${tarefasAtrasadas} tarefa(s) fora do prazo`,
        href: '/foco',
        cta: 'Abrir foco',
        score: 55 + Math.min(tarefasAtrasadas * 2, 30),
        area: 'Gargalo',
      });
    }

    if (lowStock.length > 0) {
      candidates.push({
        title: 'Repor estoque crítico',
        reason: `${lowStock.length} produto(s) abaixo do mínimo`,
        href: '/operacoes',
        cta: 'Ver estoque',
        score: 50 + Math.min(lowStock.length * 2, 30),
        area: 'Produção',
      });
    }

    if (faturamento === 0) {
      candidates.push({
        title: 'Gerar primeira venda do mês',
        reason: 'Nenhuma venda registrada neste mês',
        href: '/operacoes',
        cta: 'Novo pedido',
        score: 75,
        area: 'Metas',
      });
    } else if (faturamento < 5000) {
      candidates.push({
        title: 'Impulsionar vendas do mês',
        reason: `Faturamento ainda baixo (R$ ${faturamento.toFixed(2)})`,
        href: '/digital',
        cta: 'Criar campanha',
        score: 45,
        area: 'Vendas',
      });
    }

    // fallback ações de crescimento
    if (candidates.length < 3) {
      candidates.push({
        title: 'Planejar conteúdo da semana',
        reason: 'Manter constância na geração de demanda',
        href: '/digital',
        cta: 'Abrir digital',
        score: 30,
        area: 'Vendas',
      });
      candidates.push({
        title: 'Revisar metas e prioridades',
        reason: 'Garantir foco no que importa',
        href: '/planejamento',
        cta: 'Abrir planejamento',
        score: 25,
        area: 'Metas',
      });
      candidates.push({
        title: 'Atualizar pipeline do CRM',
        reason: 'Acelerar leads em negociação',
        href: '/contatos',
        cta: 'Abrir CRM',
        score: 20,
        area: 'Vendas',
      });
    }

    const top3 = candidates.sort((a, b) => b.score - a.score).slice(0, 3);
    setActions(top3);
    setLoading(false);
  };

  useEffect(() => {
    compute();
    const interval = setInterval(compute, 60_000);
    const channel = supabase
      .channel('next-actions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => compute())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => compute())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_entries' }, () => compute())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_accounts' }, () => compute())
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          Próximas Ações
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={compute} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">Tudo sob controle. Nenhuma ação urgente.</p>
        )}
        {actions.map((a, i) => {
          const style = PRIORITY_STYLES[i] || PRIORITY_STYLES[2];
          return (
            <div key={i} className={cn('rounded-lg border p-3 flex items-start justify-between gap-3', style.bg)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className={cn('text-xs', style.badge)}>{style.label}</Badge>
                  <Badge variant="outline" className="text-xs">{a.area}</Badge>
                </div>
                <p className="font-semibold text-sm leading-tight">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.reason}</p>
              </div>
              <Link to={a.href}>
                <Button size="sm" variant="outline" className="shrink-0">
                  {a.cta}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
