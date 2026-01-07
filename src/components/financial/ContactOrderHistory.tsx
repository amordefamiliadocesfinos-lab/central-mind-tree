import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Contact } from '@/hooks/useContacts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Package, ShoppingCart, TrendingUp, Calendar } from 'lucide-react';

interface Order {
  id: string;
  order_number: string | null;
  status: string;
  total_value: number | null;
  order_date: string;
  due_date: string | null;
  channel: string | null;
  notes: string | null;
  items: Array<{
    id: string;
    quantity: number;
    unit_price: number | null;
    product: {
      name: string;
      sku: string;
    } | null;
  }>;
}

interface ContactOrderHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  confirmado: { label: 'Confirmado', variant: 'default' },
  em_producao: { label: 'Em Produção', variant: 'default' },
  producao: { label: 'Em Produção', variant: 'default' },
  pronto: { label: 'Pronto', variant: 'default' },
  entregue: { label: 'Entregue', variant: 'default' },
  enviado: { label: 'Enviado', variant: 'default' },
  concluido: { label: 'Concluído', variant: 'default' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

export function ContactOrderHistory({ open, onOpenChange, contact }: ContactOrderHistoryProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && contact) {
      fetchOrders();
    }
  }, [open, contact]);

  const fetchOrders = async () => {
    if (!contact) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_value,
          order_date,
          due_date,
          channel,
          notes,
          order_items (
            id,
            quantity,
            unit_price,
            product:products (
              name,
              sku
            )
          )
        `)
        .eq('contact_id', contact.id)
        .is('deleted_at', null)
        .order('order_date', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        return;
      }

      const ordersWithItems = (data || []).map(order => ({
        ...order,
        items: order.order_items || [],
      }));

      setOrders(ordersWithItems as unknown as Order[]);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalOrders = orders.length;
  const totalValue = orders.reduce((acc, order) => acc + (order.total_value || 0), 0);
  const avgTicket = totalOrders > 0 ? totalValue / totalOrders : 0;
  const lastOrder = orders[0];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Histórico de Pedidos - {contact?.name}
          </DialogTitle>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Package className="h-4 w-4" />
              Total de Pedidos
            </div>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              Valor Total
            </div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalValue)}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <ShoppingCart className="h-4 w-4" />
              Ticket Médio
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(avgTicket)}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar className="h-4 w-4" />
              Último Pedido
            </div>
            <div className="text-2xl font-bold">
              {lastOrder ? formatDate(lastOrder.order_date) : '-'}
            </div>
          </Card>
        </div>

        {/* Orders Table */}
        <Card>
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum pedido encontrado para este cliente</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.order_number || order.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {formatDate(order.order_date)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {order.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="text-sm">
                            {item.quantity}x {item.product?.name || 'Produto'}
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{order.items.length - 3} itens
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_CONFIG[order.status]?.variant || 'secondary'}>
                        {STATUS_CONFIG[order.status]?.label || order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(order.total_value || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </DialogContent>
    </Dialog>
  );
}
