import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Megaphone,
  Users,
  UserCheck,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface CampaignResult {
  id: string;
  title: string;
  status: string;
  leadsGenerated: number;
  converted: number;
  salesCount: number;
  salesValue: number;
  conversionRate: number; // %
}

interface CampaignsData {
  activeCount: number;
  totals: {
    leads: number;
    converted: number;
    salesCount: number;
    salesValue: number;
  };
  byCampaign: CampaignResult[];
}

const EMPTY: CampaignsData = {
  activeCount: 0,
  totals: { leads: 0, converted: 0, salesCount: 0, salesValue: 0 },
  byCampaign: [],
};

const ACTIVE_STATUSES = ['andamento', 'pendente', 'estrutural'];

export function CampaignResults() {
  const [data, setData] = useState<CampaignsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      // Buscar campanhas ativas (idea_type campanha OU objetivo de venda/lead)
      const { data: campaigns } = await supabase
        .from('digital_ideas')
        .select('id, title, status, idea_type, objective')
        .in('status', ACTIVE_STATUSES)
        .or(
          'idea_type.eq.campanha,objective.ilike.%campanha%,objective.ilike.%lead%,objective.ilike.%vender%'
        )
        .order('updated_at', { ascending: false });

      const activeCampaigns = campaigns || [];
      const campaignIds = activeCampaigns.map((c: any) => c.id);

      let byCampaign: CampaignResult[] = [];
      let totals = { leads: 0, converted: 0, salesCount: 0, salesValue: 0 };

      if (campaignIds.length > 0) {
        // Contatos vinculados a essas campanhas
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, campaign_idea_id, funnel_status, converted_at')
          .in('campaign_idea_id', campaignIds);

        // Pedidos vinculados aos contatos das campanhas
        const contactIds = (contacts || []).map((c: any) => c.id);
        let ordersByContact = new Map<string, { count: number; value: number }>();
        if (contactIds.length > 0) {
          const { data: orders } = await supabase
            .from('orders')
            .select('contact_id, total_value, status')
            .is('deleted_at', null)
            .neq('status', 'cancelado')
            .in('contact_id', contactIds);

          orders?.forEach((o: any) => {
            const cur = ordersByContact.get(o.contact_id) || { count: 0, value: 0 };
            cur.count += 1;
            cur.value += Number(o.total_value || 0);
            ordersByContact.set(o.contact_id, cur);
          });
        }

        // Agregar por campanha
        byCampaign = activeCampaigns.map((camp: any) => {
          const campContacts = (contacts || []).filter(
            (c: any) => c.campaign_idea_id === camp.id
          );
          const leads = campContacts.length;
          const converted = campContacts.filter(
            (c: any) => c.converted_at || c.funnel_status === 'ganho'
          ).length;

          let salesCount = 0;
          let salesValue = 0;
          campContacts.forEach((c: any) => {
            const o = ordersByContact.get(c.id);
            if (o) {
              salesCount += o.count;
              salesValue += o.value;
            }
          });

          return {
            id: camp.id,
            title: camp.title,
            status: camp.status,
            leadsGenerated: leads,
            converted,
            salesCount,
            salesValue,
            conversionRate: leads > 0 ? Math.round((converted / leads) * 100) : 0,
          };
        });

        // Ordenar por desempenho (vendas, depois conversão, depois leads)
        byCampaign.sort((a, b) => {
          if (b.salesValue !== a.salesValue) return b.salesValue - a.salesValue;
          if (b.converted !== a.converted) return b.converted - a.converted;
          return b.leadsGenerated - a.leadsGenerated;
        });

        totals = byCampaign.reduce(
          (acc, c) => ({
            leads: acc.leads + c.leadsGenerated,
            converted: acc.converted + c.converted,
            salesCount: acc.salesCount + c.salesCount,
            salesValue: acc.salesValue + c.salesValue,
          }),
          { leads: 0, converted: 0, salesCount: 0, salesValue: 0 }
        );
      }

      setData({
        activeCount: activeCampaigns.length,
        totals,
        byCampaign,
      });
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
    } finally {
      setLoading(false);
    }
  }

  const summary = [
    {
      label: 'Ativas',
      value: data.activeCount,
      icon: Megaphone,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 border-purple-500/30',
    },
    {
      label: 'Leads gerados',
      value: data.totals.leads,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 border-blue-500/30',
    },
    {
      label: 'Convertidos',
      value: data.totals.converted,
      icon: UserCheck,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
    },
    {
      label: 'Vendas',
      value: `${data.totals.salesCount} · ${formatCurrency(data.totals.salesValue, { compact: true })}`,
      icon: ShoppingBag,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/30',
    },
  ];

  const top3 = data.byCampaign.slice(0, 3);

  return (
    <Card className="p-3 sm:p-4 border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-card to-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
          <span className="text-lg">📣</span>
          Resultado das Campanhas
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/digital')}
          className="h-7 text-xs gap-1"
        >
          Ver todas <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Cruzando dados...</p>
      ) : (
        <>
          {/* Totais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            {summary.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className={cn('rounded-lg border p-2.5 sm:p-3', s.bg)}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={cn('h-3.5 w-3.5', s.color)} />
                    <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">
                      {s.label}
                    </span>
                  </div>
                  <div className={cn('text-lg sm:text-xl font-bold leading-none', s.color)}>
                    {s.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top campanhas */}
          {data.byCampaign.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center">
              <Sparkles className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
              <p className="text-xs sm:text-sm font-medium">
                Nenhuma campanha ativa rastreável
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                Vincule contatos do CRM à campanha (Origem) para medir retorno.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => navigate('/digital')}
              >
                Criar campanha
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground mb-1">
                Top campanhas por retorno:
              </p>
              {top3.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/contatos?campaign=${c.id}`)}
                  className="w-full text-left rounded-lg border bg-background hover:bg-muted/40 p-2 sm:p-2.5 transition-all flex items-center gap-2 sm:gap-3 group"
                >
                  <Badge
                    variant={idx === 0 ? 'default' : 'secondary'}
                    className="shrink-0 text-[10px] h-5 w-5 p-0 flex items-center justify-center"
                  >
                    {idx + 1}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold truncate">{c.title}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground mt-0.5">
                      <span className="inline-flex items-center gap-0.5">
                        <Users className="h-2.5 w-2.5" />
                        {c.leadsGenerated} leads
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-emerald-500">
                        <UserCheck className="h-2.5 w-2.5" />
                        {c.converted} ({c.conversionRate}%)
                      </span>
                      {c.salesValue > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold">
                          <TrendingUp className="h-2.5 w-2.5" />
                          {formatCurrency(c.salesValue, { compact: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
              {data.byCampaign.length > 3 && (
                <p className="text-[10px] text-center text-muted-foreground pt-1">
                  +{data.byCampaign.length - 3} outras campanhas ativas
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
