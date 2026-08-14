export type CrmPriorityLevel = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export type CrmPriorityReason =
  | 'needs_reply'
  | 'return_overdue'
  | 'next_action_overdue'
  | 'return_today'
  | 'next_action_today'
  | 'follow_up_urgent'
  | 'cooling'
  | 'normal'
  | 'future'
  | 'resolved';

export interface CrmPriorityInput {
  needs_reply?: boolean | null;
  status?: string | null;
  attendance_state?: string | null;
  return_at?: string | null;
  next_action_date?: string | null;
  /** Compatibilidade temporÃ¡ria: nunca vence a data canÃ´nica quando ela existe. */
  next_contact_date?: string | null;
  ultimo_contato?: string | null;
  last_inbound_at?: string | null;
  last_message_at?: string | null;
  no_response_status?: 'sem_resposta' | 'follow_up_urgente' | 'lead_esfriando' | null;
  is_lead_or_quote?: boolean;
}

export interface CrmPriority {
  level: CrmPriorityLevel;
  reason: CrmPriorityReason;
  label: string;
  sortAt: number;
  /** Conversas resolvidas e aÃ§Ãµes futuras nÃ£o pertencem Ã  fila imediata. */
  operational: boolean;
}

const LABELS: Record<CrmPriorityReason, string> = {
  needs_reply: 'Precisa responder',
  return_overdue: 'Retorno vencido',
  next_action_overdue: 'AÃ§Ã£o atrasada',
  return_today: 'Retorno hoje',
  next_action_today: 'AÃ§Ã£o hoje',
  follow_up_urgent: 'Follow-up urgente',
  cooling: 'Esfriando',
  normal: 'Fila normal',
  future: 'AÃ§Ã£o futura',
  resolved: 'Conversa resolvida',
};

function asTime(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function dayBounds(now: Date) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function result(level: CrmPriorityLevel, reason: CrmPriorityReason, sortAt: number, operational = true): CrmPriority {
  return { level, reason, label: LABELS[reason], sortAt, operational };
}

/**
 * Motor Ãºnico, puro e determinÃ­stico para prioridade do CRM.
 * NÃ£o grava dados e nÃ£o escolhe responsÃ¡vel; apenas explica a prÃ³xima atenÃ§Ã£o.
 */
export function getCrmPriority(input: CrmPriorityInput, now = new Date()): CrmPriority {
  const lastMessageAt = asTime(input.last_message_at) ?? 0;
  const lastInboundAt = asTime(input.last_inbound_at);
  const { start, end } = dayBounds(now);

  if (input.status === 'resolved') return result('P4', 'resolved', lastMessageAt, false);

  if (input.needs_reply) return result('P0', 'needs_reply', lastInboundAt ?? lastMessageAt);

  const returnAt = asTime(input.return_at);
  const validReturn = returnAt !== null && (lastInboundAt === null || lastInboundAt <= returnAt);
  if (validReturn && returnAt < start) return result('P0', 'return_overdue', returnAt);

  // A data canÃ´nica tem precedÃªncia; a legada serve somente como fallback.
  const nextActionAt = asTime(input.next_action_date) ?? asTime(input.next_contact_date);
  if (nextActionAt !== null && nextActionAt < start) return result('P0', 'next_action_overdue', nextActionAt);

  if (input.no_response_status === 'follow_up_urgente') return result('P0', 'follow_up_urgent', lastMessageAt);
  if (validReturn && returnAt < end) return result('P1', 'return_today', returnAt);
  if (nextActionAt !== null && nextActionAt < end) return result('P1', 'next_action_today', nextActionAt);

  const lastContactAt = asTime(input.ultimo_contato);
  const tenDaysAgo = start - (10 * 86400000);
  const hasCoolingSignal = input.no_response_status === 'lead_esfriando'
    || (input.is_lead_or_quote === true && (lastContactAt === null || lastContactAt < tenDaysAgo));
  if (hasCoolingSignal) return result('P2', 'cooling', lastContactAt ?? lastMessageAt);

  if (nextActionAt !== null && nextActionAt >= end) return result('P4', 'future', nextActionAt, false);
  return result('P3', 'normal', lastMessageAt);
}

const LEVEL_ORDER: Record<CrmPriorityLevel, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

export function compareCrmPriority(a: CrmPriorityInput, b: CrmPriorityInput, now = new Date()) {
  const priorityA = getCrmPriority(a, now);
  const priorityB = getCrmPriority(b, now);
  const levelDifference = LEVEL_ORDER[priorityA.level] - LEVEL_ORDER[priorityB.level];
  if (levelDifference !== 0) return levelDifference;
  if (priorityA.level === 'P3') return priorityB.sortAt - priorityA.sortAt;
  return priorityA.sortAt - priorityB.sortAt;
}
