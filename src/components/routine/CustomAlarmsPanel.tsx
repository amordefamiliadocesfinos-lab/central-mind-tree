import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Bell, Plus, Pencil, Trash2, Play, Volume2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export type CustomAlarm = {
  id: string;
  name: string;
  duration_minutes: number;
  message: string;
  focus_label?: string;
};

const STORAGE_KEY = 'pc.routine.customAlarms';

function loadAlarms(): CustomAlarm[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAlarms(list: CustomAlarm[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) {
    toast({ title: 'Áudio não suportado neste navegador' });
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'pt-BR';
  utter.rate = 1;
  utter.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

export function CustomAlarmsPanel() {
  const [alarms, setAlarms] = useState<CustomAlarm[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomAlarm | null>(null);
  const [form, setForm] = useState<Omit<CustomAlarm, 'id'>>({
    name: '', duration_minutes: 25, message: '', focus_label: 'Trabalho profundo',
  });
  const [running, setRunning] = useState<{ id: string; endsAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { setAlarms(loadAlarms()); }, []);
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    if (now >= running.endsAt) {
      const a = alarms.find(x => x.id === running.id);
      if (a) {
        speak(a.message || `${a.name} concluído`);
        toast({ title: '⏰ ' + a.name, description: a.message });
      }
      setRunning(null);
    }
  }, [now, running, alarms]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', duration_minutes: 25, message: '', focus_label: 'Trabalho profundo' });
    setOpen(true);
  }

  function openEdit(a: CustomAlarm) {
    setEditing(a);
    setForm({ name: a.name, duration_minutes: a.duration_minutes, message: a.message, focus_label: a.focus_label });
    setOpen(true);
  }

  function save() {
    if (!form.name.trim() || !form.message.trim() || form.duration_minutes <= 0) {
      toast({ title: 'Preencha nome, duração e mensagem' });
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
    if (running?.id === id) setRunning(null);
  }

  function start(a: CustomAlarm) {
    setRunning({ id: a.id, endsAt: Date.now() + a.duration_minutes * 60_000 });
    toast({ title: `▶ ${a.name}`, description: `Cronômetro iniciado: ${a.duration_minutes}min` });
  }

  function stop() {
    setRunning(null);
    window.speechSynthesis?.cancel();
  }

  const remaining = running ? Math.max(0, running.endsAt - now) : 0;
  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');

  return (
    <Card className="p-4 space-y-3">
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
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Pomodoro profundo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Duração (min)</Label>
                  <Input type="number" min={1} value={form.duration_minutes}
                    onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Tipo de foco</Label>
                  <Input value={form.focus_label || ''} onChange={e => setForm({ ...form, focus_label: e.target.value })} placeholder="Trabalho profundo" />
                </div>
              </div>
              <div>
                <Label>Mensagem ao terminar (será falada)</Label>
                <Textarea rows={3} value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder="Ex: Excelente! Você concluiu 25 minutos de trabalho profundo. Hora de respirar." />
                <Button type="button" variant="ghost" size="sm" className="mt-1"
                  onClick={() => form.message && speak(form.message)}>
                  <Volume2 className="h-3 w-3" /> Testar voz
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {running && (
        <div className="flex items-center justify-between rounded-md border bg-primary/5 px-3 py-2">
          <div className="text-sm">
            <span className="font-medium">{alarms.find(a => a.id === running.id)?.name}</span>
            <span className="ml-2 font-mono text-primary">{mm}:{ss}</span>
          </div>
          <Button size="sm" variant="outline" onClick={stop}>Parar</Button>
        </div>
      )}

      {alarms.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum alarme criado. Crie um para iniciar um cronômetro com aviso por voz.</p>
      ) : (
        <ul className="space-y-2">
          {alarms.map(a => (
            <li key={a.id} className="flex items-center justify-between rounded-md border p-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{a.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {a.duration_minutes}min · {a.focus_label || 'Foco'} · "{a.message}"
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => start(a)} title="Iniciar">
                  <Play className="h-4 w-4" />
                </Button>
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
