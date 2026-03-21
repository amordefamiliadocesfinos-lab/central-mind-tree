import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronRight, Clock, MessageCircle } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import type { Contact } from '@/hooks/useContacts';

const EXCLUDED_STAGES = ['fechado', 'perdido'];

interface LeadsNeedContactPanelProps {
  contacts: Contact[];
  onOpenContact: (contact: Contact) => void;
  onWhatsApp?: (contact: Contact) => void;
  getUrgencyLevel?: (contact: Contact) => string;
}

const URGENCY_DISPLAY: Record<string, { emoji: string; className: string }> = {
  urgente: { emoji: '🔴', className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700' },
  medio: { emoji: '🟡', className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700' },
  baixo: { emoji: '🔵', className: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700' },
};

export function LeadsNeedContactPanel({ contacts, onOpenContact, onWhatsApp, getUrgencyLevel }: LeadsNeedContactPanelProps) {
  const staleLeads = useMemo(() => {
    const now = new Date();
    return contacts
      .filter(c => {
        if (!c.is_active) return false;
        if (EXCLUDED_STAGES.includes(c.funnel_status)) return false;
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
  }, [contacts]);

  if (staleLeads.length === 0) return null;

  const FUNNEL_LABELS: Record<string, string> = {
    novo_lead: 'Novo Lead',
    contato_realizado: 'Contato Realizado',
    proposta_enviada: 'Proposta Enviada',
    negociacao: 'Negociação',
  };

  return (
    <Card className="p-3 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
          Leads que precisam de contato
        </h3>
        <Badge variant="secondary" className="text-[10px] h-5">
          {staleLeads.length}
        </Badge>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {staleLeads.map(({ contact, daysSinceContact }) => {
          const hasPhone = !!(contact.whatsapp || contact.mobile || contact.phone);
          return (
            <div
              key={contact.id}
              className="flex items-center justify-between gap-2 rounded-md bg-background/80 px-2.5 py-1.5 text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium truncate">{contact.name}</span>
                  {getUrgencyLevel && (() => {
                    const level = getUrgencyLevel(contact);
                    const display = URGENCY_DISPLAY[level];
                    if (!display) return null;
                    return (
                      <span className={cn('inline-flex items-center rounded-full border px-1 py-0 text-[9px] font-semibold', display.className)}>
                        {display.emoji}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>{FUNNEL_LABELS[contact.funnel_status] || contact.funnel_status}</span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                    <Clock className="h-3 w-3" />
                    {daysSinceContact !== null ? `${daysSinceContact}d sem contato` : 'Nunca contatado'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {hasPhone && onWhatsApp && (
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => onWhatsApp(contact)}
                  >
                    <MessageCircle className="h-3 w-3" />
                    Atender agora
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => onOpenContact(contact)}
                >
                  Abrir <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
