import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Flame, Package, DollarSign, Recycle, Megaphone, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';

interface SummaryData {
  urgentLeads: number;
  productionToday: number;
  pendingPayments: number;
  reactivation: number;
  activeCampaigns: number;
}

const CARDS = [
  {
    key: 'urgentLeads' as const,
    label: 'Leads urgentes',
    sub: 'Para responder',
    icon: Flame,
    href: '/contatos',
    color: 'from-red-500/20 to-orange-500/10 border-red-500/30',
    iconColor: 'text-red-500',
    valueColor: 'text-red-500',
  },
  {
    key: 'productionToday' as const,
    label: 'Pedidos hoje',
    sub: 'Para produção',
    icon: Package,
    href: '/operacoes',
    color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
    iconColor: 'text-blue-500',
    valueColor: 'text-blue-500',
  },
  {
    key: 'pendingPayments' as const,
    label: 'Pagamentos',
    sub: 'Pendentes',
    icon: DollarSign,
    href: '/financeiro',
    color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30',
    iconColor: 'text-emerald-500',
    valueColor: 'text-emerald-500',
  },
  {
    key: 'reactivation' as const,
    label: 'Reativação',
    sub: 'Clientes parados',
    icon: Recycle,
    href: '/contatos',
    color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30',
    iconColor: 'text-amber-500',
    valueColor: 'text-amber-500',
  },
  {
    key: 'activeCampaigns' as const,
    label: 'Campanhas',
    sub: 'Ativas no Digital',
    icon: Megaphone,
    href: '/digital',
    color: 'from-purple-500/20 to-fuchsia-500/10 border-purple-500/30',
    iconColor: 'text-purple-500',
    valueColor: 'text-purple-500',
  },
];

export function DailySummary() {
  const [data, setData] = useState<SummaryData>({
    urgentLeads: 0,
    productionToday: 0,
    pendingPayments: 0,
    reactivation: 0,
    activeCampaigns: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = format(new Date(), 'yyyy-MM-dd');
      const cutoff30 = format(subDays(new Date(), 30), 'yyyy-MM-dd');

      try {
        const [leads, production, payments, reactivation, campaigns] = await Promise.all([
          // 🔥 Leads urgentes: temperatura quente OU próxima ação vencida, ativos
          supabase
            .from('contacts')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true)
            .or(`temperatura_lead.eq.quente,next_action_date.lte.${today}`),

          // 📦 Pedidos para produção hoje: production_date ou due_date = hoje, não concluído
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .is('deleted_at', null)
            .neq('status', 'concluído')
            .neq('status', 'cancelado')
            .or(`production_date.eq.${today},due_date.eq.${today}`),

          // 💰 Pagamento pendente: receber em aberto vencido (não totalmente pago)
          supabase
            .from('financial_entries')
            .select('id', { count: 'exact', head: true })
            .eq('type', 'receber')
            .lte('due_date', today)
            .is('payment_date', null),

          // ♻ Reativação: clientes ativos sem contato há > 30 dias
          supabase
            .from('contacts')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true)
            .lt('ultimo_contato', cutoff30),

          // 📣 Campanhas ativas: ideias com tipo campanha em andamento
          supabase
            .from('digital_ideas')
            .select('id', { count: 'exact', head: true })
            .in('status', ['andamento', 'pendente'])
            .or('idea_type.eq.campanha,objective.ilike.%campanha%'),
        ]);

        setData({
          urgentLeads: leads.count || 0,
          productionToday: production.count || 0,
          pendingPayments: payments.count || 0,
          reactivation: reactivation.count || 0,
          activeCampaigns: campaigns.count || 0,
        });
      } catch (err) {
        console.error('Erro ao carregar resumo do dia:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <Card className="p-3 sm:p-4 bg-gradient-to-br from-card to-muted/30 border-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
          <span className="text-lg">📊</span>
          Resumo do Dia
        </h3>
        <span className="text-[10px] sm:text-xs text-muted-foreground">Atualizado agora</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const value = data[card.key];
          const isHighlight = value > 0 && (card.key === 'urgentLeads' || card.key === 'pendingPayments');
          return (
            <Link
              key={card.key}
              to={card.href}
              className={cn(
                'group relative overflow-hidden rounded-lg border bg-gradient-to-br p-2.5 sm:p-3 transition-all',
                'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
                card.color,
                isHighlight && 'animate-pulse-subtle'
              )}
            >
              <div className="flex items-start justify-between gap-1 mb-1.5">
                <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5 shrink-0', card.iconColor)} />
                <ArrowRight className="h-3 w-3 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className={cn('text-xl sm:text-2xl font-bold leading-none', card.valueColor)}>
                {loading ? '—' : value}
              </div>
              <div className="mt-1">
                <div className="text-[11px] sm:text-xs font-semibold leading-tight truncate">
                  {card.label}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight truncate">
                  {card.sub}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
