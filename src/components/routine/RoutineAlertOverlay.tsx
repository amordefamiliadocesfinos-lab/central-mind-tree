import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, Check, Clock, X, Volume2, VolumeX, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { getNextRecurrence, type RecurrenceType } from '@/hooks/useRoutine';
import { toast } from 'sonner';

interface ChecklistItem { id: string; text: string; done: boolean }

interface PendingBlock {
  id: string;
  title: string;
  date: string;
  planned_start: string | null;
  duration_minutes: number;
  notes: string | null;
  checklist: ChecklistItem[];
  recurrence: RecurrenceType | null;
  recurrence_parent_id: string | null;
  block_type: string;
  focus: string;
  node_id: string | null;
  task_id: string | null;
  template_id: string | null;
}

const SOUND_KEY = 'pc.routine.sound.enabled';
const DISMISSED_KEY = 'pc.routine.alert.dismissed';
const HIDDEN_KEY = 'pc.routine.alerts.hidden';
export const ROUTINE_ALERTS_TOGGLE_EVENT = 'pc:routine-alerts-toggle';
export const ROUTINE_ALERTS_COUNT_EVENT = 'pc:routine-alerts-count';

function playBeep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    o.start(); o.stop(ctx.currentTime + 0.65);
    setTimeout(() => {
      const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      o2.type = 'sine'; o2.frequency.value = 1175;
      g2.gain.setValueAtTime(0.0001, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      o2.start(); o2.stop(ctx.currentTime + 0.65);
    }, 250);
  } catch {}
}

export function RoutineAlertOverlay() {
  const [pending, setPending] = useState<PendingBlock[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const v = localStorage.getItem(SOUND_KEY);
    return v === null ? true : v === 'true';
  });
  const alertedRef = useRef<Set<string>>(new Set());

  const getDismissed = useCallback((): Record<string, string> => {
    try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}'); } catch { return {}; }
  }, []);
  const setDismissed = (m: Record<string, string>) => localStorage.setItem(DISMISSED_KEY, JSON.stringify(m));

  const fetchPending = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('routine_blocks')
      .select('*')
      .eq('date', today)
      .eq('status', 'pendente')
      .order('planned_start', { ascending: true });
    if (error || !data) return;

    const nowHHMM = format(new Date(), 'HH:mm');
    const dismissed = getDismissed();
    // cleanup old dismissals (>1 day)
    const cutoff = Date.now() - 86400_000;
    let dirty = false;
    Object.keys(dismissed).forEach(k => {
      if (new Date(dismissed[k]).getTime() < cutoff) { delete dismissed[k]; dirty = true; }
    });
    if (dirty) setDismissed(dismissed);

    const due = (data as any[]).filter(b => {
      if (!b.planned_start) return false;
      if (b.planned_start > nowHHMM) return false;
      if (b.snooze_until && b.snooze_until > nowIso) return false;
      const dismissKey = `${b.id}:${b.planned_start}`;
      if (dismissed[dismissKey]) return false;
      return true;
    }).map(b => ({
      ...b,
      checklist: Array.isArray(b.checklist) ? b.checklist : [],
    })) as PendingBlock[];

    setPending(due);

    // Trigger sound for newly-alerted blocks
    if (soundEnabled) {
      due.forEach(b => {
        const k = `${b.id}:${b.planned_start}`;
        if (!alertedRef.current.has(k)) {
          alertedRef.current.add(k);
          playBeep();
        }
      });
    }
  }, [soundEnabled, getDismissed]);

  useEffect(() => {
    fetchPending();
    const id = setInterval(fetchPending, 20000);
    const chan = supabase
      .channel('routine-alert-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_blocks' }, fetchPending)
      .subscribe();
    return () => { clearInterval(id); supabase.removeChannel(chan); };
  }, [fetchPending]);

  const toggleSound = () => {
    const v = !soundEnabled;
    setSoundEnabled(v);
    localStorage.setItem(SOUND_KEY, String(v));
  };

  const updateChecklist = async (block: PendingBlock, idx: number) => {
    const next = block.checklist.map((c, i) => i === idx ? { ...c, done: !c.done } : c);
    setPending(prev => prev.map(p => p.id === block.id ? { ...p, checklist: next } : p));
    await supabase.from('routine_blocks').update({ checklist: next as any }).eq('id', block.id);
  };

  const completeBlock = async (block: PendingBlock) => {
    await supabase.from('routine_blocks').update({
      status: 'concluido',
      actual_end: new Date().toISOString(),
    }).eq('id', block.id);

    if (block.recurrence) {
      const next = getNextRecurrence(block.date, block.planned_start, block.recurrence);
      await supabase.from('routine_blocks').insert({
        date: next.date,
        title: block.title,
        block_type: block.block_type,
        focus: block.focus,
        duration_minutes: block.duration_minutes,
        planned_start: next.time,
        node_id: block.node_id,
        task_id: block.task_id,
        template_id: block.template_id,
        notes: block.notes,
        checklist: block.checklist.map(c => ({ ...c, done: false })) as any,
        recurrence: block.recurrence,
        recurrence_parent_id: block.recurrence_parent_id || block.id,
        status: 'pendente',
      });
      toast.success(`✅ "${block.title}" concluído`, { description: `🔁 Próxima às ${next.time} (${next.date})` });
    } else {
      toast.success(`✅ "${block.title}" concluído`);
    }
    setPending(prev => prev.filter(p => p.id !== block.id));
  };

  const snoozeBlock = async (block: PendingBlock, minutes: number) => {
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    await supabase.from('routine_blocks').update({ snooze_until: until }).eq('id', block.id);
    setPending(prev => prev.filter(p => p.id !== block.id));
    toast.info(`⏰ Adiado ${minutes} min`);
  };

  const dismiss = (block: PendingBlock) => {
    const d = getDismissed();
    d[`${block.id}:${block.planned_start}`] = new Date().toISOString();
    setDismissed(d);
    setPending(prev => prev.filter(p => p.id !== block.id));
  };

  if (pending.length === 0) return null;

  return (
    <div className="fixed z-[60] flex flex-col gap-2 pointer-events-none
                    max-md:left-2 max-md:right-2 max-md:bottom-20
                    md:right-4 md:bottom-4 md:max-w-sm md:w-full">
      <AnimatePresence initial={false}>
        {pending.slice(0, 3).map((block) => (
          <motion.div
            key={block.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'pointer-events-auto rounded-xl border bg-card/95 backdrop-blur-md shadow-2xl',
              'border-primary/40 ring-1 ring-primary/20 overflow-hidden'
            )}
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border-b border-primary/20">
              <Bell className="h-4 w-4 text-primary animate-pulse shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">
                  Rotina · {block.planned_start} · {block.duration_minutes}min
                </div>
                <div className="font-semibold text-sm truncate">{block.title}</div>
              </div>
              <button
                onClick={toggleSound}
                title={soundEnabled ? 'Silenciar' : 'Ativar som'}
                className="p-1 rounded hover:bg-background/50"
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              </button>
              <button
                onClick={() => dismiss(block)}
                title="Fechar"
                className="p-1 rounded hover:bg-background/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {block.checklist.length > 0 && (
              <div className="px-3 py-2 max-h-44 overflow-y-auto space-y-1.5">
                {block.checklist.map((item, idx) => (
                  <label key={item.id || idx} className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={() => updateChecklist(block, idx)}
                      className="mt-0.5"
                    />
                    <span className={cn(item.done && 'line-through text-muted-foreground')}>{item.text}</span>
                  </label>
                ))}
              </div>
            )}

            {block.notes && !block.checklist.length && (
              <p className="px-3 py-2 text-xs text-muted-foreground line-clamp-2">{block.notes}</p>
            )}

            <div className="grid grid-cols-3 gap-1 p-2 border-t bg-muted/30">
              <Button size="sm" variant="default" onClick={() => completeBlock(block)} className="h-9">
                <Check className="h-4 w-4 mr-1" /> Concluir
              </Button>
              <Button size="sm" variant="outline" onClick={() => snoozeBlock(block, 10)} className="h-9">
                <Clock className="h-4 w-4 mr-1" /> +10min
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dismiss(block)} className="h-9">
                <BellOff className="h-4 w-4 mr-1" /> Fechar
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
