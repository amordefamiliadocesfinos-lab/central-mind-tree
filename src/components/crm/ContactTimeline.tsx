import { useEffect, useState } from 'react';
import { useContactHistory, INTERACTION_TYPES } from '@/hooks/useContactHistory';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserPlus, MessageCircle, Phone, FileText, Handshake, DollarSign, StickyNote, Clock, ArrowRightLeft, Trophy, Plus, X, Send, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const EVENT_ICONS: Record<string, { icon: React.ElementType; className: string }> = {
  mensagem: { icon: MessageCircle, className: 'text-blue-600 bg-blue-100 border-blue-200' },
  ligacao: { icon: Phone, className: 'text-green-600 bg-green-100 border-green-200' },
  orcamento: { icon: FileText, className: 'text-amber-600 bg-amber-100 border-amber-200' },
  reuniao: { icon: Handshake, className: 'text-purple-600 bg-purple-100 border-purple-200' },
  venda: { icon: DollarSign, className: 'text-emerald-600 bg-emerald-100 border-emerald-200' },
  observacao: { icon: StickyNote, className: 'text-gray-600 bg-gray-100 border-gray-200' },
  stage_change: { icon: ArrowRightLeft, className: 'text-indigo-600 bg-indigo-100 border-indigo-200' },
  conversion: { icon: Trophy, className: 'text-yellow-600 bg-yellow-100 border-yellow-200' },
  lead_criado: { icon: UserPlus, className: 'text-primary bg-primary/10 border-primary/20' },
  follow_up: { icon: CalendarClock, className: 'text-orange-600 bg-orange-100 border-orange-200' },
};

interface Props {
  contactId: string;
  createdAt?: string;
}

export function ContactTimeline({ contactId, createdAt }: Props) {
  const { entries, loading, fetchHistory, addEntry } = useContactHistory();
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contactId) fetchHistory(contactId);
  }, [contactId, fetchHistory]);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    await addEntry(contactId, 'observacao', noteText.trim(), new Date().toISOString());
    setNoteText('');
    setShowNoteInput(false);
    setSaving(false);
  };

  const allEvents = [
    ...entries.map(e => ({
      id: e.id,
      type: e.interaction_type || e.event_type,
      description: e.description,
      date: e.interaction_date || e.created_at,
    })),
    ...(createdAt ? [{
      id: 'created',
      type: 'lead_criado',
      description: 'Lead criado',
      date: createdAt,
    }] : []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getIcon = (type: string) => {
    return EVENT_ICONS[type] || { icon: Clock, className: 'text-muted-foreground bg-muted border-border' };
  };

  const getLabel = (type: string) => {
    if (type === 'lead_criado') return 'Lead criado';
    if (type === 'stage_change') return 'Mudança de etapa';
    if (type === 'conversion') return 'Conversão';
    return INTERACTION_TYPES.find(t => t.value === type)?.label || type;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">Carregando timeline...</div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add Note Button / Input */}
      {!showNoteInput ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs gap-1.5"
          onClick={() => setShowNoteInput(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar Nota
        </Button>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <Textarea
            placeholder="Escreva uma observação..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="text-xs min-h-[60px] resize-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote();
            }}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setShowNoteInput(false); setNoteText(''); }}
            >
              <X className="h-3 w-3 mr-1" />
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!noteText.trim() || saving}
              onClick={handleAddNote}
            >
              <Send className="h-3 w-3 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {allEvents.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted-foreground">Nenhum evento registrado</div>
      ) : (
        <div className="relative pl-8 space-y-3">
          <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />
          {allEvents.map((event) => {
            const { icon: Icon, className } = getIcon(event.type);
            return (
              <div key={event.id} className="relative flex items-start gap-3">
                <div className={cn(
                  "absolute -left-8 w-7 h-7 rounded-full border flex items-center justify-center shrink-0",
                  className
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{getLabel(event.type)}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDate(event.date)}</span>
                  </div>
                  {event.description && event.type !== 'lead_criado' && (
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{event.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}