import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Send, Ban, Search, Trash2, ExternalLink, ShieldCheck } from 'lucide-react';
import { formatDisplayDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import {
  validateInvoiceForIssue,
  OPERATION_NATURE_SUGGESTIONS,
  type FiscalValidationResult,
  type FiscalIssue,
} from '@/lib/invoiceValidation';
import { InvoiceValidationDialog } from './InvoiceValidationDialog';

type InvoiceType = 'NFe' | 'NFCe' | 'NFSe';
type InvoiceStatus = 'pendente' | 'pronta' | 'emitida' | 'cancelada';

interface Invoice {
  id: string;
  invoice_number: string | null;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  order_id: string | null;
  contact_id: string | null;
  customer_name: string | null;
  value: number;
  issue_date: string | null;
  access_key: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  operation_nature: string | null;
  created_at: string;
  orders?: { order_number: string | null; customer_name: string | null; total_value: number | null } | null;
  contacts?: { name: string } | null;
}

interface OrderOption {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  total_value: number | null;
  contact_id: string | null;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  pronta: { label: 'Pronta para emitir', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  emitida: { label: 'Emitida', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  cancelada: { label: 'Cancelada', className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
};

const TYPE_LABEL: Record<InvoiceType, string> = {
  NFe: 'NF-e',
  NFCe: 'NFC-e',
  NFSe: 'NFS-e',
};

const formatBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

export function InvoicesManager() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [issuingId, setIssuingId] = useState<string | null>(null);

  // Validation dialog state
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<FiscalValidationResult | null>(null);
  const [pendingIssueInvoice, setPendingIssueInvoice] = useState<Invoice | null>(null);

  // Form state
  const [form, setForm] = useState({
    order_id: '',
    contact_id: '',
    customer_name: '',
    value: '',
    invoice_type: 'NFe' as InvoiceType,
    status: 'pendente' as InvoiceStatus,
    invoice_number: '',
    operation_nature: '',
    notes: '',
  });

  const load = async () => {
    setLoading(true);
    const [invRes, ordRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, orders(order_number, customer_name, total_value), contacts(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id, order_number, customer_name, total_value, contact_id')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);
    if (invRes.error) {
      toast({ title: 'Erro ao carregar notas', description: invRes.error.message, variant: 'destructive' });
    } else {
      setInvoices((invRes.data || []) as any);
    }
    setOrders((ordRes.data || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    return {
      total: invoices.length,
      pendente: invoices.filter((i) => i.status === 'pendente').length,
      pronta: invoices.filter((i) => i.status === 'pronta').length,
      emitida: invoices.filter((i) => i.status === 'emitida').length,
      cancelada: invoices.filter((i) => i.status === 'cancelada').length,
      valorEmitido: invoices.filter((i) => i.status === 'emitida').reduce((s, i) => s + Number(i.value || 0), 0),
    };
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          i.invoice_number,
          i.customer_name,
          i.contacts?.name,
          i.orders?.order_number,
          i.orders?.customer_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, search]);

  const resetForm = () => {
    setForm({
      order_id: '',
      contact_id: '',
      customer_name: '',
      value: '',
      invoice_type: 'NFe',
      status: 'pendente',
      invoice_number: '',
      notes: '',
    });
    setEditing(null);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setForm({
      order_id: inv.order_id || '',
      contact_id: inv.contact_id || '',
      customer_name: inv.customer_name || '',
      value: String(inv.value || ''),
      invoice_type: inv.invoice_type,
      status: inv.status,
      invoice_number: inv.invoice_number || '',
      notes: inv.notes || '',
    });
    setDialogOpen(true);
  };

  const handleOrderSelect = (orderId: string) => {
    const o = orders.find((x) => x.id === orderId);
    setForm((f) => ({
      ...f,
      order_id: orderId,
      contact_id: o?.contact_id || f.contact_id,
      customer_name: o?.customer_name || f.customer_name,
      value: o?.total_value ? String(o.total_value) : f.value,
    }));
  };

  const save = async () => {
    if (!form.value || Number(form.value) <= 0) {
      toast({ title: 'Informe o valor da nota', variant: 'destructive' });
      return;
    }
    const payload = {
      order_id: form.order_id || null,
      contact_id: form.contact_id || null,
      customer_name: form.customer_name || null,
      value: Number(form.value),
      invoice_type: form.invoice_type,
      status: form.status,
      invoice_number: form.invoice_number || null,
      notes: form.notes || null,
    };
    const res = editing
      ? await supabase.from('invoices').update(payload).eq('id', editing.id)
      : await supabase.from('invoices').insert(payload);
    if (res.error) {
      toast({ title: 'Erro ao salvar', description: res.error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editing ? 'Nota atualizada' : 'Nota criada' });
    setDialogOpen(false);
    resetForm();
    load();
  };

  const issueInvoice = async (inv: Invoice) => {
    setIssuingId(inv.id);
    // Gera um número fictício (pode ser integrado a uma SEFAZ no futuro)
    const number = inv.invoice_number || `${inv.invoice_type}-${Date.now().toString().slice(-8)}`;
    const accessKey = `${Math.floor(Math.random() * 1e44).toString().padStart(44, '0')}`;
    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'emitida',
        invoice_number: number,
        access_key: accessKey,
        issue_date: new Date().toISOString().slice(0, 10),
      })
      .eq('id', inv.id);
    setIssuingId(null);
    if (error) {
      toast({ title: 'Erro ao emitir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Nota emitida', description: `Número: ${number}` });
    load();
  };

  const cancelInvoice = async (inv: Invoice) => {
    const reason = window.prompt('Motivo do cancelamento:');
    if (!reason) return;
    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'cancelada',
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', inv.id);
    if (error) {
      toast({ title: 'Erro ao cancelar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Nota cancelada' });
    load();
  };

  const removeInvoice = async (inv: Invoice) => {
    if (!window.confirm('Remover esta nota? Esta ação não pode ser desfeita.')) return;
    const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Nota removida' });
    load();
  };

  return (
    <div className="space-y-4">
      {/* Header + KPIs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              🧾 Nota Fiscal
            </CardTitle>
            <Button onClick={openNew} className="gap-2">
              <Send className="h-4 w-4" />
              Emitir Nota Fiscal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { key: 'total', label: 'Total', value: counts.total, color: 'text-foreground' },
              { key: 'pendente', label: 'Pendentes', value: counts.pendente, color: 'text-amber-600' },
              { key: 'pronta', label: 'Prontas', value: counts.pronta, color: 'text-blue-600' },
              { key: 'emitida', label: 'Emitidas', value: counts.emitida, color: 'text-emerald-600' },
              { key: 'cancelada', label: 'Canceladas', value: counts.cancelada, color: 'text-red-600' },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key === 'total' ? 'all' : (s.key as InvoiceStatus))}
                className={cn(
                  'rounded-lg border p-2.5 text-left transition-all hover:shadow-md',
                  (statusFilter === s.key || (s.key === 'total' && statusFilter === 'all')) &&
                    'ring-2 ring-primary'
                )}
              >
                <div className={cn('text-2xl font-bold leading-none', s.color)}>{s.value}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{s.label}</div>
              </button>
            ))}
          </div>
          {counts.valorEmitido > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              Total emitido: <span className="font-semibold text-foreground">{formatBRL(counts.valorEmitido)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, cliente ou pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pronta">Pronta para emitir</SelectItem>
            <SelectItem value="emitida">Emitida</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      Nenhuma nota fiscal encontrada
                      <div className="mt-3">
                        <Button variant="outline" size="sm" onClick={openNew} className="gap-2">
                          <Plus className="h-4 w-4" />
                          Criar primeira nota
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((inv) => {
                    const cfg = STATUS_CONFIG[inv.status];
                    const orderNum = inv.orders?.order_number || (inv.order_id ? '—' : '—');
                    const clientName = inv.contacts?.name || inv.customer_name || inv.orders?.customer_name || '—';
                    return (
                      <TableRow key={inv.id} className="cursor-pointer" onClick={() => openEdit(inv)}>
                        <TableCell className="font-mono text-xs">
                          {inv.invoice_number || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{TYPE_LABEL[inv.invoice_type]}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{orderNum}</TableCell>
                        <TableCell className="text-sm font-medium">{clientName}</TableCell>
                        <TableCell className="text-right font-semibold">{formatBRL(Number(inv.value))}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inv.issue_date ? formatDisplayDate(inv.issue_date) : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('whitespace-nowrap', cfg.className)}>
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {(inv.status === 'pendente' || inv.status === 'pronta') && (
                              <Button
                                size="sm"
                                variant="default"
                                disabled={issuingId === inv.id}
                                onClick={() => issueInvoice(inv)}
                                className="gap-1 h-8"
                              >
                                <Send className="h-3 w-3" />
                                Emitir
                              </Button>
                            )}
                            {inv.status === 'emitida' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelInvoice(inv)}
                                className="gap-1 h-8 text-red-600 hover:text-red-700"
                              >
                                <Ban className="h-3 w-3" />
                                Cancelar
                              </Button>
                            )}
                            {inv.pdf_url && (
                              <Button size="icon" variant="ghost" asChild className="h-8 w-8">
                                <a href={inv.pdf_url} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeInvoice(inv)}
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.invoice_type} onValueChange={(v: InvoiceType) => setForm({ ...form, invoice_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NFe">NF-e (Produto)</SelectItem>
                    <SelectItem value="NFCe">NFC-e (Consumidor)</SelectItem>
                    <SelectItem value="NFSe">NFS-e (Serviço)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: InvoiceStatus) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pronta">Pronta para emitir</SelectItem>
                    <SelectItem value="emitida">Emitida</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Pedido vinculado (opcional)</Label>
              <Select value={form.order_id || 'none'} onValueChange={(v) => v === 'none' ? setForm({ ...form, order_id: '' }) : handleOrderSelect(v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar pedido" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.order_number || o.id.slice(0, 8)} — {o.customer_name || 'Sem cliente'} {o.total_value ? `(${formatBRL(Number(o.total_value))})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cliente</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div>
              <Label>Número da nota (se já houver)</Label>
              <Input
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                placeholder="Ex.: 000123"
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? 'Salvar' : 'Criar nota'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
