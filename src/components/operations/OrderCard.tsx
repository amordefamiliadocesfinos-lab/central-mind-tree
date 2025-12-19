import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  quantity: number;
  product?: { name: string };
}

interface Order {
  id: string;
  order_number?: string | null;
  customer_name?: string | null;
  status: string;
  channel?: string | null;
  order_date: string;
  due_date?: string | null;
  total_value?: number | null;
  items?: OrderItem[];
}

interface OrderCardProps {
  order: Order;
  orderStatus: Record<string, { label: string; color: string }>;
  orderChannels: Record<string, string>;
  onStatusChange: (order: Order, newStatus: string) => void;
  onDelete?: (orderId: string) => void;
}

export function OrderCard({ order, orderStatus, orderChannels, onStatusChange, onDelete }: OrderCardProps) {
  const statusInfo = orderStatus[order.status as keyof typeof orderStatus];
  
  return (
    <Card className="touch-manipulation active:scale-[0.98] transition-transform">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base">
                {order.order_number || `#${order.id.slice(0, 6)}`}
              </h3>
              <Badge className={cn('text-xs', statusInfo?.color)}>
                {statusInfo?.label || order.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {order.customer_name || 'Cliente não informado'}
            </p>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-1">
              <span>{orderChannels[order.channel as keyof typeof orderChannels] || order.channel}</span>
              <span>•</span>
              <span>{order.order_date}</span>
              {order.due_date && (
                <>
                  <span>•</span>
                  <span className="text-amber-600 font-medium">Entrega: {order.due_date}</span>
                </>
              )}
            </div>
            {order.items && order.items.length > 0 && (
              <p className="text-xs mt-2 text-muted-foreground line-clamp-2">
                {order.items.map(item => 
                  `${item.quantity}x ${item.product?.name || 'Produto'}`
                ).join(', ')}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <p className="font-bold text-lg">
              R$ {(order.total_value || 0).toFixed(2)}
            </p>
            <Select
              value={order.status}
              onValueChange={(v) => onStatusChange(order, v)}
            >
              <SelectTrigger className="w-28 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(orderStatus).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
