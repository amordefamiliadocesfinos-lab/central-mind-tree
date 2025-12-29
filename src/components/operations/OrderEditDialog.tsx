import { useState, useEffect } from 'react';
import { FullScreenDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { Order, OrderItem, Product } from '@/hooks/useOrders';
interface OrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  products: Product[];
  orderChannels: Record<string, string>;
  orderStatus: Record<string, { label: string; color: string }>;
  onSave: (orderId: string, updates: Partial<Order>, items: Partial<OrderItem>[]) => Promise<void>;
  onDelete?: (orderId: string) => Promise<void>;
}

export function OrderEditDialog({
  open,
  onOpenChange,
  order,
  products,
  orderChannels,
  orderStatus,
  onSave,
  onDelete,
}: OrderEditDialogProps) {
  const [formData, setFormData] = useState<Partial<Order>>({});
  const [items, setItems] = useState<Partial<OrderItem>[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({
        customer_name: order.customer_name,
        customer_contact: order.customer_contact,
        channel: order.channel,
        status: order.status,
        due_date: order.due_date,
        notes: order.notes,
      });
      setItems(order.items?.map(i => ({
        id: i.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        notes: i.notes,
      })) || []);
    }
  }, [order]);

  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    await onSave(order.id, formData, items);
    setSaving(false);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!order || !onDelete) return;
    if (confirm('Excluir este pedido?')) {
      await onDelete(order.id);
      onOpenChange(false);
    }
  };

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1, unit_price: 0 }]);
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product?.price) {
        newItems[index].unit_price = product.price;
      }
    }
    
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((acc, item) => {
      return acc + (item.quantity || 0) * (item.unit_price || 0);
    }, 0);
  };

  if (!order) return null;

  return (
    <FullScreenDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title={`Editar Pedido #${order.order_number || order.id.slice(0, 8)}`}
    >
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <Input
                className="h-12"
                value={formData.customer_name || ''}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Contato</Label>
              <Input
                className="h-12"
                value={formData.customer_contact || ''}
                onChange={(e) => setFormData({ ...formData, customer_contact: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Canal</Label>
              <Select
                value={formData.channel || 'direto'}
                onValueChange={(v) => setFormData({ ...formData, channel: v })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(orderChannels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status || 'pendente'}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(orderStatus).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Prazo de Entrega
            </Label>
            <Input
              type="date"
              className="h-12"
              value={formData.due_date || ''}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          {/* Items */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center mb-3">
                <Label className="text-base font-semibold">Itens</Label>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Item
                </Button>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item adicionado
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2">
                      <Select
                        value={item.product_id || ''}
                        onValueChange={(v) => updateItem(i, 'product_id', v)}
                      >
                        <SelectTrigger className="flex-1 h-10">
                          <SelectValue placeholder="Produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        className="w-16 h-10"
                        placeholder="Qtd"
                        value={item.quantity || ''}
                        onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                      />
                      <Input
                        type="number"
                        className="w-24 h-10"
                        placeholder="R$"
                        step="any"
                        value={item.unit_price || ''}
                        onChange={(e) => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                      <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => removeItem(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center mt-4 pt-3 border-t">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold">
                  R$ {calculateTotal().toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 h-12">
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
            {onDelete && (
              <Button variant="destructive" size="icon" className="h-12 w-12" onClick={handleDelete}>
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
          </div>
      </div>
    </FullScreenDialog>
  );
}
