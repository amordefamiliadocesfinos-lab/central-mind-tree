import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Link2, Loader2, Upload, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { buildShopeePreview, parseShopeeShippingXlsx, type ShopeePreviewOrder, type ShopeeProductMapping, type ShopeeShippingOrder } from '@/lib/shopeeShippingXlsx';

type ProductOption = { id: string; name: string; sku: string };
type DraftMapping = { productId: string; multiplier: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
  accountSuggestions: string[];
}

export function ShopeeOrdersImportDialog({ open, onOpenChange, products, accountSuggestions }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState('');
  const [fileName, setFileName] = useState('');
  const [orders, setOrders] = useState<ShopeeShippingOrder[]>([]);
  const [mappings, setMappings] = useState<ShopeeProductMapping[]>([]);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, DraftMapping>>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const preview = useMemo(() => buildShopeePreview(orders, mappings, existingIds), [orders, mappings, existingIds]);
  const items = preview.flatMap(order => order.items.map(item => ({ order, item })));
  const recognized = items.filter(({ item }) => item.mappingStatus === 'recognized').length;
  const pending = items.length - recognized;
  const duplicates = preview.filter(order => order.duplicateStatus === 'already_imported').length;
  const ready = Boolean(account.trim() && preview.length && pending === 0);

  const loadPreviewContext = async (parsed: ShopeeShippingOrder[], selectedAccount: string) => {
    const keys = [...new Set(parsed.flatMap(order => order.items.map(item => item.externalItemKey)))];
    const ids = parsed.map(order => order.externalOrderId);
    const [maps, existing] = await Promise.all([
      (supabase as any).from('marketplace_product_mappings').select('external_item_key,product_id,physical_multiplier').eq('marketplace', 'shopee').eq('marketplace_account', selectedAccount).in('external_item_key', keys),
      supabase.from('orders').select('order_number,channel,marketplace_account').in('order_number', ids).is('deleted_at', null),
    ]);
    if (maps.error) throw maps.error;
    if (existing.error) throw existing.error;
    setMappings((maps.data || []) as ShopeeProductMapping[]);
    setExistingIds(new Set((existing.data || []).filter((order: any) => order.channel === 'shopee' && order.marketplace_account === selectedAccount).map((order: any) => order.order_number)));
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!account.trim()) { setError('Informe a conta Shopee antes de ler o arquivo.'); return; }
    setLoading(true); setError('');
    try {
      const parsed = await parseShopeeShippingXlsx(file, account.trim());
      await loadPreviewContext(parsed, account.trim());
      setOrders(parsed); setFileName(file.name); setDrafts({});
    } catch (reason: any) { setOrders([]); setFileName(''); setError(reason?.message || 'Não foi possível ler o arquivo Shopee.'); }
    finally { setLoading(false); }
  };

  const saveMapping = async (key: string) => {
    const draft = drafts[key]; const multiplier = Number(draft?.multiplier);
    if (!draft?.productId || !Number.isFinite(multiplier) || multiplier <= 0) { setError('Escolha um Produto Mestre e informe um multiplicador maior que zero.'); return; }
    setSavingKey(key); setError('');
    try {
      const source = items.find(({ item }) => item.externalItemKey === key)?.item;
      const { data, error: saveError } = await (supabase as any).from('marketplace_product_mappings').upsert({ marketplace: 'shopee', marketplace_account: account.trim(), external_item_key: key, external_product_title: source?.productTitle || null, external_variation: source?.variation || null, product_id: draft.productId, physical_multiplier: multiplier, updated_at: new Date().toISOString() }, { onConflict: 'marketplace,marketplace_account,external_item_key' }).select('external_item_key,product_id,physical_multiplier').single();
      if (saveError) throw saveError;
      setMappings(current => [...current.filter(mapping => mapping.external_item_key !== key), data as ShopeeProductMapping]);
    } catch (reason: any) { setError(reason?.message || 'Não foi possível salvar o mapeamento.'); }
    finally { setSavingKey(null); }
  };

  const close = (next: boolean) => { if (!next) { setOrders([]); setFileName(''); setError(''); } onOpenChange(next); };

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Importar pedidos Shopee</DialogTitle><DialogDescription>Prévia de pedidos enviados. Nenhum pedido ou saldo de estoque será alterado nesta etapa.</DialogDescription></DialogHeader>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div><Label>Conta Shopee</Label><Input list="shopee-accounts" value={account} onChange={event => setAccount(event.target.value)} placeholder="Ex.: Shopee Viviane" /><datalist id="shopee-accounts">{accountSuggestions.map(value => <option key={value} value={value} />)}</datalist></div>
        <div className="flex items-end"><Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={loading}><Upload className="mr-2 h-4 w-4" />{loading ? 'Lendo...' : 'Selecionar XLSX'}</Button><Input ref={inputRef} className="hidden" type="file" accept=".xlsx" onChange={event => handleFile(event.target.files?.[0])} /></div>
      </div>
      {fileName && <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileSpreadsheet className="h-4 w-4" />{fileName}</div>}
      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
      {preview.length > 0 && <>
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5"><Badge variant="secondary" className="justify-center py-2">{preview.length} pedidos</Badge><Badge variant="secondary" className="justify-center py-2">{items.length} itens</Badge><Badge className="justify-center py-2 bg-emerald-600">{recognized} reconhecidos</Badge><Badge variant="outline" className="justify-center py-2">{pending} para associar</Badge><Badge variant="outline" className="justify-center py-2">{duplicates} já importados</Badge></div>
        <div className="space-y-3">{preview.map(order => <div key={order.externalOrderId} className="rounded-lg border p-3"><div className="mb-2 flex flex-wrap items-center gap-2"><strong>Pedido {order.externalOrderId}</strong><Badge variant={order.duplicateStatus === 'already_imported' ? 'secondary' : 'outline'}>{order.duplicateStatus === 'already_imported' ? 'Já importado' : 'Novo'}</Badge><span className="text-xs text-muted-foreground">{order.customerName || 'Cliente não informado'} {order.trackingNumber ? `· Rastreio ${order.trackingNumber}` : ''}</span></div>{order.items.map(item => { const product = products.find(p => p.id === item.masterProductId); const draft = drafts[item.externalItemKey] || { productId: '', multiplier: '1' }; return <div key={`${order.externalOrderId}-${item.rowNumber}`} className="grid gap-2 border-t py-3 md:grid-cols-[minmax(180px,1.5fr)_110px_minmax(170px,1fr)_80px_auto]"><div><div className="font-medium text-sm">{item.productTitle}</div><div className="text-xs text-muted-foreground">{item.variation || 'Sem variação'} · chave {item.externalItemKey}</div></div><div className="text-sm">Qtd Shopee: <b>{item.quantity}</b></div>{item.mappingStatus === 'recognized' ? <div className="text-sm"><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />{product?.name || 'Produto mapeado'}<div className="text-xs text-muted-foreground">× {item.physicalMultiplier} = {item.physicalQuantity} físicas</div></div> : <><Select value={draft.productId} onValueChange={value => setDrafts(current => ({ ...current, [item.externalItemKey]: { ...draft, productId: value } }))}><SelectTrigger><SelectValue placeholder="Produto Mestre" /></SelectTrigger><SelectContent>{products.map(productOption => <SelectItem key={productOption.id} value={productOption.id}>{productOption.name}{productOption.sku ? ` · ${productOption.sku}` : ''}</SelectItem>)}</SelectContent></Select><Input type="number" min="0.0001" step="any" value={draft.multiplier} onChange={event => setDrafts(current => ({ ...current, [item.externalItemKey]: { ...draft, multiplier: event.target.value } }))} /><Button type="button" size="sm" onClick={() => saveMapping(item.externalItemKey)} disabled={savingKey === item.externalItemKey}>{savingKey === item.externalItemKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="mr-1 h-4 w-4" />Associar</>}</Button></>}</div>; })}</div>)}</div>
        <div className="rounded-md border bg-muted/40 p-3 text-sm"><strong>{ready ? 'Pronto para importar na próxima etapa' : 'Prévia ainda não está pronta'}</strong><div className="text-muted-foreground">{ready ? 'Todos os itens possuem Produto Mestre e multiplicador válidos. A confirmação definitiva continua fora do escopo desta OP-02.' : 'Associe todos os itens pendentes e confira a conta Shopee.'}</div></div>
      </>}
    </DialogContent>
  </Dialog>;
}
