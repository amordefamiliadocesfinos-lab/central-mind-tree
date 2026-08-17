import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ALARMS_EVENT, ALARMS_KEY, CustomAlarm, PENDING_EVENT, PENDING_KEY, PendingAlarm,
  firedKey, loadAlarms, loadFired, loadPending, localDateKey, localTimeKey,
  saveAlarms, saveFired, savePending, shouldRunToday,
} from '@/lib/customAlarms';

/**
 * Estado compartilhado dos alarmes personalizados.
 * `runEngine` deve ficar ativo em apenas um ponto global da aplicação.
 */
export function useCustomAlarms(options?: { runEngine?: boolean }) {
  const runEngine = options?.runEngine ?? false;
  const [alarms, setAlarms] = useState<CustomAlarm[]>(() => loadAlarms());
  const [pending, setPending] = useState<PendingAlarm[]>(() => loadPending());
  const alarmsRef = useRef(alarms);
  const firedRef = useRef<Record<string, boolean>>(loadFired());

  alarmsRef.current = alarms;

  // Sincroniza entre componentes e abas
  useEffect(() => {
    const syncAlarms = () => setAlarms(loadAlarms());
    const syncPending = () => setPending(loadPending());
    const onStorage = (e: StorageEvent) => {
      if (e.key === ALARMS_KEY) syncAlarms();
      if (e.key === PENDING_KEY) syncPending();
    };
    window.addEventListener(ALARMS_EVENT, syncAlarms);
    window.addEventListener(PENDING_EVENT, syncPending);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ALARMS_EVENT, syncAlarms);
      window.removeEventListener(PENDING_EVENT, syncPending);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const updateAlarms = useCallback((next: CustomAlarm[]) => {
    setAlarms(next);
    saveAlarms(next);
  }, []);

  const dismissPending = useCallback((id: string, time: string, date: string) => {
    const next = loadPending().filter(p => !(p.id === id && p.time === time && p.date === date));
    setPending(next);
    savePending(next);
  }, []);

  const pushPending = useCallback((item: PendingAlarm) => {
    const current = loadPending();
    if (current.some(p => p.id === item.id && p.time === item.time && p.date === item.date)) return;
    const next = [...current, item];
    setPending(next);
    savePending(next);
  }, []);

  // Motor de disparo (global)
  useEffect(() => {
    if (!runEngine) return;
    let lastCheck = Date.now();

    const tick = () => {
      const now = new Date();
      const missedMinutes = Math.min(120, Math.max(0, Math.floor((now.getTime() - lastCheck) / 60_000)));
      lastCheck = now.getTime();

      let changed = false;
      let disabledOnce: string[] = [];

      for (let back = missedMinutes; back >= 0; back--) {
        const d = new Date(now.getTime() - back * 60_000);
        const hhmm = localTimeKey(d);
        const date = localDateKey(d);

        for (const a of alarmsRef.current) {
          if (!a.enabled || !a.times.includes(hhmm)) continue;
          if (!shouldRunToday(a.recurrence, d)) continue;
          const key = firedKey(a, hhmm, date, d);
          if (firedRef.current[key]) continue;
          firedRef.current[key] = true;
          changed = true;
          pushPending({ id: a.id, name: a.name, message: a.message, time: hhmm, date });
          if (a.recurrence === 'once') disabledOnce.push(a.id);
        }
      }

      if (changed) saveFired(firedRef.current);
      if (disabledOnce.length > 0) {
        const next = loadAlarms().map(x => disabledOnce.includes(x.id) ? { ...x, enabled: false } : x);
        setAlarms(next);
        saveAlarms(next);
      }
    };

    tick();
    const interval = window.setInterval(tick, 10_000);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, [runEngine, pushPending]);

  return { alarms, pending, updateAlarms, dismissPending, pushPending, setPending };
}
