import { useState } from 'react';
import { CalendarClock, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ATTENDANCE_OUTCOMES, type AttendanceOutcome } from '@/lib/crm/attendance';

interface Props {
  busy?: boolean;
  onOutcome: (outcome: AttendanceOutcome) => void | Promise<void>;
  onSnooze: (when: number | string) => void | Promise<void>;
}

export function AttendanceActionBar({ busy = false, onOutcome, onSnooze }: Props) {
  const [mode, setMode] = useState<'outcome' | 'snooze' | null>(null);
  const [date, setDate] = useState('');

  return (
    <div className="rounded-lg border bg-muted/20 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="h-8 flex-1 gap-1 text-xs" disabled={busy} onClick={() => setMode(mode === 'outcome' ? null : 'outcome')}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Registrar resultado <ChevronDown className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="outline" className="h-8 flex-1 gap-1 text-xs" disabled={busy} onClick={() => setMode(mode === 'snooze' ? null : 'snooze')}>
          <CalendarClock className="h-3.5 w-3.5" /> Adiar
        </Button>
      </div>
      {mode === 'outcome' && (
        <div className="grid grid-cols-2 gap-1.5">
          {ATTENDANCE_OUTCOMES.map(item => (
            <Button key={item.key} size="sm" variant="ghost" className="h-auto min-h-8 justify-start whitespace-normal px-2 py-1 text-left text-[11px]" onClick={async () => { await onOutcome(item.key); setMode(null); }}>
              {item.label}
            </Button>
          ))}
        </div>
      )}
      {mode === 'snooze' && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={async () => { await onSnooze(1); setMode(null); }}>Amanhã</Button>
            <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={async () => { await onSnooze(3); setMode(null); }}>3 dias</Button>
            <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={async () => { await onSnooze(7); setMode(null); }}>7 dias</Button>
          </div>
          <div className="flex gap-2">
            <Input type="date" className="h-8 text-xs" value={date} min={new Date().toISOString().slice(0, 10)} onChange={event => setDate(event.target.value)} />
            <Button size="sm" className="h-8 text-xs" disabled={!date} onClick={async () => { await onSnooze(date); setMode(null); setDate(''); }}>Confirmar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
