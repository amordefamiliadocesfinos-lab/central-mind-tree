import { useEffect, useRef } from 'react';
import { Bell, BellOff, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startAlarmSound, stopAlarmSound } from '@/lib/alarmSound';

export type RingingAlarm = {
  id: string;
  name: string;
  message: string;
  time: string;
  date: string;
};

type Props = {
  alarm: RingingAlarm | null;
  queued?: number;
  onStop: () => void;
  onSnooze?: () => void;
};

function speak(text: string) {
  if (!('speechSynthesis' in window) || !text) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'pt-BR';
  window.speechSynthesis.speak(utter);
}

export function AlarmRingOverlay({ alarm, queued = 0, onStop, onSnooze }: Props) {
  const notificationRef = useRef<Notification | null>(null);

  useEffect(() => {
    if (!alarm) return;

    startAlarmSound();
    const spokenText = alarm.message || alarm.name;
    speak(spokenText);

    const fireNotification = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      try {
        notificationRef.current?.close();
        const n = new Notification(`⏰ ${alarm.name}`, {
          body: `${alarm.message || `Alarme das ${alarm.time}`}\nToque para parar.`,
          tag: `pc-alarm-${alarm.id}`,
          requireInteraction: true,
          silent: false,
        });
        n.onclick = () => { window.focus(); n.close(); };
        notificationRef.current = n;
      } catch { /* noop */ }
    };

    fireNotification();

    // Insiste enquanto não for parado: voz + re-notificação em segundo plano
    const insist = window.setInterval(() => {
      if (document.hidden) fireNotification();
      speak(spokenText);
    }, 15_000);

    const originalTitle = document.title;
    let flash = false;
    const titleTimer = window.setInterval(() => {
      flash = !flash;
      document.title = flash ? `⏰ ${alarm.name}` : originalTitle;
    }, 1000);

    return () => {
      window.clearInterval(insist);
      window.clearInterval(titleTimer);
      document.title = originalTitle;
      notificationRef.current?.close();
      notificationRef.current = null;
      stopAlarmSound();
    };
  }, [alarm]);

  if (!alarm) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-background/95 backdrop-blur-sm p-6 text-center safe-area-pt">
      <div className="relative">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
        <div className="relative rounded-full bg-primary/15 p-6">
          <Bell className="h-14 w-14 text-primary animate-pulse" />
        </div>
      </div>

      <div className="space-y-2 max-w-md">
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Clock className="h-4 w-4" /> {alarm.time}
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold leading-tight">{alarm.name}</h2>
        {alarm.message && (
          <p className="text-base text-muted-foreground">{alarm.message}</p>
        )}
        {queued > 0 && (
          <p className="text-xs text-muted-foreground">+{queued} alarme(s) na fila</p>
        )}
      </div>

      <div className="w-full max-w-xs space-y-2">
        <Button size="lg" className="w-full h-14 text-base font-semibold" onClick={onStop}>
          <BellOff className="h-5 w-5" /> Parar alarme
        </Button>
        {onSnooze && (
          <Button size="lg" variant="outline" className="w-full h-12" onClick={onSnooze}>
            Soneca 5 min
          </Button>
        )}
      </div>
    </div>
  );
}
