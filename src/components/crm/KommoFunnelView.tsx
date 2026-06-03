import { useMemo, useState, useCallback } from 'react';
import { Contact } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ContactAvatar } from '@/components/crm/ContactAvatar';
import { cn } from '@/lib/utils';
import { parseISO, format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  Plus,
  Zap,
  MoreHorizontal,
  LayoutGrid,
  List as ListIcon,
  Filter,
} from 'lucide-react';

interface Stage {
  key: string;
  label: string;
  // thin bar color shown under the column header (kommo style)
  bar: string;
}

const KOMMO_STAGES: Stage[] = [
  { key: 'novo_lead',          label: 'NOVA CONSULTA',     bar: 'bg-sky-500' },
  { key: 'contato_realizado',  label: 'CONTATO REALIZADO', bar: 'bg-cyan-400' },
  { key: 'proposta_enviada',   label: 'ORÇAMENTO ENVIADO', bar: 'bg-amber-400' },
  { key: 'negociacao',         label: 'NEGOCIAÇÃO',        bar: 'bg-orange-400' },
  { key: 'fechado',            label: 'PEDIDO REALIZADO',  bar: 'bg-yellow-400' },
  { key: 'pos_venda',          label: 'PÓS-VENDA',         bar: 'bg-pink-400' },
  { key: 'cadencia',           label: 'CADÊNCIA',          bar: 'bg-violet-400' },
  { key: 'perdido',            label: 'PERDIDO',           bar: 'bg-rose-400' },
];

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtKommoDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = parseISO(iso);
    if (isToday(d)) return `Hoje ${format(d, 'HH:mm')}`;
    if (isYesterday(d)) return `Ontem ${format(d, 'HH:mm')}`;
    const diff = Math.abs(differenceInDays(new Date(), d));
    if (diff < 7) return format(d, 'EEE HH:mm', { locale: ptBR });
    return format(d, 'dd MMM', { locale: ptBR });
  } catch {
    return '';
  }
}

function leadIdShort(c: Contact): string {
  // pseudo Lead #ID derived from uuid for stable display
  const hex = c.id.replace(/-/g, '');
  const n = parseInt(hex.slice(0, 8), 16);
  return `#${(n % 90000000 + 10000000).toString()}`;
}

interface KommoFunnelViewProps {
  contacts: Contact[];
  onLeadClick: (contact: Contact) => void;
  onStageChange: (contact: Contact, newStage: string) => void;
  onCreateLead?: () => void;
  nextTaskByContact?: Record<string, string>;
}

export function KommoFunnelView({ contacts, onLeadClick, onStageChange, onCreateLead, nextTaskByContact = {} }: KommoFunnelViewProps) {
  const [tab, setTab] = useState<'funnel' | 'list'>('funnel');
  const [query, setQuery] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const active = useMemo(() => contacts.filter(c => c.is_active !== false), [contacts]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.fantasy_name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.whatsapp || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      leadIdShort(c).toLowerCase().includes(q),
    );
  }, [active, query]);

  const groups = useMemo(() => {
    const g: Record<string, Contact[]> = {};
    KOMMO_STAGES.forEach(s => { g[s.key] = []; });
    filtered.forEach(c => {
      const key = c.funnel_status || 'novo_lead';
      if (!g[key]) g[key] = [];
      g[key].push(c);
    });
    return g;
  }, [filtered]);

  const sums = useMemo(() => {
    const s: Record<string, number> = {};
    KOMMO_STAGES.forEach(st => {
      s[st.key] = (groups[st.key] || []).reduce((acc, c) => acc + (Number(c.valor_estimado) || 0), 0);
    });
    return s;
  }, [groups]);

  const totalLeads = filtered.length;
  const totalValue = useMemo(() => filtered.reduce((s, c) => s + (Number(c.valor_estimado) || 0), 0), [filtered]);

  // Stats row
  const stats = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
    const yesterday = new Date(startOfDay); yesterday.setDate(yesterday.getDate() - 1);

    let comHoje = 0, semTarefa = 0, atrasadas = 0, novoHoje = 0, novoOntem = 0;

    filtered.forEach(c => {
      const next = nextTaskByContact[c.id] || c.next_action_date || c.next_contact_date;
      if (!next) { semTarefa++; }
      else {
        try {
          const d = parseISO(next);
          const diff = differenceInDays(d, startOfDay);
          if (diff === 0) comHoje++;
          else if (diff < 0) atrasadas++;
        } catch { semTarefa++; }
      }
      try {
        const created = parseISO(c.created_at);
        if (created >= startOfDay) novoHoje++;
        else if (created >= yesterday && created < startOfDay) novoOntem++;
      } catch {}
    });

    return { comHoje, semTarefa, atrasadas, novoHoje, novoOntem };
  }, [filtered, nextTaskByContact]);

  const handleDragStart = (e: React.DragEvent, c: Contact) => {
    setDragId(c.id);
    e.dataTransfer.setData('text/plain', c.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragEnd = () => { setDragId(null); setDragOver(null); };
  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(stageKey);
  };
  const handleDrop = useCallback((e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setDragOver(null); setDragId(null);
    if (!id) return;
    const c = contacts.find(x => x.id === id);
    if (!c || c.funnel_status === stageKey) return;
    onStageChange(c, stageKey);
  }, [contacts, dragId, onStageChange]);

  return (
    <div className="-mx-4 -mt-3 min-h-[calc(100vh-160px)] bg-slate-50/60 dark:bg-slate-950/40">
      {/* Top toolbar */}
      <div className="sticky top-[120px] z-20 bg-background border-b">
        <div className="flex items-center gap-3 px-4 h-12">
          <span className="text-[13px] font-bold tracking-wider text-foreground">LEADS</span>
          <div className="inline-flex rounded-md border border-input overflow-hidden">
            <button
              onClick={() => setTab('funnel')}
              className={cn('px-2 h-7 flex items-center text-xs', tab === 'funnel' ? 'bg-muted' : 'hover:bg-muted/50')}
              title="Funil de vendas"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTab('list')}
              className={cn('px-2 h-7 flex items-center text-xs border-l border-input', tab === 'list' ? 'bg-muted' : 'hover:bg-muted/50')}
              title="Todos os leads"
            >
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium px-2 h-7">
            Leads ativos
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca e filtro"
              className="h-7 pl-7 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:bg-muted/40"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {totalLeads} leads: <span className="font-semibold text-foreground">{fmtBRL(totalValue)}</span>
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-amber-600">
              <Zap className="h-3.5 w-3.5 fill-current" />
              AUTOMATIZE
            </Button>
            <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={onCreateLead}>
              <Plus className="h-3.5 w-3.5" />
              NOVO LEAD
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        {tab === 'funnel' && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-t bg-background">
            {[
              { label: 'Com tarefas para hoje', value: String(stats.comHoje), accent: 'text-emerald-600' },
              { label: 'Sem tarefas atribuídas', value: String(stats.semTarefa), accent: 'text-amber-600' },
              { label: 'Com tarefas atrasadas',  value: String(stats.atrasadas), accent: 'text-rose-600' },
              { label: 'Novo hoje / ontem',      value: `${stats.novoHoje} / ${stats.novoOntem}`, accent: 'text-foreground' },
              { label: 'Vendas em potencial',    value: totalValue > 0 ? fmtBRL(totalValue) : 'Sem dados', accent: 'text-foreground' },
            ].map((s, i) => (
              <div key={i} className={cn('px-4 py-2 flex flex-col', i === 4 && 'items-end md:items-end')}>
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
                <span className={cn('text-sm font-semibold', s.accent)}>{s.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {tab === 'funnel' ? (
        <ScrollArea className="w-full">
          <div className="flex min-w-max">
            {KOMMO_STAGES.map((stage) => {
              const list = groups[stage.key] || [];
              const sum = sums[stage.key] || 0;
              const isOver = dragOver === stage.key;
              return (
                <div
                  key={stage.key}
                  className={cn(
                    'flex flex-col w-[290px] flex-shrink-0 border-r border-border/60 bg-transparent transition-colors',
                    isOver && 'bg-primary/5',
                  )}
                  onDragOver={(e) => handleDragOver(e, stage.key)}
                  onDrop={(e) => handleDrop(e, stage.key)}
                  onDragLeave={() => setDragOver(prev => prev === stage.key ? null : prev)}
                >
                  {/* Column header */}
                  <div className="px-3 pt-3 pb-2 text-center bg-background sticky top-0 z-10">
                    <div className="text-[11px] font-bold tracking-wider text-muted-foreground">{stage.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {list.length} leads: {fmtBRL(sum)}
                    </div>
                    <div className={cn('h-[3px] mt-2 rounded-full', stage.bar)} />
                  </div>

                  {/* Quick add (first column only - kommo behaviour) */}
                  {stage.key === KOMMO_STAGES[0].key && (
                    <button
                      onClick={onCreateLead}
                      className="mx-2 mt-2 mb-1 h-9 rounded border border-dashed border-border bg-background hover:bg-muted/60 text-xs text-muted-foreground"
                    >
                      Adição rápida
                    </button>
                  )}

                  {/* Cards */}
                  <div className="flex-1 px-2 py-2 space-y-1.5 min-h-[300px]">
                    {list.length === 0 && (
                      <p className="text-[11px] text-muted-foreground text-center py-6 opacity-60">
                        {isOver ? 'Soltar aqui' : 'Sem leads'}
                      </p>
                    )}
                    {list.map((c) => {
                      const next = nextTaskByContact[c.id] || c.next_action_date || c.next_contact_date;
                      let taskLabel = 'Sem Tarefas';
                      let taskDotClass = 'bg-amber-500';
                      if (next) {
                        try {
                          const d = parseISO(next);
                          const diff = differenceInDays(d, new Date());
                          if (diff === 0) { taskLabel = 'Hoje'; taskDotClass = 'bg-emerald-500'; }
                          else if (diff < 0) { taskLabel = `${Math.abs(diff)}d atrasada`; taskDotClass = 'bg-rose-500'; }
                          else if (diff < 7) { taskLabel = `Em ${diff}d`; taskDotClass = 'bg-sky-500'; }
                          else { taskLabel = format(d, 'dd MMM', { locale: ptBR }); taskDotClass = 'bg-muted-foreground'; }
                        } catch {}
                      }
                      return (
                        <div
                          key={c.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, c)}
                          onDragEnd={handleDragEnd}
                          onClick={() => onLeadClick(c)}
                          className={cn(
                            'group bg-background border border-border rounded-md px-2.5 py-2 cursor-pointer',
                            'hover:border-primary/60 hover:shadow-sm transition-all',
                            dragId === c.id && 'opacity-50',
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <ContactAvatar photoUrl={c.photo_url} name={c.name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-[12px] text-muted-foreground truncate">{c.name || 'Sem nome'}</div>
                                <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {fmtKommoDate(c.updated_at || c.created_at)}
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-0.5">
                                <a className="text-[13px] font-medium text-sky-600 hover:underline truncate">
                                  Lead {leadIdShort(c)}
                                </a>
                              </div>
                              {c.valor_estimado != null && Number(c.valor_estimado) > 0 && (
                                <div className="text-[11px] text-foreground/80 mt-0.5">
                                  {fmtBRL(Number(c.valor_estimado))}
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-1.5">
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {c.fantasy_name || c.city || ''}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-amber-600">
                                  <span>{taskLabel}</span>
                                  <span className={cn('inline-block h-1.5 w-1.5 rounded-full', taskDotClass)} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        <KommoLeadsList contacts={filtered} onLeadClick={onLeadClick} />
      )}
    </div>
  );
}

function KommoLeadsList({ contacts, onLeadClick }: { contacts: Contact[]; onLeadClick: (c: Contact) => void }) {
  return (
    <div className="bg-background">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Lead</th>
            <th className="text-left px-4 py-2 font-medium">Contato</th>
            <th className="text-left px-4 py-2 font-medium">Etapa</th>
            <th className="text-right px-4 py-2 font-medium">Venda</th>
            <th className="text-left px-4 py-2 font-medium">Tarefa</th>
            <th className="text-left px-4 py-2 font-medium">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {contacts.length === 0 && (
            <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">Nenhum lead encontrado</td></tr>
          )}
          {contacts.map(c => {
            const stage = KOMMO_STAGES.find(s => s.key === (c.funnel_status || 'novo_lead'));
            const next = c.next_action_date || c.next_contact_date;
            return (
              <tr
                key={c.id}
                onClick={() => onLeadClick(c)}
                className="border-t hover:bg-muted/40 cursor-pointer"
              >
                <td className="px-4 py-2.5">
                  <div className="text-sky-600 font-medium">Lead {leadIdShort(c)}</div>
                  <div className="text-[11px] text-muted-foreground">{c.fantasy_name || ''}</div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ContactAvatar photoUrl={c.photo_url} name={c.name} size="sm" />
                    <div>
                      <div className="text-[13px]">{c.name || 'Sem nome'}</div>
                      <div className="text-[11px] text-muted-foreground">{c.whatsapp || c.phone || c.email || ''}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {stage && (
                    <div className="inline-flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', stage.bar)} />
                      <span className="text-xs">{stage.label}</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {c.valor_estimado ? fmtBRL(Number(c.valor_estimado)) : <span className="text-muted-foreground">R$0</span>}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {next ? fmtKommoDate(next) : <span className="text-amber-600">Sem tarefas</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {fmtKommoDate(c.updated_at || c.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
