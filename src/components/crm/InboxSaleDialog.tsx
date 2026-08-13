import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProductsList } from '@/hooks/useProductsList';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { createUnifiedSale, SalePaymentStatus } from '@/lib/unifiedSales';

interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

interface InboxSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  contactHandle?: string | null;
  onCreated?: () => void;
  onSaleCreated?: () => void;
}

const CHANNELS: Array<[string, string]> = [
  ['direto', 'Venda Direta'],
  ['whatsapp', 'WhatsApp'],
  ['marketplace', 'Marketplace'],
  ['ecommerce', 'E-commerce'],
  ['social', 'Redes Sociais'],
];

export function InboxSaleDialog({ open, onOpenChange, contactId, contactName, contactHandle, onCreated, onSaleCreated }: InboxSaleDialogProps) {
  const { products } = useProductsList();
  const [items, setItems] = useState<SaleItem[]>([]);
  const [channel, setChannel] = useState('whatsapp');
  const [orderType, setOrderType] = useState<'stock' | 'production'>('stock');
  const [dueDate, setDueDate] = useState('');
  const [financialDueDate, setFinancialDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState<SalePaymentStatus>('pendente');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [accountId, setAccountId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [marketplaceAccount, setMarketplaceAccount] = useState('');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + (item.quantity || 0) * (item.unit_price || 0), 0), [items]);
  const total = Math.max(0, subtotal - discount + shipping);

  useEffect(() => {
    if (!open) return;
    supabase.from('financial_accounts').select('id,name').eq('is_active', true).order('name')
      .then(({ data }) => setAccounts(data || []));
  }, [open]);

  const addItem = () => setItems((current) => [...current, { product_id: '', quantity: 1, unit_price: 0 }]);

  const updateItem = (index: number, patch: Partial<SaleItem>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const pickProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    updateItem(index, { product_id: productId, unit_price: product?.price ?? 0 });
  };

  const legacyHandleSave = async () => {
    const validItems = items.filter((item) => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Adicione ao menos um produto para registrar a venda.');
      return;
    }
    setSaving(true);
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          order_number: `PED-${Date.now()}`,
          customer_name: contactName,
          customer_contact: contactHandle || null,
          contact_id: contactId,
          channel,
          status: 'pendente',
          total_value: total,
          order_date: new Date().toISOString().split('T')[0],
          due_date: dueDate || null,
          notes: notes || null,
          order_type: orderType,
        })
        .select('id, order_number')
        .single();
      if (error || !order) throw error;

      const { error: itemsError } = await supabase.from('order_items').insert(
        validItems.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      );
      if (itemsError) throw itemsError;

      await supabase.from('contact_history').insert({
        contact_id: contactId,
        event_type: 'sale_won',
        interaction_type: 'venda',
        event_code: 'sale_won',
        description: `💰 Venda registrada — pedido ${order.order_number} · ${formatCurrency(total)}`,
        interaction_date: new Date().toISOString(),
      });

      await supabase.from('contacts').update({ funnel_status: 'fechado', updated_at: new Date().toISOString() }).eq('id', contactId);

      toast.success(`Venda registrada · pedido ${order.order_number}`);
      setItems([]);
      setNotes('');
      setDueDate('');
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível registrar a venda.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const validItems = items.filter(item => item.product_id && item.quantity > 0);
    if (!validItems.length) return toast.error('Adicione ao menos um produto para registrar a venda.');
    if (paymentStatus === 'pago' && !accountId) return toast.error('Selecione a conta que recebeu o pagamento.');
    setSaving(true);
    try {
      const result = await createUnifiedSale({
        customer_name: contactName, customer_contact: contactHandle || null, contact_id: contactId,
        channel, order_type: orderType, delivery_date: dueDate || null,
        financial_due_date: financialDueDate, notes: notes || null,
        discount_amount: discount, shipping_amount: shipping, payment_status: paymentStatus,
        payment_method: paymentMethod || null, financial_account_id: accountId || null,
        payment_date: paymentStatus === 'pago' ? new Date().toISOString().slice(0, 10) : null,
        marketplace_account: marketplaceAccount || null,
      }, validItems);
      await supabase.from('contact_history').insert({
        contact_id: contactId, event_type: 'sale_won', interaction_type: 'venda', event_code: 'sale_won',
        description: `Venda registrada — pedido ${result.order_number} · ${formatCurrency(total)}`,
        interaction_date: new Date().toISOString(),
      });
      await supabase.from('contacts').update({ funnel_status: 'fechado', updated_at: new Date().toISOString() }).eq('id', contactId);
      toast.success(`Venda, operação e financeiro registrados · ${result.order_number}`);
      setItems([]); setNotes(''); setDueDate('');
      setFinancialDueDate(new Date().toISOString().slice(0, 10));
      setPaymentStatus('pendente'); setPaymentMethod(''); setAccountId('');
      setDiscount(0); setShipping(0); setMarketplaceAccount('');
      onOpenChange(false); onCreated?.(); onSaleCreated?.();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível registrar a venda completa.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4 text-emerald-600" /> Registrar venda
          </DialogTitle>
          <DialogDescription className="text-xs">
            {contactName} · o pedido entra em Operações e no funil como Fechado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Tipo</Label>
              <Select value={orderType} onValueChange={(v) => setOrderType(v as 'stock' | 'production')}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Venda de estoque</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">Itens da venda</Label>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={addItem}>
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </div>
            {items.length === 0 && (
              <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                Nenhum item. Adicione o produto vendido.
              </p>
            )}
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_64px_88px_32px] items-center gap-1.5">
                <Select value={item.product_id} onValueChange={(v) => pickProduct(index, v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id} className="text-xs">{product.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number" inputMode="decimal" className="h-8 text-xs" value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                />
                <Input
                  type="number" inputMode="decimal" className="h-8 text-xs" value={item.unit_price}
                  onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setItems((c) => c.filter((_, i) => i !== index))}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Desconto</Label>
              <Input type="number" min="0" step="0.01" className="h-9" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Frete cobrado</Label>
              <Input type="number" min="0" step="0.01" className="h-9" value={shipping} onChange={e => setShipping(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Entrega prevista</Label>
              <Input type="date" className="h-9" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Vencimento financeiro</Label>
              <Input type="date" className="h-9" value={financialDueDate} onChange={e => setFinancialDueDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Situação do pagamento</Label>
              <Select value={paymentStatus} onValueChange={v => setPaymentStatus(v as SalePaymentStatus)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pendente">A receber</SelectItem><SelectItem value="pago">Já recebido</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent><SelectItem value="pix">PIX</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="cartao">Cartão</SelectItem><SelectItem value="boleto">Boleto</SelectItem><SelectItem value="marketplace">Marketplace</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          {paymentStatus === 'pago' && <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Conta que recebeu</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>{accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>}

          {(channel === 'marketplace' || paymentMethod === 'marketplace') && <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Conta do marketplace</Label>
            <Input className="h-9" value={marketplaceAccount} onChange={e => setMarketplaceAccount(e.target.value)} placeholder="Ex.: Shopee Viviane" />
          </div>}

          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span>Subtotal {formatCurrency(subtotal)} · desconto {formatCurrency(discount)} · frete {formatCurrency(shipping)}</span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Observações da venda</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Combinações, forma de pagamento, prazo..." />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
              Registrar venda
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
