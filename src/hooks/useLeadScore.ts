import { useMemo } from 'react';
import { Contact } from '@/hooks/useContacts';
import { NoResponseInfo } from '@/hooks/useNoResponseDetection';
import { differenceInDays, parseISO } from 'date-fns';

export interface LeadScoreInfo {
  score: number;
  label: string;
  emoji: string;
  className: string;
}

const SCORE_CLASSIFICATION = [
  { min: 121, label: 'Muito quente', emoji: '🔥🔥', className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700' },
  { min: 71, label: 'Quente', emoji: '🔥', className: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700' },
  { min: 31, label: 'Morno', emoji: '☀️', className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700' },
  { min: 0, label: 'Frio', emoji: '❄️', className: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700' },
];

function classify(score: number): Omit<LeadScoreInfo, 'score'> {
  const clamped = Math.max(0, score);
  for (const tier of SCORE_CLASSIFICATION) {
    if (clamped >= tier.min) return tier;
  }
  return SCORE_CLASSIFICATION[SCORE_CLASSIFICATION.length - 1];
}

export function computeLeadScore(
  contact: Contact,
  noResponseInfo: NoResponseInfo | null,
  contactHasOrders: boolean,
): LeadScoreInfo {
  let score = 10; // +10 Lead criado

  // Temperature
  if (contact.temperatura_lead === 'quente') score += 40;
  else if (contact.temperatura_lead === 'morno') score += 20;

  // Recent interaction (last 3 days)
  if (contact.ultimo_contato) {
    try {
      const days = differenceInDays(new Date(), parseISO(contact.ultimo_contato));
      if (days <= 3) score += 30;
    } catch {}
  }

  // Has orders
  if (contactHasOrders) score += 50;

  // Recent follow-up (next_action or next_contact scheduled)
  if (contact.next_action_date || contact.next_contact_date) {
    score += 20;
  }

  // Penalties from no-response
  if (noResponseInfo) {
    if (noResponseInfo.status === 'lead_esfriando') score -= 40;
    else if (noResponseInfo.status === 'follow_up_urgente') score -= 20;
  }

  const info = classify(score);
  return { score: Math.max(0, score), ...info };
}

export function useLeadScore(
  contacts: Contact[],
  getNoResponseInfo: (id: string) => NoResponseInfo | null,
  hasOrders: (id: string) => boolean,
) {
  const scoreMap = useMemo(() => {
    const map = new Map<string, LeadScoreInfo>();
    for (const contact of contacts) {
      const nrInfo = getNoResponseInfo(contact.id);
      const orders = hasOrders(contact.id);
      map.set(contact.id, computeLeadScore(contact, nrInfo, orders));
    }
    return map;
  }, [contacts, getNoResponseInfo, hasOrders]);

  const getScore = (contactId: string): LeadScoreInfo => {
    return scoreMap.get(contactId) || { score: 0, label: 'Frio', emoji: '❄️', className: 'bg-sky-100 text-sky-800 border-sky-300' };
  };

  return { getScore, scoreMap };
}
