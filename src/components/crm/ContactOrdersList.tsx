import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ContactOrder {
  id: string;
  order_number: string | null;
  status: string;
  total_value: number | null;
  order_date: string;
  order_type: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  confirmado: { label: 'Confirmado', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  em_producao: { label: 'Em Produção', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  producao: { label: 'Em Produção', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  pronto: { label: 'Pronto', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  enviado: { label: 'Enviado', className: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  entregue: { label: 'Entregue', className: 'bg-green-100 text-green-800 border-green-300' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800 border-green-300' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-300' },
};

interface ContactOrdersListProps {
  contactId: string;
  onClose?: () => void;
}

export function ContactOrdersList({ contactId, onClose }: ContactOrdersListProps) {
  const [orders, setOrders] = useState<ContactOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, total_value, order_date, order_type')
        .eq('contact_id', contactId)
        .is('deleted_at', null)
        .order('order_date', { ascending: false });
      setOrders((data || []) as ContactOrder[]);
      setLoading(false);
    };
    fetchOrders();
  }, [contactId]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum pedido vinculado a este contato.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => {
        const statusInfo = STATUS_LABELS[order.status] || { label: order.status, className: 'bg-muted text-muted-foreground' };
        return (
          <div
            key={order.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
            onClick={() => {
              onClose?.();
              navigate(`/operacoes?tab=orders&orderId=${order.id}`);
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  Pedido {order.order_number ? `#${order.order_number}` : order.id.slice(0, 8)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(parseISO(order.order_date), 'dd/MM/yyyy')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-semibold text-sm">
                {formatCurrency(order.total_value || 0)}
              </span>
              <Badge variant="outline" className={`text-xs ${statusInfo.className}`}>
                {statusInfo.label}
              </Badge>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
