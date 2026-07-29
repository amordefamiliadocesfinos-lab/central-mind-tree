import { differenceInDays, parseISO, isSameDay, isBefore, startOfDay } from 'date-fns';
import type { Contact } from '@/hooks/useContacts';
import type { NoResponseInfo } from '@/hooks/useNoResponseDetection';

/**
 * Fonte única de verdade do "Centro de Automação do CRM".
 * Os mesmos critérios alimentam os contadores dos chips (Passo 1),
 * a lista/kanban filtrado e o painel "Leads que precisam de contato" (Passo 3).
 */
export type AttentionKey = 'all' | 'urgentes' | 'follow_up' | 'hoje' | 'esfriando';

export const ATTENTION_EXCLUDED_STAGES = ['fechado', 'perdido'];

export interface AttentionDeps {
  getUrgencyLevel: (c: Contact) => string;
  getNoResponseInfo: (id: string) => NoResponseInfo | null;
}

function safeParse(value?: string | null): Date | null {
  if (!value) return null;
  try {
    const d = parseISO(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** Elegível ao ecossistema de automação (ativo e fora de estágios terminais). */
export function isAttentionEligible(c: Contact): boolean {
  if (!c.is_active) return false;
  return !ATTENTION_EXCLUDED_STAGES.includes(c.funnel_status);
}

export function isUrgente(c: Contact, deps: AttentionDeps): boolean {
  return deps.getUrgencyLevel(c) === 'urgente';
}

export function isFollowUp(c: Contact, deps: AttentionDeps): boolean {
  return !!deps.getNoResponseInfo(c.id);
}

/** Próximo contato ou próxima ação hoje (ou vencida). */
export function isHoje(c: Contact): boolean {
  const now = new Date();
  const today = startOfDay(now);
  const check = (value?: string | null) => {
    const d = safeParse(value);
    if (!d) return false;
    return isSameDay(d, now) || isBefore(startOfDay(d), today);
  };
  return check(c.next_contact_date) || check(c.next_action_date);
}

/** Sem contato há 10+ dias, ou lead/orçamento nunca contatado. */
export function isEsfriando(c: Contact): boolean {
  if (!c.ultimo_contato) return c.type === 'lead' || c.contact_type === 'orcamento';
  const d = safeParse(c.ultimo_contato);
  if (!d) return false;
  return differenceInDays(new Date(), d) >= 10;
}

/** Predicado do chip selecionado — usado por TODAS as visões (kanban, lista, painel). */
export function matchesAttention(c: Contact, key: AttentionKey, deps: AttentionDeps): boolean {
  if (key === 'all') return true;
  if (!isAttentionEligible(c)) return false;
  switch (key) {
    case 'urgentes': return isUrgente(c, deps);
    case 'follow_up': return isFollowUp(c, deps);
    case 'hoje': return isHoje(c);
    case 'esfriando': return isEsfriando(c);
    default: return true;
  }
}

export interface AttentionCounts {
  urgentes: number;
  follow_up: number;
  hoje: number;
  esfriando: number;
}

/** Contadores + fila priorizada, calculados num único passe. */
export function computeAttention(contacts: Contact[], deps: AttentionDeps): {
  counts: AttentionCounts;
  queue: Contact[];
} {
  const counts: AttentionCounts = { urgentes: 0, follow_up: 0, hoje: 0, esfriando: 0 };
  const scored: Array<{ c: Contact; score: number }> = [];

  for (const c of contacts) {
    if (!isAttentionEligible(c)) continue;
    let score = 0;
    if (isUrgente(c, deps)) { counts.urgentes++; score += 100; }
    if (isFollowUp(c, deps)) { counts.follow_up++; score += 50; }
    if (isHoje(c)) { counts.hoje++; score += 70; }
    if (isEsfriando(c)) {
      counts.esfriando++;
      const d = safeParse(c.ultimo_contato);
      score += d ? 20 + Math.min(differenceInDays(new Date(), d), 60) / 10 : 30;
    }
    if (score > 0) scored.push({ c, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return { counts, queue: scored.map(s => s.c) };
}

export const ATTENTION_LABELS: Record<AttentionKey, string> = {
  all: 'Todos',
  urgentes: 'Urgentes',
  follow_up: 'Follow-up',
  hoje: 'Hoje',
  esfriando: 'Esfriando',
};
