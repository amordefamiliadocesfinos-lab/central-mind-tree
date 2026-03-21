import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { FilterChips } from '@/components/ui/filter-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Package, ClipboardList, CheckCircle2 } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { differenceInDays, startOfDay, parseISO, format } from 'date-fns';
import { getNowSaoPaulo } from '@/lib/dateUtils';
import { OrderPriorityBadge } from './OrderPriorityBadge';

interface OrderItem {
  quantity: number;
  unit_price?: number | null;
  product?: { name: string };
}

interface Order {
  id: string;
  order_number?: string | null;
  customer_name?: string | null;
  status: string;
  due_date?: string | null;
  total_value?: number | null;
  items?: OrderItem[];
}

interface PlanningGroup {
  key: string;
  label: string;
  emoji: string;
  headerClass: string;
  orders: Order[];
}

interface ProductSummary {
  name: string;
  totalQty: number;
}

function getProductSummary(orders: Order[]): ProductSummary[] {
  const map: Record<string, number> = {};
  for (const order of orders) {
    for (const item of order.items || []) {
      const name = item.product?.name || 'Produto sem nome';
      map[name] = (map[name] || 0) + item.quantity;
    }
  }
  return Object.entries(map)
    .map(([name, totalQty]) => ({ name, totalQty }))
    .sort((a, b) => b.totalQty - a.totalQty);
}

function groupOrders(orders: Order[]): PlanningGroup[] {
  const today = startOfDay(getNowSaoPaulo());
  const groups: Record<string, Order[]> = {
    hoje: [],
    amanha: [],
    breve: [],
    futuro: [],
    sem_data: [],
  };

  for (const order of orders) {
    if (!order.due_date) {
      groups.sem_data.push(order);
      continue;
    }
    const due = startOfDay(parseISO(order.due_date));
    const diff = differenceInDays(due, today);
    if (diff <= 0) groups.hoje.push(order);
    else if (diff === 1) groups.amanha.push(order);
    else if (diff <= 3) groups.breve.push(order);
    else groups.futuro.push(order);
  }

  return [
    { key: 'hoje', label: 'Produzir Hoje', emoji: '🔴', headerClass: 'bg-gradient-to-r from-red-500 to-red-400', orders: groups.hoje },
    { key: 'amanha', label: 'Produzir Amanhã', emoji: '🟠', headerClass: 'bg-gradient-to-r from-orange-500 to-orange-400', orders: groups.amanha },
    { key: 'breve', label: 'Produzir em Breve', emoji: '🟡', headerClass: 'bg-gradient-to-r from-amber-500 to-amber-400', orders: groups.breve },
    { key: 'futuro', label: 'Produção Futura', emoji: '🟢', headerClass: 'bg-gradient-to-r from-green-500 to-green-400', orders: groups.futuro },
    ...(groups.sem_data.length > 0
      ? [{ key: 'sem_data', label: 'Sem Data de Entrega', emoji: '⚪', headerClass: 'bg-gradient-to-r from-gray-400 to-gray-300', orders: groups.sem_data }]
      : []),
  ];
}

function ProductionSummaryBlock({ orders }: { orders: Order[] }) {
  const summary = useMemo(() => getProductSummary(orders), [orders]);
  if (summary.length === 0) return null;

  return (
    <Card className="p-3 mb-2 border-dashed border-primary/30 bg-primary/5">
      <div className="flex items-center gap-1.5 mb-2">
        <ClipboardList className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-bold text-primary">Resumo de Produção</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
        {summary.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-muted-foreground">{item.name}</span>
            <span className="font-bold tabular-nums whitespace-nowrap">{item.totalQty.toLocaleString('pt-BR')}x</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

interface ProductionPlanningViewProps {
  orders: Order[];
  orderStatus: Record<string, { label: string; color: string }>;
  onStatusChange: (order: Order, newStatus: string) => void;
  onClick: (order: Order) => void;
}

export function ProductionPlanningView({
  orders,
  orderStatus,
  onStatusChange,
  onClick,
}: ProductionPlanningViewProps) {
  const [prodFilter, setProdFilter] = useState('all');

  const filterOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'nao_produzido', label: 'Não produzidos' },
    { value: 'produzido', label: 'Produzidos' },
  ];

  const productionOrders = useMemo(
    () => orders.filter((o) => {
      if (o.status === 'concluido' || o.status === 'cancelado') return false;
      if (prodFilter === 'produzido') return o.status === 'produzido';
      if (prodFilter === 'nao_produzido') return o.status !== 'produzido';
      return true;
    }),
    [orders, prodFilter]
  );

  const groups = useMemo(() => groupOrders(productionOrders), [productionOrders]);

  const handleMarkProduced = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    onStatusChange(order, 'produzido');
  };

  return (
    <div className="space-y-4">
      {/* Production filter */}
      <FilterChips options={filterOptions} value={prodFilter} onChange={setProdFilter} />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {groups.slice(0, 4).map((g) => (
          <Card key={g.key} className="p-3 text-center border-0 shadow-sm">
            <p className="text-2xl font-bold">{g.orders.length}</p>
            <p className="text-[11px] text-muted-foreground font-medium">
              {g.emoji} {g.label}
            </p>
          </Card>
        ))}
      </div>

      {/* Groups */}
      {groups.map((group) => (
        <div key={group.key}>
          <div className={cn('rounded-xl p-3 mb-2', group.headerClass)}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white drop-shadow-sm">
                {group.emoji} {group.label}
              </span>
              <Badge className="bg-white/30 text-white border-0 text-xs h-5 px-2 font-bold backdrop-blur-sm">
                {group.orders.length}
              </Badge>
            </div>
          </div>

          {/* Production Summary */}
          <ProductionSummaryBlock orders={group.orders} />

          {group.orders.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 opacity-60">
              Nenhum pedido neste grupo
            </p>
          ) : (
            <div className="space-y-2">
              {group.orders.map((order) => {
                const mainProduct = order.items?.[0];
                const totalQty = order.items?.reduce((s, i) => s + i.quantity, 0) || 0;
                const isProduced = order.status === 'produzido';
                const dueFormatted = order.due_date
                  ? (() => {
                      try { return format(parseISO(order.due_date), 'dd/MM'); } catch { return ''; }
                    })()
                  : null;

                return (
                  <Card
                    key={order.id}
                    className={cn(
                      'p-3 hover:shadow-md transition-all cursor-pointer border-l-[3px]',
                      isProduced
                        ? 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-l-transparent hover:border-l-primary'
                    )}
                    onClick={() => onClick(order)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm leading-tight truncate">
                            {order.customer_name || order.order_number || 'Pedido'}
                          </p>
                          {isProduced && (
                            <Badge className="bg-emerald-600 text-white border-0 text-[10px] h-5 px-1.5 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Produzido
                            </Badge>
                          )}
                        </div>
                        {mainProduct?.product?.name && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Package className="h-3 w-3 shrink-0" />
                            <span className="truncate">{mainProduct.product.name}</span>
                            {(order.items?.length || 0) > 1 && (
                              <span className="text-[10px] opacity-60">+{(order.items?.length || 1) - 1}</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium">Qtd: {totalQty}</span>
                          {dueFormatted && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              {dueFormatted}
                            </span>
                          )}
                          <OrderPriorityBadge dueDate={order.due_date} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Select value={order.status} onValueChange={(v) => onStatusChange(order, v)}>
                          <SelectTrigger className="h-7 text-[11px] w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(orderStatus).map(([key, cfg]) => (
                              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!isProduced && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] w-28 border-emerald-500 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
                            onClick={(e) => handleMarkProduced(e, order)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Produzido
                          </Button>
                        )}
                      </div>
                    </div>
                    {order.total_value != null && order.total_value > 0 && (
                      <p className="text-xs font-bold text-primary mt-1">
                        {formatCurrency(order.total_value)}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
