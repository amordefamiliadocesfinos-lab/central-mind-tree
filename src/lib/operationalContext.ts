export type OperationalStatus = 'Agora' | 'Hoje' | 'Aguardando' | 'Atrasado';
export interface OperationalContext { module: string; path: string; title: string; status: OperationalStatus; updatedAt: string; }
export const OPERATIONAL_MODULES = [
  { module: 'Foco', path: '/foco' }, { module: 'Planejamento', path: '/planejamento' },
  { module: 'CRM', path: '/contatos/inbox' }, { module: 'Operações', path: '/operacoes' },
  { module: 'Rotina', path: '/rotina' }, { module: 'Digital', path: '/digital' },
  { module: 'Financeiro', path: '/financeiro' }, { module: 'Captura Central', path: '/captura' },
] as const;
const LAST = 'pc.operational.lastContext';
const NEXT = 'pc.operational.nextStep';
const read = (key: string): OperationalContext | null => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : null; } catch { return null; } };
export const getLastOperationalContext = () => read(LAST);
export const getNextOperationalStep = () => read(NEXT);
export const saveLastOperationalContext = (value: OperationalContext) => localStorage.setItem(LAST, JSON.stringify(value));
export const saveNextOperationalStep = (value: OperationalContext | null) => {
  if (value) localStorage.setItem(NEXT, JSON.stringify(value)); else localStorage.removeItem(NEXT);
  window.dispatchEvent(new Event('operational-context-changed'));
};
