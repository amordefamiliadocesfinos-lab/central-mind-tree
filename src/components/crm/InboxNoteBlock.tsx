import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, NotebookPen, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { snoozeAttendance } from '@/lib/crm/attendance';

interface InboxNoteBlockProps {
  contactId: string;
  conversationId?: string | null;
  onSaved?: () => void;
  onRegisterSale?: () => void;
}

export function InboxNoteBlock({ contactId, conversationId, onSaved, onRegisterSale }: InboxNoteBlockProps) {
  const [note, setNote] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!note.trim() && !scheduleDate) {
      toast.error('Escreva uma anotação ou defina uma data.');
      return;
    }
    setSaving(true);
    try {
      const text = note.trim() || 'Follow-up agendado';
      const { error } = await supabase.from('contact_history').insert({
        contact_id: contactId,
        event_type: 'nota',
        interaction_type: 'observacao',
        description: scheduleDate ? `📝 ${text} · retorno em ${scheduleDate.split('-').reverse().join('/')}` : `📝 ${text}`,
        interaction_date: new Date().toISOString(),
      });
      if (error) throw error;

      if (scheduleDate) {
        // A nota continua sendo o registro descritivo; o retorno usa a regra única do CRM.
        await snoozeAttendance({ contactId, conversationId, when: scheduleDate });
      }

      toast.success(scheduleDate ? 'Anotação salva e retorno agendado.' : 'Anotação salva no histórico.');
      setNote('');
      setScheduleDate('');
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar a anotação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border p-2.5 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <NotebookPen className="h-3.5 w-3.5" /> Anotação rápida
      </div>
      <Textarea
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="O que ficou combinado nesta conversa?"
        className="text-xs"
      />
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Agendar retorno (opcional)</Label>
        <Input type="date" className="h-8 text-xs" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" className="h-8 flex-1 text-[11px]" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Salvar
        </Button>
        {onRegisterSale && (
          <Button size="sm" variant="outline" className="h-8 flex-1 gap-1 text-[11px]" onClick={onRegisterSale}>
            <ShoppingCart className="h-3 w-3 text-emerald-600" /> Venda
          </Button>
        )}
      </div>
    </div>
  );
}
