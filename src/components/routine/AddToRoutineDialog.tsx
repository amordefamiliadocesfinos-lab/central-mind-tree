import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { format, addDays, addWeeks, addMonths, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { FOCUS_TYPES, RECURRENCE_OPTIONS, RecurrenceType } from '@/hooks/useRoutine';
import { useActiveUser } from '@/hooks/useActiveUser';

export interface AddToRoutineSource {
  /** Ex: 'crm/lead', 'financial/entry', 'production/order', 'digital/idea', 'task', 'foco' */
  kind: string;
  id?: string | number;
  label?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  source: AddToRoutineSource;
  defaultTitle?: string;
  defaultFocus?: string;
  defaultDurationMin?: number;
  defaultNotes?: string;
  onCreated?: () => void;
}

interface UserOpt { id: string; name: string; }
interface MTOpt { id: string; name: string; icon: string | null; color: string | null; }

const ALERT_OPTIONS = [
  { value: 'none', label: 'Sem alerta' },
  { value: '0', label: 'No horário' },
  { value: '5', label: '5 min antes' },
  { value: '15', label: '15 min antes' },
  { value: '30', label: '30 min antes' },
  { value: '60', label: '1h antes' },
];

export function AddToRoutineDialog({
  open, onOpenChange, source,
  defaultTitle = '', defaultFocus = 'trabalho_profundo',
  defaultDurationMin = 30, defaultNotes = '',
  onCreated,
}: Props) {
  const { activeUserId } = useActiveUser();
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [mts, setMts] = useState<MTOpt[]>([]);
  const [title, setTitle] = useState(defaultTitle);
  const [userId, setUserId] = useState<string | undefined>(activeUserId || undefined);
  const [mtId, setMtId] = useState<string | undefined>(undefined);
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState<string>(format(new Date(Date.now() + 30 * 60000), 'HH:mm'));
  const [duration, setDuration] = useState<number>(defaultDurationMin);
  const [focus, setFocus] = useState<string>(defaultFocus);
  const [recurrence, setRecurrence] = useState<RecurrenceType | ''>('');
  const [alertMin, setAlertMin] = useState<string>('none');
  const [notes, setNotes] = useState<string>(defaultNotes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setNotes(defaultNotes);
    setFocus(defaultFocus);
    setDuration(defaultDurationMin);
    setUserId(activeUserId || undefined);
    (async () => {
      const [{ data: u }, { data: m }] = await Promise.all([
        supabase.from('app_users').select('id, name, is_active').eq('is_active', true).order('name'),
        supabase.from('routine_mts' as any).select('id, name, icon, color').eq('is_active', true).order('order_index'),
      ]);
      setUsers((u as any) || []);
      setMts((m as any) || []);
    })();
  }, [open, defaultTitle, defaultFocus, defaultDurationMin, defaultNotes, activeUserId]);

  const originTag = useMemo(() => {
    const idPart = source.id ? `/${source.id}` : '';
    return `origem: ${source.kind}${idPart}`;
  }, [source]);

  const submit = async () => {
    if (!title.trim()) { toast.error('Informe um título'); return; }
    setSaving(true);
    try {
      const composedNotes = [notes?.trim(), originTag, source.label ? `ref: ${source.label}` : null]
        .filter(Boolean).join('\n');

      const baseRow: any = {
        title: title.trim(),
        block_type: 'foco',
        focus,
        duration_minutes: Math.max(5, duration),
        planned_start: time,
        notes: composedNotes,
        status: 'pendente',
        assigned_user_id: userId ?? null,
        recurrence: recurrence || null,
      };

      // Occurrences
      const occurrences: { date: string }[] = [{ date }];
      if (recurrence) {
        const base = parseISO(`${date}T${time}:00`);
        for (let i = 1; i <= 11; i++) {
          let next: Date;
          switch (recurrence) {
            case 'daily': next = addDays(base, i); break;
            case 'weekly': next = addWeeks(base, i); break;
            case 'monthly': next = addMonths(base, i); break;
            case '1h': next = new Date(base.getTime() + i * 3600 * 1000); break;
            case '2h': next = new Date(base.getTime() + i * 2 * 3600 * 1000); break;
            case '4h': next = new Date(base.getTime() + i * 4 * 3600 * 1000); break;
            case '6h': next = new Date(base.getTime() + i * 6 * 3600 * 1000); break;
            case '12h': next = new Date(base.getTime() + i * 12 * 3600 * 1000); break;
            default: next = base;
          }
          occurrences.push({ date: format(next, 'yyyy-MM-dd') });
        }
      }

      const rows = occurrences.map(o => ({ ...baseRow, date: o.date }));
      const { error } = await supabase.from('routine_blocks').insert(rows as any);
      if (error) throw error;

      // Schedule alert(s) for the first occurrence via Notification API
      if (alertMin !== 'none' && 'Notification' in window) {
        try {
          if (Notification.permission === 'default') await Notification.requestPermission();
          const alertMs = parseISO(`${date}T${time}:00`).getTime() - Date.now() - parseInt(alertMin) * 60000;
          if (alertMs > 0 && alertMs < 24 * 3600 * 1000 * 7) {
            setTimeout(() => {
              try { new Notification('⏰ Rotina', { body: `${title} — em ${alertMin === '0' ? 'agora' : alertMin + ' min'}` }); } catch {}
            }, alertMs);
          }
        } catch {}
      }

      toast.success(`✅ Enviado para a Rotina${occurrences.length > 1 ? ` (${occurrences.length} ocorrências)` : ''}`);
      onCreated?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" /> Adicionar à Rotina
          </DialogTitle>
          <DialogDescription className="text-xs">
            Envie esta atividade para o cronograma. Ela vai complementar o MT do dia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Ligar para cliente X" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Horário</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Duração (min)</Label>
              <Input type="number" min={5} value={duration} onChange={e => setDuration(parseInt(e.target.value) || 30)} />
            </div>
            <div>
              <Label className="text-xs">Foco</Label>
              <Select value={focus} onValueChange={setFocus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[100]">
                  {Object.entries(FOCUS_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Usuário</Label>
              <Select value={userId || 'none'} onValueChange={v => setUserId(v === 'none' ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="Ninguém" /></SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="none">— Sem dono —</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Método de Trabalho</Label>
              <Select value={mtId || 'none'} onValueChange={v => setMtId(v === 'none' ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {mts.map(m => <SelectItem key={m.id} value={m.id}>{m.icon || '📋'} {m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Recorrência</Label>
              <Select value={recurrence || 'none'} onValueChange={v => setRecurrence(v === 'none' ? '' : v as RecurrenceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[100]">
                  {RECURRENCE_OPTIONS.map(o => (
                    <SelectItem key={o.value || 'none'} value={o.value || 'none'}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Alerta</Label>
              <Select value={alertMin} onValueChange={setAlertMin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[100]">
                  {ALERT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contexto extra (opcional)" />
            <p className="text-[10px] text-muted-foreground mt-1">Origem registrada: <code>{originTag}</code></p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarPlus className="h-4 w-4 mr-2" />}
            Enviar para Rotina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
