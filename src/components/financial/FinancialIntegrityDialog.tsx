import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; onChanged?: () => void }
interface OrderRow { id: string; order_number: string | null; customer_name: string | null; contact_id: string | null; total_value: number | null; due_date: string | null; financial_due_date?: string | null }
interface EntryRow { id: string; order_id: string | null; value: number; value_paid: number }

export function FinancialIntegrityDialog({ open, onOpenChange, onChanged }: Props) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [shopeeCategories, setShopeeCategories] = useState<any[]>([]);
  const [shopeeContacts, setShopeeContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [ordersRes, entriesRes, categoriesRes, contactsRes] = await Promise.all([
      supabase.from('orders').select('id,order_number,customer_name,contact_id,total_value,due_date,financial_due_date').is('deleted_at', null),
      supabase.from('financial_entries').select('id,order_id,value,value_paid').eq('type', 'receber').not('order_id', 'is', null),
      supabase.from('financial_categories').select('id,name,type,is_active').ilike('name', '%shopee%'),
      supabase.from('contacts').select('id,name,type,is_active').ilike('name', '%shopee%'),
    ]);
    setOrders((ordersRes.data as any) || []); setEntries((entriesRes.data as any) || []);
    setShopeeCategories(categoriesRes.data || []); setShopeeContacts(contactsRes.data || []);
    setLoading(false);
  };
  useEffect(() => { if (open) load(); }, [open]);

  const byOrder = useMemo(() => new Map(entries.map(e => [e.order_id, e])), [entries]);
  const missing = orders.filter(o => Number(o.total_value) > 0 && !byOrder.has(o.id));
  const divergent = orders.filter(o => {
    const e = byOrder.get(o.id); return e && Math.abs(Number(o.total_value) - Number(e.value)) > .01;
  });

  const createReceivable = async (order: OrderRow) => {
    setFixing(order.id);
    try {
      const { data: category } = await supabase.from('financial_categories').select('id')
        .eq('is_active', true).in('type', ['receber', 'ambos']).in('name', ['Venda de produtos', 'Vendas']).limit(1).maybeSingle();
      const due = order.financial_due_date || order.due_date || new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('financial_entries').insert({
        type: 'receber', description: `Pedido ${order.order_number || order.id.slice(0, 8)} - ${order.customer_name || 'Cliente'}`,
        value: Number(order.total_value), due_date: due, original_due_date: due,
        order_id: order.id, contact_id: order.contact_id, category_id: category?.id || null,
        notes: 'Regularizado manualmente pela revisão de integração',
      } as any);
      if (error) throw error;
      toast.success('Conta a receber vinculada ao pedido.'); await load(); onChanged?.();
    } catch (e: any) { toast.error(e?.message || 'Não foi possível regularizar.'); }
    finally { setFixing(null); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl max-h-[90vh]">
      <DialogHeader><DialogTitle>Revisão de integração financeira</DialogTitle></DialogHeader>
      <Tabs defaultValue="pedidos">
        <TabsList><TabsTrigger value="pedidos">Pedidos</TabsTrigger><TabsTrigger value="cadastros">Shopee e cadastros</TabsTrigger></TabsList>
        <TabsContent value="pedidos" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Sem financeiro</div><div className="text-xl font-bold text-amber-600">{missing.length}</div></div>
            <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Valor divergente</div><div className="text-xl font-bold text-red-600">{divergent.length}</div></div>
          </div>
          <p className="text-xs text-muted-foreground">Nenhum registro é criado automaticamente. Confirme cada pedido após verificar se ele já foi recebido por outro lançamento.</p>
          <ScrollArea className="h-[420px] rounded-md border">
            {loading ? <div className="p-8 text-center"><Loader2 className="mx-auto animate-spin" /></div> : missing.map(order => <div key={order.id} className="flex items-center gap-3 border-b p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500" /><div className="min-w-0 flex-1"><div className="font-medium">{order.order_number} · {order.customer_name}</div><div className="text-xs text-muted-foreground">{formatCurrency(Number(order.total_value))} · sem conta a receber vinculada</div></div>
              <Button size="sm" variant="outline" disabled={fixing === order.id} onClick={() => createReceivable(order)}>{fixing === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar a receber'}</Button>
            </div>)}
            {!loading && !missing.length && <div className="p-8 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 text-emerald-500" />Todos os pedidos com valor possuem financeiro.</div>}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="cadastros" className="space-y-4">
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">Use “Shopee Marketplace” como contato institucional e “Venda de produtos” como categoria. Conta/responsável (Viviane, Adão etc.) deve ficar em Conta do marketplace, não no nome da categoria.</div>
          <div><h3 className="mb-2 text-sm font-semibold">Categorias Shopee para consolidar ({shopeeCategories.length})</h3><div className="flex flex-wrap gap-2">{shopeeCategories.map(c => <Badge key={c.id} variant="outline">{c.name}</Badge>)}</div></div>
          <div><h3 className="mb-2 text-sm font-semibold">Contatos Shopee para revisar ({shopeeContacts.length})</h3><div className="flex flex-wrap gap-2">{shopeeContacts.map(c => <Badge key={c.id} variant="outline">{c.name} · {c.type}</Badge>)}</div></div>
          <p className="text-xs text-muted-foreground">Esta tela não apaga o histórico. A consolidação será feita depois, com substituição dos vínculos e confirmação do usuário.</p>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>;
}
