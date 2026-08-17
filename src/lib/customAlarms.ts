// Fonte única dos alarmes personalizados (armazenamento local + barramento de eventos).
export type Recurrence = 'once' | 'daily' | 'weekdays' | 'weekly';

export type CustomAlarm = {
  id: string;
  name: string;
  times: string[]; // HH:MM
  message: string;
  recurrence: Recurrence;
  enabled: boolean;
};

export type PendingAlarm = {
  id: string;
  name: string;
  message: string;
  time: string; // HH:MM
  date: string; // YYYY-MM-DD
};

export const ALARMS_KEY = 'pc.routine.customAlarms.v2';
export const FIRED_KEY = 'pc.routine.customAlarms.fired';
export const PENDING_KEY = 'pc.routine.customAlarms.pending';

export const ALARMS_EVENT = 'pc-custom-alarms-changed';
export const PENDING_EVENT = 'pc-custom-alarms-pending-changed';

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  once: 'Uma vez',
  daily: 'Diário',
  weekdays: 'Dias úteis (Seg–Sex)',
  weekly: 'Semanal',
};

export function loadAlarms(): CustomAlarm[] {
  try {
    const raw = localStorage.getItem(ALARMS_KEY);
    if (raw) return JSON.parse(raw) as CustomAlarm[];
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

export function saveAlarms(list: CustomAlarm[]) {
  localStorage.setItem(ALARMS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(ALARMS_EVENT));
}

export function loadPending(): PendingAlarm[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') as PendingAlarm[]; } catch { return []; }
}

export function savePending(list: PendingAlarm[]) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(PENDING_EVENT));
}

export function loadFired(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}'); } catch { return {}; }
}

/** Mantém apenas as marcações dos últimos dias para não crescer indefinidamente. */
export function saveFired(map: Record<string, boolean>) {
  const keys = Object.keys(map);
  if (keys.length > 400) {
    const trimmed: Record<string, boolean> = {};
    keys.slice(-200).forEach(k => { trimmed[k] = true; });
    map = trimmed;
  }
  localStorage.setItem(FIRED_KEY, JSON.stringify(map));
}

export function shouldRunToday(rec: Recurrence, ref: Date): boolean {
  const dow = ref.getDay();
  if (rec === 'weekdays') return dow >= 1 && dow <= 5;
  return true; // once/daily/weekly são controlados pela chave "fired"
}

export function firedKey(alarm: CustomAlarm, hhmm: string, date: string, ref: Date) {
  return alarm.recurrence === 'weekly'
    ? `${alarm.id}|${hhmm}|${date.slice(0, 7)}-w${Math.ceil(ref.getDate() / 7)}`
    : `${alarm.id}|${hhmm}|${date}`;
}

export function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function localTimeKey(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
