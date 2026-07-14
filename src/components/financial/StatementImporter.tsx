import { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { FinancialAccount, FinancialCategory } from '@/hooks/useFinancial';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, Trash2, Loader2 } from 'lucide-react';
import { format, parse as parseDate, isValid } from 'date-fns';
import * as XLSX from 'xlsx';

export interface ParsedRow {
  id: string;
  selected: boolean;
  date: string; // yyyy-MM-dd
  description: string;
  type: 'entrada' | 'saida';
  value: number;
  categoryId?: string;
  status: string;
}

interface StatementImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  onImported?: () => void;
}

const ACCEPTED = '.csv,.xls,.xlsx,.txt,.ofx,.pdf';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeNumber(raw: string): number {
  if (!raw) return 0;
  let s = raw.trim().replace(/[R$\s]/g, '');
  const isNeg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()-]/g, '');
  if (s.includes(',') && s.includes('.')) {
    // Assume BR: 1.234,56
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return isNeg ? -n : n;
}

function tryParseDate(raw: string): string {
  if (!raw) return format(new Date(), 'yyyy-MM-dd');
  const s = raw.trim();
  const patterns = ['dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd', 'dd/MM/yy', 'yyyyMMdd', 'MM/dd/yyyy'];
  for (const p of patterns) {
    const d = parseDate(s, p, new Date());
    if (isValid(d)) return format(d, 'yyyy-MM-dd');
  }
  const d = new Date(s);
  if (isValid(d)) return format(d, 'yyyy-MM-dd');
  return format(new Date(), 'yyyy-MM-dd');
}

function toRow(date: string, description: string, value: number): ParsedRow {
  return {
    id: uid(),
    selected: true,
    date,
    description: description.trim(),
    type: value >= 0 ? 'entrada' : 'saida',
    value: Math.abs(value),
    status: 'Pendente',
  };
}

function parseCSVLike(text: string, delimiter?: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const delim = delimiter || (lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',');
  const rows: ParsedRow[] = [];
  // Detect header
  const first = lines[0].toLowerCase();
  const hasHeader = /data|date|descri|hist|valor|amount/.test(first);
  const start = hasHeader ? 1 : 0;
  let dateIdx = 0, descIdx = 1, valueIdx = 2;
  if (hasHeader) {
    const cols = lines[0].split(delim).map(c => c.toLowerCase().trim());
    cols.forEach((c, i) => {
      if (/data|date/.test(c)) dateIdx = i;
      else if (/descri|hist|memo|lanc/.test(c)) descIdx = i;
      else if (/valor|amount|montante|credito|debito/.test(c)) valueIdx = i;
    });
  }
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(delim);
    if (cols.length < 2) continue;
    const date = tryParseDate(cols[dateIdx] || '');
    const desc = (cols[descIdx] || '').replace(/^"|"$/g, '');
    const value = normalizeNumber(cols[valueIdx] || '0');
    if (!value && !desc) continue;
    rows.push(toRow(date, desc, value));
  }
  return rows;
}

function parseOFX(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const stmts = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  for (const s of stmts) {
    const amt = normalizeNumber((s.match(/<TRNAMT>([^<\r\n]+)/i)?.[1] || '0'));
    const dt = (s.match(/<DTPOSTED>([^<\r\n]+)/i)?.[1] || '').slice(0, 8);
    const memo = (s.match(/<MEMO>([^<\r\n]+)/i)?.[1] || '') || (s.match(/<NAME>([^<\r\n]+)/i)?.[1] || '');
    const date = dt.length === 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : tryParseDate(dt);
    rows.push(toRow(date, memo, amt));
  }
  return rows;
}

async function parseXLSX(file: File): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
  const csv = aoa.map(r => (r || []).map(c => (c == null ? '' : String(c))).join(';')).join('\n');
  return parseCSVLike(csv, ';');
}

async function parsePDF(file: File): Promise<ParsedRow[]> {
  const pdfjs: any = await import('pdfjs-dist/build/pdf.mjs');
  try {
    const workerSrc = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = '';
  }
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Group by y coordinate to form lines
    const items = content.items as any[];
    const linesMap = new Map<number, string[]>();
    for (const it of items) {
      const y = Math.round(it.transform[5]);
      if (!linesMap.has(y)) linesMap.set(y, []);
      linesMap.get(y)!.push(it.str);
    }
    const ys = Array.from(linesMap.keys()).sort((a, b) => b - a);
    for (const y of ys) text += linesMap.get(y)!.join(' ') + '\n';
  }
  const rows: ParsedRow[] = [];
  const re = /(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+(-?\(?R?\$?\s?[\d\.,]+\)?)\s*$/;
  for (const line of text.split(/\n/)) {
    const m = line.trim().match(re);
    if (!m) continue;
    rows.push(toRow(tryParseDate(m[1]), m[2], normalizeNumber(m[3])));
  }
  return rows;
}

async function parseFile(file: File): Promise<ParsedRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xls') || name.endsWith('.xlsx')) return parseXLSX(file);
  const text = await file.text();
  if (name.endsWith('.ofx')) return parseOFX(text);
  if (name.endsWith('.pdf')) return parsePDF(file);
  return parseCSVLike(text);
}

export function StatementImporter({ open, onOpenChange, accounts, categories, onImported }: StatementImporterProps) {
  const { toast } = useToast();
  const [accountId, setAccountId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeCategories = useMemo(() => categories.filter(c => c.is_active), [categories]);

  const reset = () => {
    setAccountId('');
    setFile(null);
    setRows([]);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleRead = async () => {
    if (!accountId) {
      toast({ title: 'Selecione uma conta', variant: 'destructive' });
      return;
    }
    if (!file) {
      toast({ title: 'Selecione um arquivo', variant: 'destructive' });
      return;
    }
    setReading(true);
    try {
      const parsed = await parseFile(file);
      if (!parsed.length) {
        toast({ title: 'Nenhum lançamento encontrado', description: 'Verifique o formato do arquivo.', variant: 'destructive' });
      }
      setRows(parsed);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao ler arquivo', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setReading(false);
    }
  };

  const updateRow = (id: string, patch: Partial<ParsedRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const allSelected = rows.length > 0 && rows.every(r => r.selected);
  const toggleAll = (checked: boolean) => setRows(prev => prev.map(r => ({ ...r, selected: checked })));

  const handleImport = async () => {
    const selected = rows.filter(r => r.selected);
    if (!selected.length) {
      toast({ title: 'Selecione ao menos um lançamento', variant: 'destructive' });
      return;
    }
    setImporting(true);
    try {
      const payload = selected.map(r => ({
        type: r.type === 'entrada' ? 'receber' : 'pagar',
        description: r.description || 'Importado do extrato',
        value: r.value,
        due_date: r.date,
        original_due_date: r.date,
        payment_date: r.date,
        account_id: accountId,
        category_id: r.categoryId || null,
        notes: 'Importado via extrato',
      }));
      const { data: inserted, error } = await supabase.from('financial_entries').insert(payload).select('id, value, account_id');
      if (error) throw error;
      // Register movements (payments) to mark as paid
      if (inserted?.length) {
        const movements = inserted.map(e => ({
          entry_id: e.id,
          account_id: e.account_id,
          value: e.value,
          movement_date: format(new Date(), 'yyyy-MM-dd'),
          notes: 'Importado via extrato',
        }));
        await supabase.from('financial_movements').insert(movements);
      }
      toast({ title: `${selected.length} lançamento(s) importado(s)` });
      onImported?.();
      handleClose();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao importar', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Importar Extrato
          </DialogTitle>
          <DialogDescription>
            Aceita CSV, XLS, XLSX, TXT, OFX e PDF com texto pesquisável.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Conta Financeira</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.is_active).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Arquivo</Label>
              <Input
                ref={fileRef}
                type="file"
                accept={ACCEPTED}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" /> {file.name}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleRead} disabled={reading}>
                {reading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Ler Arquivo
              </Button>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {rows.length} lançamento(s) encontrado(s). Revise antes de importar.
            </div>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
                    </TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox checked={r.selected} onCheckedChange={(v) => updateRow(r.id, { selected: !!v })} />
                      </TableCell>
                      <TableCell>
                        <Input type="date" value={r.date} onChange={(e) => updateRow(r.id, { date: e.target.value })} className="w-36" />
                      </TableCell>
                      <TableCell>
                        <Input value={r.description} onChange={(e) => updateRow(r.id, { description: e.target.value })} className="min-w-[200px]" />
                      </TableCell>
                      <TableCell>
                        <Select value={r.type} onValueChange={(v: any) => updateRow(r.id, { type: v })}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="entrada">Entrada</SelectItem>
                            <SelectItem value="saida">Saída</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={r.value}
                          onChange={(e) => updateRow(r.id, { value: parseFloat(e.target.value) || 0 })}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={r.categoryId || ''} onValueChange={(v) => updateRow(r.id, { categoryId: v })}>
                          <SelectTrigger className="w-40"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {activeCategories
                              .filter(c => c.type === 'ambos' || (r.type === 'entrada' ? c.type === 'receber' : c.type === 'pagar'))
                              .map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input value={r.status} onChange={(e) => updateRow(r.id, { status: e.target.value })} className="w-28" />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeRow(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Importar Selecionadas
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
