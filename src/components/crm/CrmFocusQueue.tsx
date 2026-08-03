import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  MessageCircle,
  Clock,
  CheckCircle2,
  SkipForward,
  X,
  ExternalLink,
  PartyPopper,
  Send,
  FileText,
  Handshake,
  Trophy,
  Heart,
  Ban,
} from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ContactAvatar } from '@/components/crm/ContactAvatar';
import { formatDisplayDate } from '@/lib/dateUtils';
import type { Contact } from '@/hooks/useContacts';

interface CrmFocusQueueProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Fila congelada no momento da abertura (ordem já definida pelo chamador) */
  queue: Contact[];
  getUrgencyLevel: (c: Contact) => string;
  getUrgencyReason: (c: Contact) => string | null;
  onWhatsApp: (c: Contact) => void | Promise<void>;
  onSnooze: (c: Contact, days: number) => void | Promise<void>;
  onDone: (c: Contact, outcome: QueueOutcome) => boolean | void | Promise<boolean | void>;
  onOpenContact: (c: Contact) => void;
}

export type QueueOutcome =
  | 'awaiting_response'
  | 'proposal_sent'
  | 'negotiation'
  | 'sale_closed'
  | 'post_sale_done'
  | 'no_interest'
  | 'record_only';

const OUTCOMES: Array<{ key: QueueOutcome; label: string; Icon: typeof Send }> = [
  { key: 'awaiting_response', label: 'Aguardando resposta', Icon: Send },
  { key: 'proposal_sent', label: 'Proposta enviada', Icon: FileText },
  { key: 'negotiation', label: 'Em negociação', Icon: Handshake },
  { key: 'sale_closed', label: 'Venda fechada', Icon: Trophy },
  { key: 'post_sale_done', label: 'Pós-venda realizado', Icon: Heart },
  { key: 'no_interest', label: 'Sem interesse', Icon: Ban },
  { key: 'record_only', label: 'Apenas registrar', Icon: CheckCircle2 },
];

const URGENCY_UI: Record<string, { label: string; className: string }> = {
  urgente: { label: '🔴 Urgente', className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800' },
  medio: { label: '🟡 Médio', className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800' },
  baixo: { label: '🔵 Baixo', className: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800' },
};

function daysSince(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  try { return differenceInDays(new Date(), parseISO(dateStr)); } catch { return null; }
}

export function CrmFocusQueue({
  open,
  onOpenChange,
  queue,
  getUrgencyLevel,
  getUrgencyReason,
  onWhatsApp,
  onSnooze,
  onDone,
  onOpenContact,
}: CrmFocusQueueProps) {
  const [index, setIndex] = useState(0);
  const [treated, setTreated] = useState(0);
  const [choosingOutcome, setChoosingOutcome] = useState(false);

  useEffect(() => {
    if (open) { setIndex(0); setTreated(0); setChoosingOutcome(false); }
  }, [open]);

  const total = queue.length;
  const current = queue[index];
  const finished = index >= total;

  const progress = total > 0 ? Math.round((Math.min(index, total) / total) * 100) : 0;

  const advance = (didTreat: boolean) => {
    if (didTreat) setTreated(t => t + 1);
    setIndex(i => i + 1);
  };

  const phone = current ? (current.whatsapp || current.mobile || current.phone) : null;
  const lastContactDays = current ? daysSince(current.ultimo_contato) : null;

  const urgency = useMemo(
    () => (current ? getUrgencyLevel(current) : 'baixo'),
    [current, getUrgencyLevel],
  );
  const urgencyUi = URGENCY_UI[urgency] || URGENCY_UI.baixo;
  const urgencyReason = current ? getUrgencyReason(current) : null;

  const registerOutcome = async (outcome: QueueOutcome) => {
    if (!current) return;
    const completed = await onDone(current, outcome);
    if (completed === false) return;
    setChoosingOutcome(false);
    advance(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header / progresso */}
        <div className="px-4 pt-4 pb-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold">Modo Fila</span>
            <Badge variant="secondary" className="text-[10px] h-5">
              {Math.min(index + (finished ? 0 : 1), total)} de {total}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 ml-auto"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {finished || !current ? (
          <div className="p-8 text-center space-y-3">
            <PartyPopper className="h-10 w-10 mx-auto text-primary" />
            <p className="text-base font-semibold">Fila concluída!</p>
            <p className="text-sm text-muted-foreground">
              {treated} de {total} leads tratados agora.
            </p>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Lead */}
            <div className="flex items-start gap-3">
              <ContactAvatar photoUrl={current.photo_url} name={current.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-base font-semibold truncate">{current.name}</h3>
                  <Badge variant="outline" className={cn('text-[10px] h-5', urgencyUi.className)}>
                    {urgencyUi.label}
                  </Badge>
                </div>
                {current.company_name && (
                  <p className="text-xs text-muted-foreground truncate">{current.company_name}</p>
                )}
                <button
                  type="button"
                  onClick={() => { onOpenContact(current); onOpenChange(false); }}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  Abrir ficha completa <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Contexto essencial */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-muted-foreground">Último contato</p>
                <p className="font-semibold text-foreground">
                  {lastContactDays === null
                    ? 'Nunca contatado'
                    : `há ${lastContactDays} dia${lastContactDays === 1 ? '' : 's'}`}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-muted-foreground">Próxima ação</p>
                <p className="font-semibold text-foreground truncate">
                  {current.next_action_text
                    || (current.next_contact_date ? formatDisplayDate(current.next_contact_date) : '—')}
                </p>
              </div>
            </div>

            {urgencyReason && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                <span className="font-semibold">Motivo da prioridade:</span> {urgencyReason}
              </div>
            )}

            {/* Ações */}
            <div className="space-y-2">
              <Button
                className="w-full h-11 gap-2 bg-green-600 hover:bg-green-700 text-white"
                disabled={!phone}
                onClick={async () => { await onWhatsApp(current); }}
              >
                <MessageCircle className="h-4 w-4" />
                {phone ? 'Preparar contato no WhatsApp' : 'Sem telefone cadastrado'}
              </Button>

              <p className="text-[11px] text-muted-foreground text-center">
                Abrir o WhatsApp não conclui o atendimento. Confirme abaixo somente depois de tratar o cliente.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-10 gap-1.5 text-xs"
                  onClick={async () => { await onSnooze(current, 3); advance(false); }}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Adiar 3 dias
                </Button>
                <Button
                  variant="outline"
                  className="h-10 gap-1.5 text-xs"
                  onClick={() => setChoosingOutcome(v => !v)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Registrar resultado
                </Button>
              </div>

              {choosingOutcome && (
                <div className="rounded-lg border bg-muted/20 p-2 space-y-1.5">
                  <p className="px-1 text-[11px] font-semibold text-muted-foreground">Qual foi o resultado?</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {OUTCOMES.map(({ key, label, Icon }) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-auto min-h-9 justify-start gap-1.5 px-2 py-1.5 text-[11px] whitespace-normal text-left"
                        onClick={() => void registerOutcome(key)}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                className="w-full h-8 gap-1.5 text-[11px] text-muted-foreground"
                onClick={() => advance(false)}
              >
                <SkipForward className="h-3 w-3" />
                Pular
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
