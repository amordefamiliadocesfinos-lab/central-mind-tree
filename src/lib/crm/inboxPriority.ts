import { compareCrmPriority, getCrmPriority, type CrmPriorityInput } from '@/lib/crm/priority';

export type InboxPriorityReason = 'Precisa responder' | 'Retorno vencido' | 'Retorno hoje';

export interface InboxPriorityInput extends CrmPriorityInput {
  needs_reply: boolean;
  status: string | null;
  return_at: string | null;
  last_inbound_at: string | null;
  last_message_at: string | null;
}

export interface InboxPriority {
  level: 0 | 1 | 2 | 3;
  reason?: InboxPriorityReason;
  sortAt: number;
}

/** Compatibilidade visual da Inbox, agora delegada ao motor Ãºnico do CRM. */
export function getInboxPriority(item: InboxPriorityInput, now = new Date()): InboxPriority {
  const priority = getCrmPriority(item, now);
  if (priority.reason === 'needs_reply') return { level: 0, reason: 'Precisa responder', sortAt: priority.sortAt };
  if (priority.reason === 'return_overdue') return { level: 1, reason: 'Retorno vencido', sortAt: priority.sortAt };
  if (priority.reason === 'return_today') return { level: 2, reason: 'Retorno hoje', sortAt: priority.sortAt };
  return { level: 3, sortAt: priority.sortAt };
}

export function compareInboxPriority(a: InboxPriorityInput, b: InboxPriorityInput, now = new Date()) {
  // MantÃ©m a ordem conhecida da Inbox para nÃ£o alterar a experiÃªncia nesta frente.
  const priorityA = getInboxPriority(a, now);
  const priorityB = getInboxPriority(b, now);
  if (priorityA.level !== priorityB.level) return priorityA.level - priorityB.level;
  if (priorityA.level === 3) return priorityB.sortAt - priorityA.sortAt;
  return priorityA.sortAt - priorityB.sortAt;
}

export { compareCrmPriority };
