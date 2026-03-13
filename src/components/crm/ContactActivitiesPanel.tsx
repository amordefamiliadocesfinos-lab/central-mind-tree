import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useContactActivities, ContactActivity } from '@/hooks/useContactActivities';
import { useContactHistory } from '@/hooks/useContactHistory';
import { Contact } from '@/hooks/useContacts';
import { Plus, Trash2, CalendarClock, Phone, Mail, Users, MessageSquare } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ACTIVITY_TYPES = [
  { value: 'follow_up', label: 'Follow-up', icon: CalendarClock },
  { value: 'call', label: 'Ligação', icon: Phone },
  { value: 'email', label: 'E-mail', icon: Mail },
  { value: 'meeting', label: 'Reunião', icon: Users },
  { value: 'message', label: 'Mensagem', icon: MessageSquare },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
}

export function ContactActivitiesPanel({ open, onOpenChange, contact }: Props) {
  const { activities, loading, fetchActivities, createActivity, toggleComplete, deleteActivity } = useContactActivities();
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('follow_up');
  const [newDueDate, setNewDueDate] = useState('');

  useEffect(() => {
    if (open && contact) fetchActivities(contact.id);
  }, [open, contact, fetchActivities]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !contact) return;
    await createActivity({
      contact_id: contact.id,
      activity_type: newType,
      title: newTitle.trim(),
      due_date: newDueDate ? new Date(newDueDate).toISOString() : undefined,
    });
    setNewTitle('');
    setNewDueDate('');
  };

  const pending = activities.filter(a => !a.is_completed);
  const completed = activities.filter(a => a.is_completed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Atividades — {contact?.name}</DialogTitle>
        </DialogHeader>

        {/* Create activity */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Nova atividade..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="h-9 text-sm"
            />
            <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="datetime-local"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="h-8 text-xs flex-1"
            />
          </div>
        </div>

        {/* Activities list */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pt-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
          ) : (
            <>
              {pending.length === 0 && completed.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade</p>
              )}
              {pending.map(a => (
                <ActivityRow key={a.id} activity={a} contactId={contact?.id || ''} onToggle={toggleComplete} onDelete={deleteActivity} />
              ))}
              {completed.length > 0 && (
                <>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider pt-3 pb-1">Concluídas ({completed.length})</p>
                  {completed.map(a => (
                    <ActivityRow key={a.id} activity={a} contactId={contact?.id || ''} onToggle={toggleComplete} onDelete={deleteActivity} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActivityRow({ activity, contactId, onToggle, onDelete }: {
  activity: ContactActivity;
  contactId: string;
  onToggle: (id: string, contactId: string) => void;
  onDelete: (id: string, contactId: string) => void;
}) {
  const type = ACTIVITY_TYPES.find(t => t.value === activity.activity_type);
  const Icon = type?.icon || CalendarClock;
  const isOverdue = activity.due_date && !activity.is_completed && isPast(parseISO(activity.due_date));

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
      activity.is_completed && "opacity-50",
      isOverdue && "border-red-200 bg-red-50/50"
    )}>
      <Checkbox
        checked={activity.is_completed}
        onCheckedChange={() => onToggle(activity.id, contactId)}
      />
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm truncate", activity.is_completed && "line-through")}>{activity.title}</p>
        {activity.due_date && (
          <p className={cn("text-[10px]", isOverdue ? "text-red-600 font-medium" : "text-muted-foreground")}>
            {format(parseISO(activity.due_date), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-50 hover:opacity-100 hover:text-destructive" onClick={() => onDelete(activity.id, contactId)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
