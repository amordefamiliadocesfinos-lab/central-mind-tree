import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; onChanged?: () => void }

export function MarketplaceSettlementDialog({ open, onOpenChange, onChanged }: Props) {
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [marketplace, setMarketplace] = useState('Shopee');
  const [marketplaceAccount, setMarketplaceAccount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fee, setFee] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!open) return; Promise.all([
    supabase.from('financial_entries').select('id,value,value_paid,marketplace_account,order:orders!inner(id,order_number,customer_name,channel)')
      .eq('type', 'receber').not('order_id', 'is', null),
    supabase.from('financial_accounts').select('id,name').eq('is_active', true).order('name'),
  ]).then(([e, a]) => {
    setEntries(((e.data as any[]) || []).filter(x => Number(x.value_paid) < Number(x.value) && ['marketplace', 'ecommerce'].includes(x.order?.channel)));
    setAccounts(a.data || []);
  }); }, [open]);

  const chosen = entries.filter(e => selected.has(e.id));
  const gross = useMemo(() => chosen.reduce((sum, e) => sum + Number(e.value) - Number(e.value_paid), 0), [chosen]);
  const net = Math.max(0, gross - fee);
  const toggle = (id: string) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const save = async () => {
    if (!accountId || !selected.size) return toast.error('Selecione os pedidos e a conta do recebimento.');
    setSaving(true);
    const { error } = await (supabase.rpc as any)('reconcile_marketplace_settlement', {
      p_payload: { marketplace, marketplace_account: marketplaceAccount || null, financial_account_id: accountId, settlement_date: date, fee_value: fee },
      p_entry_ids: Array.from(selected),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Repasse conciliado: líquido ${formatCurrency(net)}`);
    setSelected(new Set()); setFee(0); onChanged?.(); onOpenChange(false);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl max-h-[90vh]">
    <DialogHeader><DialogTitle>Conciliar repasse de marketplace</DialogTitle></DialogHeader>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div><Label>Marketplace</Label><Input value={marketplace} onChange={e => setMarketplace(e.target.value)} /></div>
      <div><Label>Conta/Responsável</Label><Input value={marketplaceAccount} onChange={e => setMarketplaceAccount(e.target.value)} placeholder="Ex.: Viviane" /></div>
      <div><Label>Data do repasse</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div><Label>Taxas descontadas</Label><Input type="number" min="0" step=".01" value={fee} onChange={e => setFee(Number(e.target.value))} /></div>
    </div>
    <div><Label>Conta bancária que recebeu</Label><Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
    <ScrollArea className="h-[330px] rounded-md border">
      {entries.map(e => <label key={e.id} className="flex items-center gap-3 border-b p-3 cursor-pointer hover:bg-muted/40">
        <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
        <div className="flex-1"><div className="font-medium">{e.order?.order_number} · {e.order?.customer_name}</div><div className="text-xs text-muted-foreground">{e.marketplace_account || 'Conta não informada'}</div></div>
        <strong>{formatCurrency(Number(e.value) - Number(e.value_paid))}</strong>
      </label>)}
      {!entries.length && <div className="p-8 text-center text-sm text-muted-foreground">Nenhum recebível de marketplace em aberto.</div>}
    </ScrollArea>
    <div className="flex items-center justify-between rounded-md bg-muted p-3"><span>Bruto {formatCurrency(gross)} · taxas {formatCurrency(fee)}</span><strong>Líquido {formatCurrency(net)}</strong></div>
    <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Conciliar repasse</Button></div>
  </DialogContent></Dialog>;
}
