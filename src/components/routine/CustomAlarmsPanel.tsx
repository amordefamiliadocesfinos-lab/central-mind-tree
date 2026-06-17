import { useState, useEffect, useRef } from 'react';
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

type Recurrence = 'once' | 'daily' | 'weekdays' | 'weekly';

export type CustomAlarm = {
  id: string;
  name: string;
  times: string[];           // HH:MM list
  message: string;
  recurrence: Recurrence;
  enabled: boolean;
};

const STORAGE_KEY = 'pc.routine.customAlarms.v2';
const FIRED_KEY = 'pc.routine.customAlarms.fired'; // map alarmId|HH:MM|YYYY-MM-DD => true
const PENDING_KEY = 'pc.routine.customAlarms.pending'; // alarmes não dispensados

export type PendingAlarm = {
  id: string;         // alarm.id
  name: string;
  message: string;
  time: string;       // HH:MM
  date: string;       // YYYY-MM-DD
};

function loadAlarms(): CustomAlarm[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // migração leve do formato antigo (se existir) — ignora durações
    const legacy = localStorage.getItem('pc.routine.customAlarms');
    if (legacy) {
      const arr = JSON.parse(legacy) as any[];
      return arr.map(a => ({
        id: a.id, name: a.name, times: [], message: a.message,
        recurrence: 'daily' as Recurrence, enabled: true,
      }));
    }
    return [];
  } catch { return []; }
}

function saveAlarms(list: CustomAlarm[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadFired(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}'); } catch { return {}; }
}
function saveFired(v: Record<string, boolean>) {
  localStorage.setItem(FIRED_KEY, JSON.stringify(v));
}

function loadPending(): PendingAlarm[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
}
function savePending(v: PendingAlarm[]) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(v));
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'pt-BR';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function shouldRunToday(rec: Recurrence, lastDate: string | null): boolean {
  const today = new Date();
  const dow = today.getDay(); // 0=dom
  if (rec === 'once') return lastDate !== today.toISOString().slice(0, 10) ? true : true; // dispara uma vez (controle por fired)
  if (rec === 'daily') return true;
  if (rec === 'weekdays') return dow >= 1 && dow <= 5;
  if (rec === 'weekly') {
    // toda mesma semana — simplificação: roda no mesmo dia da semana da criação? Usamos dom=domingo
    return true; // toca todo dia da semana correspondente — checado por fired (apenas 1x/semana via key sem data)
  }
  return false;
}

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  once: 'Uma vez',
  daily: 'Diário',
  weekdays: 'Dias úteis (Seg–Sex)',
  weekly: 'Semanal',
};

export function CustomAlarmsPanel() {
  const [alarms, setAlarms] = useState<CustomAlarm[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomAlarm | null>(null);
  const [form, setForm] = useState<Omit<CustomAlarm, 'id'>>({
    name: '', times: [], message: '', recurrence: 'daily', enabled: true,
  });
  const [newTime, setNewTime] = useState('08:00');
  const firedRef = useRef<Record<string, boolean>>({});
  const [pending, setPending] = useState<PendingAlarm[]>([]);

  useEffect(() => {
    setAlarms(loadAlarms());
    firedRef.current = loadFired();
    setPending(loadPending());
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Poller: a cada 20s verifica horários
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const today = now.toISOString().slice(0, 10);
      let changed = false;

      for (const a of alarms) {
        if (!a.enabled) continue;
        if (!a.times.includes(hhmm)) continue;
        if (!shouldRunToday(a.recurrence, null)) continue;

        const key = a.recurrence === 'weekly'
          ? `${a.id}|${hhmm}|${today.slice(0, 7)}-w${Math.ceil(now.getDate() / 7)}`
          : `${a.id}|${hhmm}|${today}`;

        if (firedRef.current[key]) continue;
        firedRef.current[key] = true;
        changed = true;

        // Adiciona à lista de pendentes (persistente até dispensar)
        setPending(prev => {
          const already = prev.some(p => p.id === a.id && p.time === hhmm && p.date === today);
          if (already) return prev;
          const next = [...prev, { id: a.id, name: a.name, message: a.message, time: hhmm, date: today }];
          savePending(next);
          return next;
        });

        // Dispara
        speak(a.message || a.name);
        toast({ title: `⏰ ${a.name}`, description: a.message || `Alarme das ${hhmm}` });
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification(`⏰ ${a.name}`, { body: a.message || `Alarme das ${hhmm}` }); } catch {}
        }

        if (a.recurrence === 'once') {
          // desabilita após disparar
          setAlarms(prev => {
            const next = prev.map(x => x.id === a.id ? { ...x, enabled: false } : x);
            saveAlarms(next);
            return next;
          });
        }
      }
      if (changed) saveFired(firedRef.current);
    };
    tick();
    const i = setInterval(tick, 20_000);
    return () => clearInterval(i);
  }, [alarms]);

  function openCreate() {
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
    const next = editing
      ? alarms.map(a => a.id === editing.id ? { ...editing, ...form } : a)
      : [...alarms, { ...form, id: crypto.randomUUID() }];
    setAlarms(next);
    saveAlarms(next);
    setOpen(false);
  }

  function remove(id: string) {
    const next = alarms.filter(a => a.id !== id);
    setAlarms(next);
    saveAlarms(next);
  }

  function toggle(id: string, enabled: boolean) {
    const next = alarms.map(a => a.id === id ? { ...a, enabled } : a);
    setAlarms(next);
    saveAlarms(next);
  }

  function dismissPending(id: string, time: string, date: string) {
    setPending(prev => {
      const next = prev.filter(p => !(p.id === id && p.time === time && p.date === date));
      savePending(next);
      return next;
    });
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
          Nenhum alarme criado. Crie alarmes por horário (independentes dos blocos da rotina) — eles disparam notificação e voz no horário definido.
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
