import { AlertTriangle, CalendarClock, Flame, MessageCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Contact } from '@/hooks/useContacts';
import type { AttentionCounts, AttentionKey } from '@/lib/crm/attentionFilters';

interface Props {
  queue: Contact[];
  counts: AttentionCounts;
  getUrgencyReason: (contact: Contact) => string | null;
  onSelectFilter: (filter: AttentionKey) => void;
  onStartQueue: () => void;
  onOpenContact: (contact: Contact) => void;
  onWhatsApp: (contact: Contact) => void;
}

const SECTIONS: Array<{
  key: AttentionKey;
  label: string;
  helper: string;
  icon: typeof AlertTriangle;
  tone: string;
}> = [
  { key: 'urgentes', label: 'Resolver agora', helper: 'Ações atrasadas e leads quentes sem resposta', icon: AlertTriangle, tone: 'text-red-600 bg-red-50 border-red-200' },
  { key: 'hoje', label: 'Compromissos de hoje', helper: 'Próximas ações previstas para hoje', icon: CalendarClock, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  { key: 'follow_up', label: 'Aguardando cliente', helper: 'Conversas que precisam de follow-up', icon: MessageCircle, tone: 'text-violet-700 bg-violet-50 border-violet-200' },
  { key: 'esfriando', label: 'Negócios esfriando', helper: 'Oportunidades paradas ou sem primeiro contato', icon: Flame, tone: 'text-orange-700 bg-orange-50 border-orange-200' },
];

export function CrmTodayView({
  queue,
  counts,
  getUrgencyReason,
  onSelectFilter,
  onStartQueue,
  onOpenContact,
  onWhatsApp,
}: Props) {
  const preview = queue.slice(0, 8);

  return (
    <div className="space-y-4">
      <Card className="p-4 border-primary/20 bg-gradient-to-r from-primary/5 to-background">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Hoje no CRM</h2>
            <p className="text-sm text-muted-foreground">Comece pelo que exige ação; o restante pode esperar.</p>
          </div>
          <Button onClick={onStartQueue} disabled={queue.length === 0} className="gap-2">
            <Play className="h-4 w-4" />
            Iniciar fila ({queue.length})
          </Button>
        </div>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {SECTIONS.map(section => {
          const Icon = section.icon;
          return (
            <button key={section.key} type="button" className={`rounded-lg border p-3 text-left transition hover:shadow-sm ${section.tone}`} onClick={() => onSelectFilter(section.key)}>
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-4 w-4" />
                <span className="text-xl font-bold">{counts[section.key] || 0}</span>
              </div>
              <p className="mt-2 text-xs font-semibold">{section.label}</p>
              <p className="mt-0.5 text-[10px] opacity-75">{section.helper}</p>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Próximos atendimentos</h3>
            <p className="text-xs text-muted-foreground">Ordenados por urgência e oportunidade.</p>
          </div>
          <Badge variant="secondary">{queue.length}</Badge>
        </div>
        {preview.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma ação pendente para agora.</div>
        ) : (
          <div className="divide-y">
            {preview.map(contact => (
              <div key={contact.id} className="flex items-center gap-3 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenContact(contact)}>
                  <p className="truncate text-sm font-medium">{contact.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {getUrgencyReason(contact) || contact.next_action_text || 'Revisar relacionamento'}
                  </p>
                </button>
                <Button size="sm" variant="outline" disabled={!contact.whatsapp && !contact.mobile && !contact.phone} onClick={() => onWhatsApp(contact)}>
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Atender
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
