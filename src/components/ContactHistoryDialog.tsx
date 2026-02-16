import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContactHistory, ContactHistoryEntry } from '@/hooks/useContactHistory';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, MessageSquare, Phone, Mail, Calendar, StickyNote, TrendingUp, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const EVENT_ICONS: Record<string, typeof StickyNote> = {
  note: StickyNote,
  stage_change: ArrowRight,
  conversion: TrendingUp,
  call: Phone,
  email: Mail,
  meeting: Calendar,
  message: MessageSquare,
};

const EVENT_COLORS: Record<string, string> = {
  note: 'bg-muted text-muted-foreground',
  stage_change: 'bg-blue-100 text-blue-700',
  conversion: 'bg-green-100 text-green-700',
  call: 'bg-amber-100 text-amber-700',
  email: 'bg-purple-100 text-purple-700',
  meeting: 'bg-orange-100 text-orange-700',
  message: 'bg-sky-100 text-sky-700',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  contactName: string;
}

export function ContactHistoryDialog({ open, onOpenChange, contactId, contactName }: Props) {
  const { entries, loading, fetchHistory, addEntry } = useContactHistory();
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open && contactId) fetchHistory(contactId);
  }, [open, contactId, fetchHistory]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !contactId) return;
    setAdding(true);
    await addEntry(contactId, 'note', newNote.trim());
    setNewNote('');
    await fetchHistory(contactId);
    setAdding(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Histórico — {contactName}</DialogTitle>
        </DialogHeader>

        {/* Add note */}
        <div className="flex gap-2">
          <Input
            placeholder="Adicionar nota..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            className="h-9 text-sm"
          />
          <Button size="sm" onClick={handleAddNote} disabled={adding || !newNote.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto space-y-0 min-h-0">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro ainda</p>
          ) : (
            <div className="relative pl-6 space-y-3 py-2">
              <div className="absolute left-2.5 top-4 bottom-4 w-px bg-border" />
              {entries.map((entry) => {
                const Icon = EVENT_ICONS[entry.event_type] || StickyNote;
                const color = EVENT_COLORS[entry.event_type] || EVENT_COLORS.note;
                return (
                  <div key={entry.id} className="relative flex gap-2">
                    <div className={cn('absolute -left-6 top-0.5 rounded-full p-1 border bg-background', color)}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{entry.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(parseISO(entry.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
