import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Users, X, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { LeadOriginPicker } from '@/components/crm/LeadOriginPicker';

interface LeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelStages: { key: string; label: string }[];
  onImported?: () => void;
}

type FieldKey = 'ignore' | 'name' | 'whatsapp' | 'email' | 'city' | 'company_name' | 'notes';

const FIELD_OPTIONS: { value: FieldKey; label: string }[] = [
  { value: 'ignore', label: '— Ignorar —' },
  { value: 'name', label: 'Nome do Lead' },
  { value: 'whatsapp', label: 'WhatsApp / Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'city', label: 'Cidade' },
  { value: 'company_name', label: 'Empresa' },
  { value: 'notes', label: 'Observações' },
];

function autoMap(header: string): FieldKey {
  const h = header.toLowerCase().trim();
  if (/(nome|name|cliente|contato)/.test(h) && !/empresa|fantas/.test(h)) return 'name';
  if (/(whats|telefone|celular|phone|fone|tel)/.test(h)) return 'whatsapp';
  if (/(e[-_ ]?mail|email)/.test(h)) return 'email';
  if (/(cidade|city|municip)/.test(h)) return 'city';
  if (/(empresa|company|raz[aã]o|fantas)/.test(h)) return 'company_name';
  if (/(obs|notas|note|coment)/.test(h)) return 'notes';
  return 'ignore';
}

function normalizePhone(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\D/g, '');
}

const TEMPLATE_HEADERS = ['Nome', 'Telefone/WhatsApp', 'E-mail', 'Cidade', 'Empresa', 'Observações'];

const TEMPLATE_EXAMPLE_ROWS = [
  ['João Silva', '(11) 98765-4321', 'joao@email.com', 'São Paulo', 'Silva Ltda', 'Cliente indicado por parceiro'],
  ['Maria Souza', '(21) 91234-5678', 'maria@email.com', 'Rio de Janeiro', '', 'Interessada em orçamento'],
  ['Carlos Pereira', '(31) 99876-5432', 'carlos@empresa.com.br', 'Belo Horizonte', 'Pereira & Cia', ''],
];

function downloadTemplateXLSX() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE_ROWS]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo_importacao_leads.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('Modelo XLSX baixado');
}

function downloadTemplateCSV() {
  const csvContent = [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE_ROWS]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo_importacao_leads.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('Modelo CSV baixado');
}

export function LeadImportDialog({ open, onOpenChange, funnelStages, onImported }: LeadImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'importing' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, FieldKey>>({});
  const [stage, setStage] = useState<string>('novo_lead');
  const [assignedTo, setAssignedTo] = useState<string>('none');
  const [origin, setOrigin] = useState<string>('Importação');
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState({ imported: 0, duplicated: 0, errors: 0 });

  useEffect(() => {
    if (!open) return;
    supabase.from('app_users').select('id,name').eq('is_active', true).order('name').then(({ data }) => {
      setUsers((data || []) as any);
    });
  }, [open]);

  const reset = () => {
    setStep('upload');
    setFileName(''); setHeaders([]); setRows([]); setMapping({});
    setStage('novo_lead'); setAssignedTo('none'); setOrigin('Importação'); setProgress(0);
    setReport({ imported: 0, duplicated: 0, errors: 0 });
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => { reset(); onOpenChange(false); };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: false });
      if (!json.length) { toast.error('Planilha vazia'); return; }
      const hs = Object.keys(json[0]);
      const map: Record<string, FieldKey> = {};
      hs.forEach(h => { map[h] = autoMap(h); });
      setFileName(file.name);
      setHeaders(hs); setRows(json); setMapping(map);
      setStep('map');
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao ler arquivo: ' + e.message);
    }
  };

  const mappedHas = (key: FieldKey) => Object.values(mapping).includes(key);
  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const getVal = (row: Record<string, any>, field: FieldKey) => {
    const col = Object.keys(mapping).find(k => mapping[k] === field);
    if (!col) return '';
    const v = row[col];
    return v === null || v === undefined ? '' : String(v).trim();
  };

  const runImport = async () => {
    if (!mappedHas('name') && !mappedHas('whatsapp')) {
      toast.error('Mapeie ao menos Nome ou WhatsApp');
      return;
    }
    setStep('importing');
    setProgress(0);

    // Fetch existing phones for duplicate check
    const { data: existing } = await supabase
      .from('contacts')
      .select('whatsapp,phone,mobile')
      .eq('is_active', true);
    const existingPhones = new Set<string>();
    (existing || []).forEach((c: any) => {
      [c.whatsapp, c.phone, c.mobile].forEach(p => {
        const n = normalizePhone(p);
        if (n.length >= 8) existingPhones.add(n);
      });
    });

    let imported = 0, duplicated = 0, errors = 0;
    const batchSize = 100;
    const seenInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const inserts: any[] = [];

      for (const row of slice) {
        const name = getVal(row, 'name');
        const phoneRaw = getVal(row, 'whatsapp');
        const phone = normalizePhone(phoneRaw);
        const email = getVal(row, 'email');

        if (!name && !phone && !email) continue;

        if (phone && phone.length >= 8) {
          if (existingPhones.has(phone) || seenInBatch.has(phone)) {
            duplicated++;
            continue;
          }
          seenInBatch.add(phone);
        }

        inserts.push({
          name: name || phoneRaw || email || 'Sem nome',
          whatsapp: phoneRaw || null,
          phone: phoneRaw || null,
          email: email || null,
          city: getVal(row, 'city') || null,
          company_name: getVal(row, 'company_name') || null,
          notes: getVal(row, 'notes') || null,
          funnel_status: stage,
          type: 'cliente',
          person_type: 'fisica',
          credit_limit_type: 'unlimited',
          temperatura_lead: 'morno',
          is_active: true,
          salesperson: assignedTo !== 'none' ? assignedTo : null,
          origem_lead: origin?.trim() || 'Não Informado',
        });
      }

      if (inserts.length) {
        const { error, data } = await supabase.from('contacts').insert(inserts).select('id');
        if (error) {
          console.error('Import batch error:', error);
          errors += inserts.length;
        } else {
          imported += data?.length || 0;
        }
      }
      setProgress(Math.round(((i + slice.length) / rows.length) * 100));
    }

    setReport({ imported, duplicated, errors });
    setStep('done');
    onImported?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Importar Leads
          </DialogTitle>
          <DialogDescription>
            Envie um arquivo XLSX, XLS ou CSV para cadastrar leads em massa no CRM.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <Card
              className="border-2 border-dashed p-10 text-center cursor-pointer hover:bg-muted/40 transition"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Clique ou arraste um arquivo aqui</p>
              <p className="text-sm text-muted-foreground mt-1">Formatos aceitos: .xlsx, .xls, .csv</p>
            </Card>
            <input
              ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
              💡 Dica: a primeira linha deve conter os títulos das colunas (Nome, Telefone, E-mail, Cidade, Empresa, Observações).
            </div>
            <div className="border rounded-md p-4 space-y-3">
              <p className="text-sm font-medium">Baixar modelo de planilha</p>
              <p className="text-xs text-muted-foreground">
                Use o modelo abaixo para garantir que suas colunas sejam reconhecidas automaticamente pelo sistema.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadTemplateXLSX}>
                  <Download className="h-4 w-4 mr-1" /> Modelo .xlsx
                </Button>
                <Button variant="outline" size="sm" onClick={downloadTemplateCSV}>
                  <Download className="h-4 w-4 mr-1" /> Modelo .csv
                </Button>
              </div>
              <div className="border rounded-md overflow-x-auto mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      {TEMPLATE_HEADERS.map(h => <th key={h} className="text-left p-2 whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {TEMPLATE_EXAMPLE_ROWS.map((row, i) => (
                      <tr key={i} className="border-t">
                        {row.map((cell, j) => <td key={j} className="p-2 whitespace-nowrap text-muted-foreground">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="secondary">{rows.length} linhas</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}><X className="h-4 w-4" /></Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Etapa do funil</label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {funnelStages.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Responsável</label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem responsável —</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Mapeamento de Colunas</h4>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="text-left p-2">Coluna da planilha</th>
                      <th className="text-left p-2">Campo no CRM</th>
                      <th className="text-left p-2">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map(h => (
                      <tr key={h} className="border-t">
                        <td className="p-2 font-medium">{h}</td>
                        <td className="p-2">
                          <Select value={mapping[h]} onValueChange={(v) => setMapping(m => ({ ...m, [h]: v as FieldKey }))}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {FIELD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2 text-muted-foreground truncate max-w-[200px]">{String(rows[0]?.[h] ?? '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Pré-visualização (primeiras 5 linhas)</h4>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">WhatsApp</th>
                      <th className="text-left p-2">E-mail</th>
                      <th className="text-left p-2">Cidade</th>
                      <th className="text-left p-2">Empresa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{getVal(r, 'name')}</td>
                        <td className="p-2">{getVal(r, 'whatsapp')}</td>
                        <td className="p-2">{getVal(r, 'email')}</td>
                        <td className="p-2">{getVal(r, 'city')}</td>
                        <td className="p-2">{getVal(r, 'company_name')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={runImport} className="bg-green-600 hover:bg-green-700">
                <Users className="h-4 w-4 mr-1" /> Importar {rows.length} leads
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-10 space-y-4 text-center">
            <p className="font-medium">Importando leads...</p>
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === 'done' && (
          <div className="py-6 space-y-4">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-2" />
              <h3 className="text-lg font-semibold">Importação concluída</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4 text-center">
                <Users className="h-5 w-5 mx-auto text-green-600 mb-1" />
                <p className="text-2xl font-bold text-green-600">{report.imported}</p>
                <p className="text-xs text-muted-foreground">Importados</p>
              </Card>
              <Card className="p-4 text-center">
                <AlertCircle className="h-5 w-5 mx-auto text-amber-600 mb-1" />
                <p className="text-2xl font-bold text-amber-600">{report.duplicated}</p>
                <p className="text-xs text-muted-foreground">Duplicados</p>
              </Card>
              <Card className="p-4 text-center">
                <X className="h-5 w-5 mx-auto text-red-600 mb-1" />
                <p className="text-2xl font-bold text-red-600">{report.errors}</p>
                <p className="text-xs text-muted-foreground">Com erro</p>
              </Card>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Importar outro arquivo</Button>
              <Button onClick={close}>Concluir</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
