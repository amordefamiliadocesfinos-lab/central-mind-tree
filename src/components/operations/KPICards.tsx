import { Card, CardContent } from '@/components/ui/card';
import { ShoppingCart, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPIs {
  totalOrders: number;
  totalValue: number;
  avgTicket: number;
  lowStock: { id: string }[];
}

interface KPICardsProps {
  kpis: KPIs;
  compact?: boolean;
}

export function KPICards({ kpis, compact = false }: KPICardsProps) {
  const cards = [
    {
      label: 'Pedidos',
      value: kpis.totalOrders,
      format: (v: number) => v.toString(),
      icon: ShoppingCart,
      color: 'text-primary',
    },
    {
      label: 'Faturamento',
      value: kpis.totalValue,
      format: (v: number) => `R$ ${v.toFixed(0)}`,
      icon: DollarSign,
      color: 'text-emerald-600',
    },
    {
      label: 'Ticket Médio',
      value: kpis.avgTicket,
      format: (v: number) => `R$ ${v.toFixed(0)}`,
      icon: TrendingUp,
      color: 'text-blue-600',
    },
    {
      label: 'Estoque Baixo',
      value: kpis.lowStock.length,
      format: (v: number) => v.toString(),
      icon: AlertTriangle,
      color: kpis.lowStock.length > 0 ? 'text-amber-500' : 'text-muted-foreground',
    },
  ];

  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="shrink-0 min-w-[100px]">
              <CardContent className="p-3 flex items-center gap-2">
                <Icon className={cn("h-4 w-4 shrink-0", card.color)} />
                <div>
                  <p className={cn("text-lg font-bold leading-none", card.color)}>
                    {card.format(card.value)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg bg-muted", card.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className={cn("text-xl font-bold", card.color)}>
                    {card.format(card.value)}
                  </p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
