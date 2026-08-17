import { useEffect } from 'react';
import { AlarmRingOverlay } from './AlarmRingOverlay';
import { useCustomAlarms } from '@/hooks/useCustomAlarms';
import { unlockAlarmAudio } from '@/lib/alarmSound';
import { savePending, loadPending } from '@/lib/customAlarms';
import { toast } from '@/hooks/use-toast';

/**
 * Motor global de alarmes personalizados: roda em qualquer página do app,
 * não apenas na tela de Rotina.
 */
export function CustomAlarmsRuntime() {
  const { pending, dismissPending, pushPending } = useCustomAlarms({ runEngine: true });

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    const unlock = () => unlockAlarmAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  const ringing = pending[0] || null;

  function snooze() {
    if (!ringing) return;
    const target = ringing;
    dismissPending(target.id, target.time, target.date);
    window.setTimeout(() => {
      const next = [...loadPending(), { ...target, time: `${target.time} (soneca)` }];
      savePending(next);
    }, 5 * 60_000);
    toast({ title: 'Soneca de 5 minutos', description: target.name });
  }

  return (
    <AlarmRingOverlay
      alarm={ringing}
      queued={Math.max(0, pending.length - 1)}
      onStop={() => ringing && dismissPending(ringing.id, ringing.time, ringing.date)}
      onSnooze={snooze}
    />
  );
}
