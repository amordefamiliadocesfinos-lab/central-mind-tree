import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Plus, Pencil, Trash2, Volume2, Clock, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCustomAlarms } from '@/hooks/useCustomAlarms';
import { CustomAlarm, RECURRENCE_LABEL, Recurrence } from '@/lib/customAlarms';
import { unlockAlarmAudio } from '@/lib/alarmSound';

export type { CustomAlarm, PendingAlarm } from '@/lib/customAlarms';

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'pt-BR';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

export function CustomAlarmsPanel() {
  const { alarms, pending, updateAlarms, dismissPending } = useCustomAlarms();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomAlarm | null>(null);
  const [form, setForm] = useState<Omit<CustomAlarm, 'id'>>({
    name: '', times: [], message: '', recurrence: 'daily', enabled: true,
  });
  const [newTime, setNewTime] = useState('08:00');

  function openCreate() {
    unlockAlarmAudio();
    setEditing(null);
    setForm({ name: '', times: [], message: '', recurrence: 'daily', enabled: true });
    setNewTime('08:00');
    setOpen(true);
  }

  function openEdit(a: CustomAlarm) {
    setEditing(a);
    setForm({ name: a.name, times: [...a.times], message: a.message, recurrence: a.recurrence, enabled: a.enabled });
    setOpen(true);
  }

  function addTime() {
    if (!/^\d{2}:\d{2}$/.test(newTime)) return;
    if (form.times.includes(newTime)) return;
    setForm({ ...form, times: [...form.times, newTime].sort() });
  }

  function removeTime(t: string) {
    setForm({ ...form, times: form.times.filter(x => x !== t) });
  }

  function save() {
    if (!form.name.trim() || form.times.length === 0) {
      toast({ title: 'Preencha nome e pelo menos um horário' });
      return;
    }
    unlockAlarmAudio();
    const next = editing
      ? alarms.map(a => a.id === editing.id ? { ...editing, ...form } : a)
      : [...alarms, { ...form, id: crypto.randomUUID() }];
    updateAlarms(next);
    setOpen(false);
  }

  function remove(id: string) {
    updateAlarms(alarms.filter(a => a.id !== id));
  }

  function toggle(id: string, enabled: boolean) {
    unlockAlarmAudio();
    updateAlarms(alarms.map(a => a.id === id ? { ...a, enabled } : a));
  }

  return (
    <Card className="p-4 space-y-3">
      {/* Alarmes pendentes — visíveis até serem dispensados */}
      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map(p => (
            <div key={`${p.id}-${p.time}-${p.date}`} className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
              <Bell className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  ⏰ {p.name} — {p.time}
                </div>
                {p.message && (
                  <div className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                    {p.message}
                  </div>
                )}
              </div>
              <Button size="sm" variant="secondary" onClick={() => dismissPending(p.id, p.time, p.date)}>
                OK
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Alarmes personalizados</h3>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar alarme' : 'Novo alarme'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Impulsionar Shopee" />
              </div>

              <div>
                <Label>Horários</Label>
                <div className="flex gap-2">
                  <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
                  <Button type="button" onClick={addTime} variant="secondary">
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                </div>
                {form.times.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.times.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-1 text-xs">
                        <Clock className="h-3 w-3" /> {t}
                        <button type="button" onClick={() => removeTime(t)} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>Recorrência</Label>
                <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v as Recurrence })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map(k => (
                      <SelectItem key={k} value={k}>{RECURRENCE_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Mensagem (será falada e exibida)</Label>
                <Textarea rows={3} value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder="Ex: Hora de impulsionar os produtos da Shopee." />
                <Button type="button" variant="ghost" size="sm" className="mt-1"
                  onClick={() => form.message && speak(form.message)}>
                  <Volume2 className="h-3 w-3" /> Testar voz
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-md border p-2">
                <Label className="text-sm">Ativo</Label>
                <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {alarms.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum alarme criado. Crie alarmes por horário (independentes dos blocos da rotina) — eles disparam em qualquer página do painel, com som, voz e notificação.
        </p>
      ) : (
        <ul className="space-y-2">
          {alarms.map(a => (
            <li key={a.id} className="flex items-center justify-between rounded-md border p-2 gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  {a.name}
                  {!a.enabled && <span className="text-xs text-muted-foreground">(pausado)</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {a.times.join(' · ') || 'sem horário'} · {RECURRENCE_LABEL[a.recurrence]}
                  {a.message ? ` · "${a.message}"` : ''}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch checked={a.enabled} onCheckedChange={(v) => toggle(a.id, v)} />
                <Button size="icon" variant="ghost" onClick={() => openEdit(a)} title="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(a.id)} title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
