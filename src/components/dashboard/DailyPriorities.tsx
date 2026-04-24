import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  MessageSquareWarning,
  Factory,
  DollarSign,
  Megaphone,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, format, parseISO } from 'date-fns';

type PriorityType = 'lead_silencio' | 'producao_atrasada' | 'cobranca_pendente' | 'campanha_parada';

interface PriorityItem {
  id: string;
  type: PriorityType;
  title: string;
  subtitle: string;
  urgencyScore: number; // maior = mais urgente
  badge: string;
  href: string;
}

const TYPE_META: Record<PriorityType, { icon: any; color: string; bg: string; label: string }> = {
  lead_silencio: {
    icon: MessageSquareWarning,
    color: 'text-red-500',
    bg: 'bg-red-500/10 border-red-500/30',
    label: 'Lead em silêncio',
  },
  producao_atrasada: {
    icon: Factory,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10 border-orange-500/30',
    label: 'Produção atrasada',
  },
  cobranca_pendente: {
    icon: DollarSign,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    label: 'Cobrança pendente',
  },
  campanha_parada: {
    icon: Megaphone,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10 border-purple-500/30',
    label: 'Campanha parada',
  },
};

export function DailyPriorities() {
  const [items, setItems] = useState<PriorityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const collected: PriorityItem[] = [];

    try {
      // 1. Leads em silêncio (sem resposta há vários dias)
      const { data: leads } = await supabase
        .from('contacts')
        .select('id, name, ultimo_contato, temperatura_lead, funnel_status')
        .eq('is_active', true)
        .not('ultimo_contato', 'is', null)
        .neq('funnel_status', 'ganho')
        .neq('funnel_status', 'perdido')
        .order('ultimo_contato', { ascending: true })
        .limit(20);

      leads?.forEach((c: any) => {
        if (!c.ultimo_contato) return;
        const days = differenceInDays(today, parseISO(c.ultimo_contato));
        if (days < 3) return;
        const tempBoost = c.temperatura_lead === 'quente' ? 50 : c.temperatura_lead === 'morno' ? 20 : 0;
        collected.push({
          id: `lead-${c.id}`,
          type: 'lead_silencio',
          title: `${c.name} sem resposta há ${days} dias`,
          subtitle: c.temperatura_lead ? `Lead ${c.temperatura_lead}` : 'Reabrir conversa',
          urgencyScore: days * 5 + tempBoost,
          badge: `${days}d`,
          href: `/contatos?contact=${c.id}`,
        });
      });

      // 2. Pedidos com produção atrasada
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, due_date, production_date, status, order_type')
        .is('deleted_at', null)
        .neq('status', 'concluído')
        .neq('status', 'cancelado')
        .lt('due_date', todayStr)
        .order('due_date', { ascending: true })
        .limit(20);

      orders?.forEach((o: any) => {
        if (!o.due_date) return;
        const daysLate = differenceInDays(today, parseISO(o.due_date));
        if (daysLate <= 0) return;
        collected.push({
          id: `order-${o.id}`,
          type: 'producao_atrasada',
          title: `Pedido ${o.order_number || '#'} ${daysLate}d atrasado`,
          subtitle: o.customer_name || 'Cliente não informado',
          urgencyScore: daysLate * 8 + 30,
          badge: `${daysLate}d`,
          href: `/operacoes`,
        });
      });

      // 3. Cobranças pendentes (a receber vencidas)
      const { data: receivables } = await supabase
        .from('financial_entries')
        .select('id, description, due_date, value, value_paid, contact_id')
        .eq('type', 'receber')
        .lt('due_date', todayStr)
        .is('payment_date', null)
        .order('due_date', { ascending: true })
        .limit(20);

      // Buscar nomes dos contatos
      const contactIds = receivables?.map((r: any) => r.contact_id).filter(Boolean) || [];
      const contactMap = new Map<string, string>();
      if (contactIds.length > 0) {
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('id, name')
          .in('id', contactIds);
        contactsData?.forEach((c: any) => contactMap.set(c.id, c.name));
      }

      receivables?.forEach((r: any) => {
        if (!r.due_date) return;
        const daysLate = differenceInDays(today, parseISO(r.due_date));
        if (daysLate <= 0) return;
        const pendente = Number(r.value) - Number(r.value_paid || 0);
        if (pendente <= 0) return;
        const clientName = contactMap.get(r.contact_id) || r.description || 'Cliente';
        collected.push({
          id: `receivable-${r.id}`,
          type: 'cobranca_pendente',
          title: `${clientName} - R$ ${pendente.toFixed(2)}`,
          subtitle: `Vencido há ${daysLate} dias`,
          urgencyScore: daysLate * 6 + Math.min(pendente / 100, 50),
          badge: `${daysLate}d`,
          href: `/financeiro`,
        });
      });

      // 4. Campanhas paradas (Digital sem execução)
      const { data: campaigns } = await supabase
        .from('digital_ideas')
        .select('id, title, status, updated_at')
        .in('status', ['andamento', 'pendente', 'estrutural'])
        .or('idea_type.eq.campanha,objective.ilike.%campanha%,objective.ilike.%vender%')
        .order('updated_at', { ascending: true })
        .limit(10);

      campaigns?.forEach((c: any) => {
        const daysIdle = differenceInDays(today, parseISO(c.updated_at));
        if (daysIdle < 5) return;
        collected.push({
          id: `campaign-${c.id}`,
          type: 'campanha_parada',
          title: `Campanha "${c.title}" parada`,
          subtitle: `Sem execução há ${daysIdle} dias`,
          urgencyScore: daysIdle * 3 + 10,
          badge: `${daysIdle}d`,
          href: `/digital`,
        });
      });

      // Ordenar por urgência real (maior score primeiro)
      collected.sort((a, b) => b.urgencyScore - a.urgencyScore);
      setItems(collected);
    } catch (err) {
      console.error('Erro ao carregar prioridades:', err);
    } finally {
      setLoading(false);
    }
  }

  const visible = showAll ? items : items.slice(0, 5);

  return (
    <Card className="p-3 sm:p-4 border-2 border-red-500/30 bg-gradient-to-br from-red-500/5 via-card to-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
          <span className="text-lg">🚨</span>
          Prioridades do Dia
          {items.length > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {items.length}
            </Badge>
          )}
        </h3>
        <Button variant="ghost" size="sm" onClick={load} className="h-7 text-xs">
          Atualizar
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Analisando riscos...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
          <p className="text-sm font-medium">Tudo sob controle!</p>
          <p className="text-xs text-muted-foreground">Nenhuma prioridade crítica agora.</p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            {visible.map((item, idx) => {
              const meta = TYPE_META[item.type];
              const Icon = meta.icon;
              const isCritical = idx < 3;
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-2 sm:gap-3 rounded-lg border p-2 sm:p-2.5 transition-all',
                    'hover:shadow-sm',
                    meta.bg,
                    isCritical && 'ring-1 ring-red-500/20'
                  )}
                >
                  <div className={cn('shrink-0 rounded-md p-1.5 bg-background/60', meta.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-semibold truncate">{item.title}</p>
                      {isCritical && (
                        <AlertTriangle className="h-3 w-3 text-red-500 shrink-0 animate-pulse" />
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {item.subtitle}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isCritical ? 'destructive' : 'secondary'}
                    onClick={() => navigate(item.href)}
                    className="h-7 px-2 text-[10px] sm:text-xs shrink-0 gap-1"
                  >
                    Resolver
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>

          {items.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll((s) => !s)}
              className="w-full mt-2 text-xs"
            >
              {showAll ? 'Ver menos' : `Ver mais ${items.length - 5} prioridades`}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
