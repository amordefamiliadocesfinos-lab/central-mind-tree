import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, ChevronRight, ChevronDown, ChevronUp, Clock, MessageCircle, Send, CheckSquare, Square } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import type { Contact } from '@/hooks/useContacts';

const EXCLUDED_STAGES = ['fechado', 'perdido'];

interface LeadsNeedContactPanelProps {
  contacts: Contact[];
  onOpenContact: (contact: Contact) => void;
  onWhatsApp?: (contact: Contact) => void;
  onBulkDispatch?: (contacts: Contact[]) => void;
  getUrgencyLevel?: (contact: Contact) => string;
  getUrgencyReason?: (contact: Contact) => string | null;
  /** Quando true, a lista já vem filtrada pelo Centro de Automação (não aplicar regra própria) */
  preFiltered?: boolean;
  /** Rótulo do filtro ativo, exibido no título */
  filterLabel?: string;
}

const URGENCY_DISPLAY: Record<string, { emoji: string; className: string }> = {
  urgente: { emoji: '🔴', className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700' },
  medio: { emoji: '🟡', className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700' },
  baixo: { emoji: '🔵', className: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700' },
};

export function LeadsNeedContactPanel({ contacts, onOpenContact, onWhatsApp, onBulkDispatch, getUrgencyLevel, getUrgencyReason, preFiltered, filterLabel }: LeadsNeedContactPanelProps) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const staleLeads = useMemo(() => {
    const now = new Date();
    return contacts
      .filter(c => {
        if (!c.is_active) return false;
        if (EXCLUDED_STAGES.includes(c.funnel_status)) return false;
        if (preFiltered) return true;
        if (!c.ultimo_contato) return true;
        try {
          return differenceInDays(now, parseISO(c.ultimo_contato)) >= 7;
        } catch { return false; }
      })
      .map(c => {
        const days = c.ultimo_contato
          ? differenceInDays(now, parseISO(c.ultimo_contato))
          : null;
        return { contact: c, daysSinceContact: days };
      })
      .sort((a, b) => {
        if (a.daysSinceContact === null && b.daysSinceContact === null) return 0;
        if (a.daysSinceContact === null) return -1;
        if (b.daysSinceContact === null) return 1;
        return b.daysSinceContact - a.daysSinceContact;
      });
  }, [contacts, preFiltered]);

  // Limpa seleção quando lista muda (lead foi contatado e sumiu)
  useEffect(() => {
    setSelectedIds(prev => {
      const visible = new Set(staleLeads.map(s => s.contact.id));
      const next = new Set<string>();
      prev.forEach(id => { if (visible.has(id)) next.add(id); });
      return next;
    });
  }, [staleLeads]);

  const FUNNEL_LABELS: Record<string, string> = {
    novo_lead: 'Novo Lead',
    contato_realizado: 'Contato Realizado',
    proposta_enviada: 'Proposta Enviada',
    negociacao: 'Negociação',
  };


  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allWithPhone = staleLeads
    .map(s => s.contact)
    .filter(c => !!(c.whatsapp || c.mobile || c.phone));
  const allSelected = allWithPhone.length > 0 && allWithPhone.every(c => selectedIds.has(c.id));

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allWithPhone.map(c => c.id)));
  };

  const dispatchSelected = () => {
    if (!onBulkDispatch) return;
    const selected = staleLeads
      .map(s => s.contact)
      .filter(c => selectedIds.has(c.id));
    if (selected.length === 0) return;
    onBulkDispatch(selected);
  };

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-1.5">
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        <h3 className="text-xs font-semibold">
          {preFiltered && filterLabel ? filterLabel : 'Leads que precisam de contato'}
        </h3>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {staleLeads.length}
        </Badge>

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Ocultar lista' : 'Mostrar lista completa'}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{expanded ? 'Ocultar' : 'Ver tudo'}</span>
          </Button>
          {onBulkDispatch && (
            <>
              {selectionMode ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] gap-1"
                    onClick={toggleAll}
                  >
                    {allSelected ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                    {allSelected ? 'Limpar' : 'Todos'}
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 px-2 text-[11px] gap-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={dispatchSelected}
                    disabled={selectedIds.size === 0}
                  >
                    <Send className="h-3 w-3" />
                    Disparar ({selectedIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[11px] gap-1"
                  onClick={() => setSelectionMode(true)}
                >
                  <CheckSquare className="h-3 w-3" />
                  Selecionar vários
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <div className={cn('divide-y divide-border/50 rounded-md bg-background/60', expanded && 'max-h-40 overflow-y-auto')}>
        {staleLeads.length === 0 && (
          <p className="text-[11px] text-muted-foreground py-3 text-center">
            Nenhum lead neste filtro. Tudo em dia por aqui.
          </p>
        )}
        {(expanded ? staleLeads : staleLeads.slice(0, 1)).map(({ contact, daysSinceContact }) => {
          const hasPhone = !!(contact.whatsapp || contact.mobile || contact.phone);
          const isSelected = selectedIds.has(contact.id);
          const reason = getUrgencyReason?.(contact);
          return (
            <div
              key={contact.id}
              className={cn(
                'flex items-center gap-2 px-2 py-0.5 text-[12px] min-h-7',
                isSelected && 'bg-green-500/10'
              )}
            >
              {selectionMode && (
                <Checkbox
                  checked={isSelected}
                  disabled={!hasPhone}
                  onCheckedChange={() => hasPhone && toggleId(contact.id)}
                />
              )}
              <div className="flex-1 min-w-0 flex items-center gap-1.5" title={reason || undefined}>
                {getUrgencyLevel && (() => {
                  const level = getUrgencyLevel(contact);
                  const display = URGENCY_DISPLAY[level];
                  if (!display) return null;
                  return <span className="text-[10px] leading-none">{display.emoji}</span>;
                })()}
                <span className="font-medium truncate">{contact.name}</span>
                <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                  {FUNNEL_LABELS[contact.funnel_status] || contact.funnel_status}
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 shrink-0 inline-flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {daysSinceContact !== null ? `${daysSinceContact}d` : 'nunca'}
                </span>
                {reason && <span className="text-[10px] font-bold text-red-600" aria-label={reason}>!</span>}
              </div>
              {!selectionMode && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {hasPhone && onWhatsApp && (
                    <Button
                      size="sm"
                      className="h-6 px-2 text-[11px] gap-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => onWhatsApp(contact)}
                    >
                      <MessageCircle className="h-3 w-3" />
                      <span className="hidden sm:inline">Atender</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onOpenContact(contact)}
                    aria-label={`Abrir ${contact.name}`}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

