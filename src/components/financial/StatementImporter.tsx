import { useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { FinancialAccount, FinancialCategory } from '@/hooks/useFinancial';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, Trash2, Loader2, AlertTriangle, CheckCircle2, XCircle, Sparkles, User, Package, X } from 'lucide-react';
import { format, parse as parseDate, isValid } from 'date-fns';
import * as XLSX from 'xlsx';

export type RowStatus = 'nova' | 'duplicada' | 'ja_importada' | 'erro';

export interface ParsedRow {
  id: string;
  selected: boolean;
  date: string; // yyyy-MM-dd
  description: string;
  type: 'entrada' | 'saida';
  value: number;
  categoryId?: string;
  contactId?: string;
  contactName?: string;
  orderId?: string;
  orderNumber?: string;
  status: RowStatus;
  statusMessage?: string;
  hash: string;
}

interface StatementImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  onImported?: () => void;
}

const ACCEPTED = '.csv,.xls,.xlsx,.txt,.ofx,.pdf';

// Keyword → category-name rules for simple auto-categorization
const KEYWORD_RULES: { pattern: RegExp; category: string; type?: 'entrada' | 'saida' }[] = [
  { pattern: /pix\s+recebid/i, category: 'Receita', type: 'entrada' },
  { pattern: /shopee/i, category: 'Marketplace' },
  { pattern: /mercado\s*livre|mercadolivre|mercadopago|mercado\s*pago/i, category: 'Marketplace' },
  { pattern: /uber|99\s*app|cabify/i, category: 'Transporte' },
  { pattern: /posto|combust[íi]vel|shell|ipiranga|petrobras/i, category: 'Combustível' },
  { pattern: /energia|cemig|light|enel|coelba|copel|celesc/i, category: 'Energia' },
  { pattern: /fornecedor/i, category: 'Fornecedor' },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeDescription(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function sha256(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeNumber(raw: string): number {
  if (!raw) return 0;
  let s = raw.trim().replace(/[R$\s]/g, '');
  const isNeg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()-]/g, '');
  if (s.includes(',') && s.includes('.')) {
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

function makeRow(date: string, description: string, value: number): Omit<ParsedRow, 'hash' | 'status'> {
  return {
    id: uid(),
    selected: true,
    date,
    description: description.trim(),
    type: value >= 0 ? 'entrada' : 'saida',
    value: Math.abs(value),
  };
}

function parseCSVLike(text: string, delimiter?: string): Omit<ParsedRow, 'hash' | 'status'>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const delim = delimiter || (lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',');
  const rows: Omit<ParsedRow, 'hash' | 'status'>[] = [];
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
    rows.push(makeRow(date, desc, value));
  }
  return rows;
}

function parseOFX(text: string): Omit<ParsedRow, 'hash' | 'status'>[] {
  const rows: Omit<ParsedRow, 'hash' | 'status'>[] = [];
  const stmts = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  for (const s of stmts) {
    const amt = normalizeNumber((s.match(/<TRNAMT>([^<\r\n]+)/i)?.[1] || '0'));
    const dt = (s.match(/<DTPOSTED>([^<\r\n]+)/i)?.[1] || '').slice(0, 8);
    const memo = (s.match(/<MEMO>([^<\r\n]+)/i)?.[1] || '') || (s.match(/<NAME>([^<\r\n]+)/i)?.[1] || '');
    const date = dt.length === 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : tryParseDate(dt);
    rows.push(makeRow(date, memo, amt));
  }
  return rows;
}

async function parseXLSX(file: File): Promise<Omit<ParsedRow, 'hash' | 'status'>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
  const csv = aoa.map(r => (r || []).map(c => (c == null ? '' : String(c))).join(';')).join('\n');
  return parseCSVLike(csv, ';');
}

async function parsePDF(file: File): Promise<Omit<ParsedRow, 'hash' | 'status'>[]> {
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
  const rows: Omit<ParsedRow, 'hash' | 'status'>[] = [];
  const re = /(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+(-?\(?R?\$?\s?[\d\.,]+\)?)\s*$/;
  for (const line of text.split(/\n/)) {
    const m = line.trim().match(re);
    if (!m) continue;
    rows.push(makeRow(tryParseDate(m[1]), m[2], normalizeNumber(m[3])));
  }
  return rows;
}

async function parseFile(file: File): Promise<Omit<ParsedRow, 'hash' | 'status'>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xls') || name.endsWith('.xlsx')) return parseXLSX(file);
  const text = await file.text();
  if (name.endsWith('.ofx')) return parseOFX(text);
  if (name.endsWith('.pdf')) return parsePDF(file);
  return parseCSVLike(text);
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function computeHashKey(accountId: string, r: { date: string; value: number; type: 'entrada' | 'saida'; description: string }): string {
  return [accountId, r.date, r.value.toFixed(2), r.type, normalizeDescription(r.description)].join('|');
}

function ContactCell({
  value,
  onChange,
}: {
  value?: { id: string; name: string };
  onChange: (v?: { id: string; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; type: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      let q = supabase
        .from('contacts')
        .select('id, name, type')
        .eq('is_active', true)
        .order('name')
        .limit(20);
      if (search.trim().length >= 2) {
        q = q.or(`name.ilike.%${search}%,fantasy_name.ilike.%${search}%,document.ilike.%${search}%`);
      }
      const { data } = await q;
      setResults((data as any) || []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [search, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start h-9 font-normal">
          {value ? (
            <span className="flex items-center gap-1 min-w-0">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{value.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> Cliente/Fornecedor
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar contato..." value={search} onValueChange={setSearch} />
          <CommandList>
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground text-center">Buscando...</div>
            ) : (
              <>
                {value && (
                  <CommandGroup>
                    <CommandItem
                      value="__clear__"
                      onSelect={() => {
                        onChange(undefined);
                        setOpen(false);
                      }}
                    >
                      <X className="h-3 w-3 mr-2" /> Remover vínculo
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup>
                  {results.length === 0 ? (
                    <CommandEmpty>Nenhum contato</CommandEmpty>
                  ) : (
                    results.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.id}
                        onSelect={() => {
                          onChange({ id: c.id, name: c.name });
                          setOpen(false);
                        }}
                      >
                        <User className="h-3 w-3 mr-2" />
                        <span className="truncate">{c.name}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">{c.type}</span>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OrderCell({
  value,
  contactId,
  onChange,
}: {
  value?: { id: string; number: string };
  contactId?: string;
  onChange: (v?: { id: string; number: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      let q = supabase
        .from('orders')
        .select('id, order_number, total_amount, order_date, contact:contacts(name)')
        .order('order_date', { ascending: false })
        .limit(20);
      if (contactId) q = q.eq('contact_id', contactId);
      if (search.trim().length >= 1) q = q.ilike('order_number', `%${search}%`);
      const { data } = await q;
      setResults((data as any) || []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [search, open, contactId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start h-9 font-normal">
          {value ? (
            <span className="flex items-center gap-1 min-w-0">
              <Package className="h-3 w-3 shrink-0" />
              <span className="truncate">#{value.number}</span>
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" /> Pedido
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-80" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nº do pedido..." value={search} onValueChange={setSearch} />
          <CommandList>
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground text-center">Buscando...</div>
            ) : (
              <>
                {value && (
                  <CommandGroup>
                    <CommandItem
                      value="__clear__"
                      onSelect={() => {
                        onChange(undefined);
                        setOpen(false);
                      }}
                    >
                      <X className="h-3 w-3 mr-2" /> Remover vínculo
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup>
                  {results.length === 0 ? (
                    <CommandEmpty>Nenhum pedido</CommandEmpty>
                  ) : (
                    results.map((o: any) => (
                      <CommandItem
                        key={o.id}
                        value={o.id}
                        onSelect={() => {
                          onChange({ id: o.id, number: o.order_number || o.id.slice(0, 6) });
                          setOpen(false);
                        }}
                      >
                        <Package className="h-3 w-3 mr-2" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">#{o.order_number} — {o.contact?.name || 'sem contato'}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {o.order_date} · R$ {Number(o.total_amount || 0).toFixed(2)}
                          </span>
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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

  const findCategoryByKeyword = (description: string, type: 'entrada' | 'saida'): string | undefined => {
    for (const rule of KEYWORD_RULES) {
      if (rule.pattern.test(description)) {
        const wanted = rule.category.toLowerCase();
        const wantedType = type === 'entrada' ? 'receber' : 'pagar';
        const match = activeCategories.find(c =>
          c.name.toLowerCase() === wanted &&
          (c.type === 'ambos' || c.type === wantedType)
        );
        if (match) return match.id;
      }
    }
    return undefined;
  };

  const reset = () => {
    setAccountId('');
    setFile(null);
    setRows([]);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const classifyRows = async (raw: Omit<ParsedRow, 'hash' | 'status'>[]): Promise<ParsedRow[]> => {
    const dates = raw.map(r => r.date).filter(Boolean);
    const minDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
    const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

    const hashes: string[] = [];
    const rowsWithHash = await Promise.all(raw.map(async r => {
      const h = await sha256(computeHashKey(accountId, r));
      hashes.push(h);
      return { ...r, hash: h };
    }));

    const [existingByRange, existingByHash, historyRes] = await Promise.all([
      minDate && maxDate
        ? supabase
            .from('financial_entries')
            .select('id, type, value, due_date, description, import_hash')
            .eq('account_id', accountId)
            .gte('due_date', minDate)
            .lte('due_date', maxDate)
        : Promise.resolve({ data: [] as any[], error: null }),
      supabase
        .from('financial_entries')
        .select('id, import_hash')
        .in('import_hash', hashes.length ? hashes : ['__none__']),
      supabase
        .from('financial_entries')
        .select('description, type, category_id, contact_id, contact:contacts(id, name)')
        .not('description', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(2000),
    ]);

    // Build suggestion maps from history
    const catFreq = new Map<string, Map<string, number>>();
    const contactFreq = new Map<string, Map<string, { count: number; name: string }>>();
    const tokenFreq = new Map<string, { cat: Map<string, number>; contact: Map<string, { count: number; name: string }> }>();

    for (const h of ((historyRes as any).data || []) as any[]) {
      const desc = normalizeDescription(h.description || '');
      if (!desc) continue;
      const typeKey = `${desc}|${h.type}`;
      if (h.category_id) {
        if (!catFreq.has(typeKey)) catFreq.set(typeKey, new Map());
        const m = catFreq.get(typeKey)!;
        m.set(h.category_id, (m.get(h.category_id) || 0) + 1);
      }
      if (h.contact_id) {
        if (!contactFreq.has(typeKey)) contactFreq.set(typeKey, new Map());
        const m = contactFreq.get(typeKey)!;
        const prev = m.get(h.contact_id);
        m.set(h.contact_id, { count: (prev?.count || 0) + 1, name: prev?.name || h.contact?.name || '' });
      }
      const tokens = desc.split(' ').filter(t => t.length >= 4);
      for (const t of tokens) {
        const key = `${t}|${h.type}`;
        if (!tokenFreq.has(key)) tokenFreq.set(key, { cat: new Map(), contact: new Map() });
        const entry = tokenFreq.get(key)!;
        if (h.category_id) entry.cat.set(h.category_id, (entry.cat.get(h.category_id) || 0) + 1);
        if (h.contact_id) {
          const prev = entry.contact.get(h.contact_id);
          entry.contact.set(h.contact_id, { count: (prev?.count || 0) + 1, name: prev?.name || h.contact?.name || '' });
        }
      }
    }

    const pickTopNum = (m: Map<string, number> | undefined): string | null => {
      if (!m || m.size === 0) return null;
      let bestK: string | null = null; let bestV = -1;
      for (const [k, v] of m) if (v > bestV) { bestK = k; bestV = v; }
      return bestK;
    };
    const pickTopContact = (m: Map<string, { count: number; name: string }> | undefined) => {
      if (!m || m.size === 0) return null;
      let best: [string, { count: number; name: string }] | null = null;
      for (const [k, v] of m) if (!best || v.count > best[1].count) best = [k, v];
      return best;
    };

    const suggestFor = (description: string, type: 'entrada' | 'saida') => {
      const desc = normalizeDescription(description);
      if (!desc) return {} as { categoryId?: string; contactId?: string; contactName?: string };
      const typeKey = `${desc}|${type}`;
      const out: { categoryId?: string; contactId?: string; contactName?: string } = {};
      const exactCat = pickTopNum(catFreq.get(typeKey));
      if (exactCat) out.categoryId = exactCat;
      const exactContact = pickTopContact(contactFreq.get(typeKey));
      if (exactContact) { out.contactId = exactContact[0]; out.contactName = exactContact[1].name; }

      if (!out.categoryId || !out.contactId) {
        const catAgg = new Map<string, number>();
        const contactAgg = new Map<string, { count: number; name: string }>();
        const tokens = desc.split(' ').filter(t => t.length >= 4);
        for (const t of tokens) {
          const entry = tokenFreq.get(`${t}|${type}`);
          if (!entry) continue;
          for (const [k, v] of entry.cat) catAgg.set(k, (catAgg.get(k) || 0) + v);
          for (const [k, v] of entry.contact) {
            const prev = contactAgg.get(k);
            contactAgg.set(k, { count: (prev?.count || 0) + v.count, name: prev?.name || v.name });
          }
        }
        if (!out.categoryId) {
          const t = pickTopNum(catAgg);
          if (t) out.categoryId = t;
        }
        if (!out.contactId) {
          const t = pickTopContact(contactAgg);
          if (t) { out.contactId = t[0]; out.contactName = t[1].name; }
        }
      }
      return out;
    };

    const importedHashSet = new Set(
      (existingByHash.data || []).map((e: any) => e.import_hash).filter(Boolean)
    );
    const existingList = (existingByRange.data || []) as any[];

    return rowsWithHash.map(r => {
      let status: RowStatus = 'nova';
      let statusMessage: string | undefined;

      if (!r.date || !r.value || r.value <= 0) {
        status = 'erro';
        statusMessage = !r.value ? 'Valor inválido' : 'Data inválida';
      } else if (importedHashSet.has(r.hash)) {
        status = 'ja_importada';
        statusMessage = 'Já importada anteriormente';
      } else {
        const dbType = r.type === 'entrada' ? 'receber' : 'pagar';
        const normDesc = normalizeDescription(r.description);
        const possible = existingList.find(e =>
          e.type === dbType &&
          e.due_date === r.date &&
          Math.abs(Number(e.value) - r.value) < 0.005 &&
          normalizeDescription(e.description || '') === normDesc
        );
        if (possible) {
          status = 'duplicada';
          statusMessage = 'Movimentação semelhante já existe';
        }
      }

      const historical = suggestFor(r.description, r.type);
      const categoryId = historical.categoryId || findCategoryByKeyword(r.description, r.type);

      return {
        ...r,
        status,
        statusMessage,
        categoryId,
        contactId: historical.contactId,
        contactName: historical.contactName,
        selected: status === 'nova' || status === 'duplicada',
        ...(status === 'ja_importada' || status === 'erro' ? { selected: false } : {}),
      };
    });
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
        setReading(false);
        return;
      }
      const classified = await classifyRows(parsed);
      // Ja importadas ficam desmarcadas por padrão; duplicadas com aviso mas selecionadas para decisão do usuário
      classified.forEach(r => {
        if (r.status === 'duplicada') r.selected = false; // deixa o usuário decidir
      });
      setRows(classified);
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

  const selectableRows = rows.filter(r => r.status !== 'erro');
  const allSelected = selectableRows.length > 0 && selectableRows.every(r => r.selected);
  const toggleAll = (checked: boolean) =>
    setRows(prev => prev.map(r => (r.status === 'erro' ? r : { ...r, selected: checked })));

  const counters = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc[r.status]++;
        return acc;
      },
      { nova: 0, duplicada: 0, ja_importada: 0, erro: 0 } as Record<RowStatus, number>
    );
  }, [rows]);

  const handleImport = async () => {
    const errors = rows.filter(r => r.selected && r.status === 'erro');
    if (errors.length) {
      toast({ title: 'Corrija as linhas com erro antes de importar', variant: 'destructive' });
      return;
    }
    const selected = rows.filter(r => r.selected);
    if (!selected.length) {
      toast({ title: 'Selecione ao menos um lançamento', variant: 'destructive' });
      return;
    }
    setImporting(true);
    const now = new Date().toISOString();
    const fileName = file?.name || '';
    const fileType = fileExtension(fileName);
    try {
      // Recompute hash from current row values (user may have edited)
      const enriched = await Promise.all(selected.map(async r => {
        const hash = await sha256(computeHashKey(accountId, r));
        return { r, hash };
      }));

      const payload = enriched.map(({ r, hash }) => ({
        type: r.type === 'entrada' ? 'receber' : 'pagar',
        description: r.description || 'Importado do extrato',
        value: r.value,
        due_date: r.date,
        original_due_date: r.date,
        payment_date: r.date,
        account_id: accountId,
        category_id: r.categoryId || null,
        contact_id: r.contactId || null,
        order_id: r.orderId || null,
        notes: 'Importado via extrato',
        import_source: 'extrato_arquivo',
        import_file_name: fileName,
        import_file_type: fileType,
        imported_at: now,
        imported_by: 'usuario',
        import_hash: hash,
      }));

      const { data: inserted, error } = await supabase
        .from('financial_entries')
        .insert(payload)
        .select('id, value, account_id, payment_date, due_date');
      if (error) throw error;

      if (inserted?.length) {
        const movements = inserted.map(e => ({
          entry_id: e.id,
          account_id: e.account_id,
          value: e.value,
          movement_date: e.payment_date || e.due_date,
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

  const statusBadge = (r: ParsedRow) => {
    switch (r.status) {
      case 'nova':
        return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Nova</Badge>;
      case 'duplicada':
        return <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600" title={r.statusMessage}><AlertTriangle className="h-3 w-3" /> Possível duplicada</Badge>;
      case 'ja_importada':
        return <Badge variant="outline" className="gap-1 text-muted-foreground" title={r.statusMessage}><CheckCircle2 className="h-3 w-3" /> Já importada</Badge>;
      case 'erro':
        return <Badge variant="destructive" className="gap-1" title={r.statusMessage}><XCircle className="h-3 w-3" /> Erro</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="max-w-[95vw] xl:max-w-[1400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Importar Extrato
          </DialogTitle>
          <DialogDescription>
            Aceita CSV, XLS, XLSX, TXT, OFX e PDF com texto pesquisável. Duplicidades são detectadas por conta, data, valor, tipo e descrição.
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
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{rows.length} lançamento(s):</span>
              <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {counters.nova} novas</Badge>
              <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600"><AlertTriangle className="h-3 w-3" /> {counters.duplicada} possíveis duplicadas</Badge>
              <Badge variant="outline" className="gap-1 text-muted-foreground"><CheckCircle2 className="h-3 w-3" /> {counters.ja_importada} já importadas</Badge>
              {counters.erro > 0 && (
                <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {counters.erro} com erro</Badge>
              )}
              <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Categorias sugeridas por palavras-chave
              </span>
            </div>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
                    </TableHead>
                    <TableHead className="min-w-[380px] w-[40%]">Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="min-w-[200px]">Cliente / Fornecedor</TableHead>
                    <TableHead className="min-w-[180px]">Pedido</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id} className={r.status === 'erro' ? 'bg-destructive/5' : r.status === 'duplicada' ? 'bg-amber-50 dark:bg-amber-950/20' : r.status === 'ja_importada' ? 'opacity-70' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={r.selected}
                          disabled={r.status === 'erro'}
                          onCheckedChange={(v) => updateRow(r.id, { selected: !!v })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.description}
                          onChange={(e) => updateRow(r.id, { description: e.target.value })}
                          className="w-full min-w-[360px] font-medium"
                          title={r.description}
                        />
                      </TableCell>
                      <TableCell>
                        <Input type="date" value={r.date} onChange={(e) => updateRow(r.id, { date: e.target.value })} className="w-36" />
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
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="Não definida" />
                          </SelectTrigger>
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
                        <ContactCell
                          value={r.contactId ? { id: r.contactId, name: r.contactName || '' } : undefined}
                          onChange={(c) => updateRow(r.id, { contactId: c?.id, contactName: c?.name, ...(c ? {} : { orderId: undefined, orderNumber: undefined }) })}
                        />
                      </TableCell>
                      <TableCell>
                        <OrderCell
                          value={r.orderId ? { id: r.orderId, number: r.orderNumber || '' } : undefined}
                          contactId={r.contactId}
                          onChange={(o) => updateRow(r.id, { orderId: o?.id, orderNumber: o?.number })}
                        />
                      </TableCell>
                      <TableCell>{statusBadge(r)}</TableCell>
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
