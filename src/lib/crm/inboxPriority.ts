export type InboxPriorityReason = 'Precisa responder' | 'Retorno vencido' | 'Retorno hoje';

export interface InboxPriorityInput {
  needs_reply: boolean;
  status: string | null;
  return_at: string | null;
  last_inbound_at: string | null;
  last_message_at: string | null;
  attendance_state?: string | null;
}

export interface InboxPriority {
  level: 0 | 1 | 2 | 3;
  reason?: InboxPriorityReason;
  sortAt: number;
}

function asTime(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function dayBounds(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/**
 * Define a prioridade operacional da Inbox sem score ou efeitos colaterais.
 * A resposta pendente sempre vence; retornos sÃ³ valem quando nÃ£o foram
 * superados por uma nova mensagem recebida.
 */
export function getInboxPriority(item: InboxPriorityInput, now = new Date()): InboxPriority {
  const lastMessageAt = asTime(item.last_message_at) ?? 0;
  const lastInboundAt = asTime(item.last_inbound_at);

  if (item.status !== 'resolved' && item.needs_reply) {
    return {
      level: 0,
      reason: 'Precisa responder',
      sortAt: lastInboundAt ?? lastMessageAt,
    };
  }

  const returnAt = asTime(item.return_at);
  const validReturn = item.status !== 'resolved'
    && !item.needs_reply
    && returnAt !== null
    && (lastInboundAt === null || lastInboundAt <= returnAt);

  if (validReturn) {
    const { start, end } = dayBounds(now);
    if (returnAt < start) {
      return { level: 1, reason: 'Retorno vencido', sortAt: returnAt };
    }
    if (returnAt < end) {
      return { level: 2, reason: 'Retorno hoje', sortAt: returnAt };
    }
  }

  return { level: 3, sortAt: lastMessageAt };
}

/** MantÃ©m a ordem atual na fila normal e torna os motivos operacionais previsÃ­veis. */
export function compareInboxPriority(a: InboxPriorityInput, b: InboxPriorityInput, now = new Date()) {
  const priorityA = getInboxPriority(a, now);
  const priorityB = getInboxPriority(b, now);

  if (priorityA.level !== priorityB.level) return priorityA.level - priorityB.level;

  if (priorityA.level === 3) {
    return priorityB.sortAt - priorityA.sortAt;
  }

  return priorityA.sortAt - priorityB.sortAt;
}
