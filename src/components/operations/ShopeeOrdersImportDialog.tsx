import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Link2, Loader2, Pencil, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { buildShopeePreview, parseShopeeShippingXlsx, type ShopeePreviewItem, type ShopeeProductMapping, type ShopeeShippingOrder } from '@/lib/shopeeShippingXlsx';

type ProductOption = { id: string; name: string; sku: string };
type DraftMapping = { productId: string; multiplier: string };
type ImportFailure = { orderNumber: string; reason: string };
type ImportSummary = { processed: number; created: number; alreadyImported: number; movementCount: number; failures: ImportFailure[] };

interface Props { open: boolean; onOpenChange: (open: boolean) => void; products: ProductOption[]; accountSuggestions: string[]; onImported?: () => void; }

const validMultiplier = (value: string) => { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; };

export function ShopeeOrdersImportDialog({ open, onOpenChange, products, accountSuggestions, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState('');
  const [fileName, setFileName] = useState('');
  const [orders, setOrders] = useState<ShopeeShippingOrder[]>([]);
  const [mappings, setMappings] = useState<ShopeeProductMapping[]>([]);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, DraftMapping>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState('');

  const preview = useMemo(() => buildShopeePreview(orders, mappings, existingIds), [orders, mappings, existingIds]);
  const items = preview.flatMap(order => order.items.map(item => ({ order, item })));
  const recognized = items.filter(({ item }) => item.mappingStatus === 'recognized').length;
  const pending = items.length - recognized;
  const duplicates = preview.filter(order => order.duplicateStatus === 'already_imported').length;
  const newOrders = preview.filter(order => order.duplicateStatus === 'new');
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
    setLoading(true); setError(''); setSummary(null); setEditingKey(null);
    try { const parsed = await parseShopeeShippingXlsx(file, account.trim()); await loadPreviewContext(parsed, account.trim()); setOrders(parsed); setFileName(file.name); setDrafts({}); }
    catch (reason: any) { setOrders([]); setFileName(''); setError(reason?.message || 'Não foi possível ler o arquivo Shopee.'); }
    finally { setLoading(false); }
  };

  const draftFor = (item: ShopeePreviewItem): DraftMapping => drafts[item.externalItemKey] || { productId: item.masterProductId || '', multiplier: item.physicalMultiplier ? String(item.physicalMultiplier) : '1' };
  const updateDraft = (key: string, patch: Partial<DraftMapping>, fallback: DraftMapping) => setDrafts(current => ({ ...current, [key]: { ...(current[key] || fallback), ...patch } }));

  const applyMapping = (key: string, persist: boolean) => {
    const draft = drafts[key]; const multiplier = validMultiplier(draft?.multiplier || '');
    if (!draft?.productId || !multiplier) { setError('Escolha um Produto Mestre e informe um multiplicador maior que zero.'); return; }
    const source = items.find(({ item }) => item.externalItemKey === key)?.item;
    if (!source) return;
    const nextMapping: ShopeeProductMapping = { external_item_key: key, product_id: draft.productId, physical_multiplier: multiplier };
    const applyLocally = () => { setMappings(current => [...current.filter(mapping => mapping.external_item_key !== key), nextMapping]); setDrafts(current => { const next = { ...current }; delete next[key]; return next; }); setEditingKey(null); };
    if (!persist) { applyLocally(); return; }
    setSavingKey(key); setError('');
    (async () => {
      try {
        const { data, error: saveError } = await (supabase as any).from('marketplace_product_mappings').upsert({ marketplace: 'shopee', marketplace_account: account.trim(), external_item_key: key, external_product_title: source.productTitle || null, external_variation: source.variation || null, product_id: draft.productId, physical_multiplier: multiplier, updated_at: new Date().toISOString() }, { onConflict: 'marketplace,marketplace_account,external_item_key' }).select('external_item_key,product_id,physical_multiplier').single();
        if (saveError) throw saveError;
        setMappings(current => [...current.filter(mapping => mapping.external_item_key !== key), data as ShopeeProductMapping]);
        setDrafts(current => { const next = { ...current }; delete next[key]; return next; }); setEditingKey(null);
      } catch (reason: any) { setError(reason?.message || 'Não foi possível salvar o mapeamento.'); }
      finally { setSavingKey(null); }
    })();
  };

  const confirmImport = async () => {
    if (!ready) return;
    setConfirming(true); setError(''); setSummary(null);
    const result: ImportSummary = { processed: newOrders.length, created: 0, alreadyImported: duplicates, movementCount: 0, failures: [] };
    for (const order of newOrders) {
      try {
        const { data, error: importError } = await (supabase.rpc as any)('import_shopee_order_with_stock', { p_order: { external_order_id: order.externalOrderId, marketplace_account: account.trim(), external_status: order.externalStatus, tracking_number: order.trackingNumber, order_date: order.createdAt, customer_name: order.customerName, address: order.address }, p_items: order.items.map(item => ({ product_id: item.masterProductId, quantity: item.physicalQuantity, commercial_quantity: item.quantity, physical_multiplier: item.physicalMultiplier, unit_price: item.unitPrice, external_item_key: item.externalItemKey, product_title: item.productTitle, variation: item.variation })) });
        if (importError) throw importError;
        if (data?.already_imported) result.alreadyImported += 1; else { result.created += 1; result.movementCount += Number(data?.movement_count || 0); }
      } catch (reason: any) { result.failures.push({ orderNumber: order.externalOrderId, reason: reason?.message || 'Erro inesperado ao importar.' }); }
    }
    setSummary(result); setShowConfirm(false); setConfirming(false); await loadPreviewContext(orders, account.trim()); onImported?.();
  };

  const close = (next: boolean) => { if (!next) { setOrders([]); setFileName(''); setError(''); setSummary(null); setEditingKey(null); } onOpenChange(next); };

  return <><Dialog open={open} onOpenChange={close}><DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Importar pedidos Shopee</DialogTitle><DialogDescription>Revise os itens antes de confirmar. A baixa física será feita pelo contrato oficial Pedido → Estoque.</DialogDescription></DialogHeader>
    <div className="grid gap-3 md:grid-cols-[1fr_auto]"><div><Label>Conta Shopee</Label><Input list="shopee-accounts" value={account} onChange={event => setAccount(event.target.value)} placeholder="Ex.: Shopee Viviane" disabled={Boolean(orders.length)} /><datalist id="shopee-accounts">{accountSuggestions.map(value => <option key={value} value={value} />)}</datalist></div><div className="flex items-end"><Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={loading || confirming}><Upload className="mr-2 h-4 w-4" />{loading ? 'Lendo...' : 'Selecionar XLSX'}</Button><Input ref={inputRef} className="hidden" type="file" accept=".xlsx" onChange={event => handleFile(event.target.files?.[0])} /></div></div>
    {fileName && <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileSpreadsheet className="h-4 w-4" />{fileName}</div>}
    {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
    {preview.length > 0 && <><div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5"><Badge variant="secondary" className="justify-center py-2">{preview.length} pedidos</Badge><Badge variant="secondary" className="justify-center py-2">{items.length} itens</Badge><Badge className="justify-center py-2 bg-emerald-600">{recognized} reconhecidos</Badge><Badge variant="outline" className="justify-center py-2">{pending} para associar</Badge><Badge variant="outline" className="justify-center py-2">{duplicates} já importados</Badge></div>
      <div className="space-y-3">{preview.map(order => <div key={order.externalOrderId} className="rounded-lg border p-3"><div className="mb-2 flex flex-wrap items-center gap-2"><strong>Pedido {order.externalOrderId}</strong><Badge variant={order.duplicateStatus === 'already_imported' ? 'secondary' : 'outline'}>{order.duplicateStatus === 'already_imported' ? 'Já importado' : 'Novo'}</Badge><span className="text-xs text-muted-foreground">{order.customerName || 'Cliente não informado'} {order.trackingNumber ? `· Rastreio ${order.trackingNumber}` : ''}</span></div>{order.items.map(item => { const product = products.find(p => p.id === item.masterProductId); const draft = draftFor(item); const isEditing = editingKey === item.externalItemKey || item.mappingStatus !== 'recognized'; const physical = validMultiplier(draft.multiplier) ? item.quantity * Number(draft.multiplier) : null; return <div key={`${order.externalOrderId}-${item.rowNumber}`} className="grid gap-2 border-t py-3 md:grid-cols-[minmax(180px,1.5fr)_110px_minmax(170px,1fr)_80px_auto]"><div><div className="font-medium text-sm">{item.productTitle}</div><div className="text-xs text-muted-foreground">{item.variation || 'Sem variação'} · chave {item.externalItemKey}</div></div><div className="text-sm">Qtd Shopee: <b>{item.quantity}</b></div>{isEditing ? <><Select value={draft.productId} onValueChange={value => updateDraft(item.externalItemKey, { productId: value }, draft)}><SelectTrigger><SelectValue placeholder="Produto Mestre" /></SelectTrigger><SelectContent>{products.map(option => <SelectItem key={option.id} value={option.id}>{option.name}{option.sku ? ` · ${option.sku}` : ''}</SelectItem>)}</SelectContent></Select><div><Input type="number" min="0.0001" step="any" value={draft.multiplier} onChange={event => updateDraft(item.externalItemKey, { multiplier: event.target.value }, draft)} /><div className="mt-1 text-xs text-muted-foreground">{physical ? `${item.quantity} × ${draft.multiplier} = ${physical} físicas` : 'Informe multiplicador válido'}</div></div><div className="flex flex-wrap gap-1 md:col-span-2"><Button type="button" size="sm" variant="outline" onClick={() => { setEditingKey(null); setDrafts(current => { const next = { ...current }; delete next[item.externalItemKey]; return next; }); }}>Cancelar</Button><Button type="button" size="sm" variant="secondary" onClick={() => applyMapping(item.externalItemKey, false)}>Só nesta importação</Button><Button type="button" size="sm" onClick={() => applyMapping(item.externalItemKey, true)} disabled={savingKey === item.externalItemKey}>{savingKey === item.externalItemKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="mr-1 h-4 w-4" />Salvar padrão</>}</Button></div></> : <><div className="text-sm"><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />{product?.name || 'Produto mapeado'}<div className="text-xs text-muted-foreground">× {item.physicalMultiplier} = {item.physicalQuantity} físicas</div></div><div className="md:col-span-2"><Button type="button" size="sm" variant="outline" onClick={() => { setEditingKey(item.externalItemKey); setDrafts(current => ({ ...current, [item.externalItemKey]: { productId: item.masterProductId || '', multiplier: String(item.physicalMultiplier || 1) } })); }}><Pencil className="mr-1 h-4 w-4" />Editar associação</Button></div></>}</div>; })}</div>)}</div>
      <div className="rounded-md border bg-muted/40 p-3 text-sm"><strong>{ready ? 'Pronto para confirmar a importação' : 'Prévia ainda não está pronta'}</strong><div className="text-muted-foreground">{ready ? 'A confirmação criará pedidos enviados e aplicará a saída física idempotente pelo contrato Pedido → Estoque.' : 'Associe todos os itens pendentes e confira a conta Shopee.'}</div></div>
      {summary && <div className="rounded-md border p-3 text-sm"><strong>Importação concluída</strong><div>{summary.processed} pedidos processados · {summary.created} criados · {summary.alreadyImported} já importados · {summary.movementCount} movimentações de estoque</div>{summary.failures.length > 0 && <ul className="mt-2 list-disc pl-5 text-destructive">{summary.failures.map(failure => <li key={failure.orderNumber}>{failure.orderNumber}: {failure.reason}</li>)}</ul>}</div>}
      <div className="flex justify-end gap-2 border-t pt-3"><Button variant="outline" onClick={() => close(false)} disabled={confirming}>Cancelar</Button><Button onClick={() => setShowConfirm(true)} disabled={!ready || confirming}>{confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar importação</Button></div></>}
  </DialogContent></Dialog>
  <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar importação de {newOrders.length} pedidos Shopee?</AlertDialogTitle><AlertDialogDescription>{items.length} itens serão registrados em Operações. Os pedidos enviados provocarão saída física pelo contrato oficial, com proteção contra duplicidade.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={confirming}>Voltar</AlertDialogCancel><AlertDialogAction onClick={event => { event.preventDefault(); confirmImport(); }} disabled={confirming}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
