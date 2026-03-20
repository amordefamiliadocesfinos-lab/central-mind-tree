import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

export type NoResponseStatus = 'sem_resposta' | 'follow_up_urgente' | 'lead_esfriando' | null;

export interface NoResponseInfo {
  status: NoResponseStatus;
  daysSince: number;
  label: string;
  emoji: string;
  suggestedMessage: string;
  suggestedLabel: string;
}

const STATUS_CONFIG: Record<string, { label: string; emoji: string }> = {
  sem_resposta: { label: 'Sem resposta', emoji: '⚠' },
  follow_up_urgente: { label: 'Follow-up urgente', emoji: '🔥' },
  lead_esfriando: { label: 'Lead esfriando', emoji: '❄' },
};

const SUGGESTED_MESSAGES: Record<string, { message: string; label: string }> = {
  sem_resposta: {
    message: 'Olá, tudo bem?\nSó passando para ver se conseguiu analisar o que conversamos 😊',
    label: 'Follow-up 2 dias',
  },
  follow_up_urgente: {
    message: 'Oi, tudo bem?\nQueria saber se ainda tem interesse no pedido ou se posso te ajudar de alguma forma.',
    label: 'Follow-up 5 dias',
  },
  lead_esfriando: {
    message: 'Olá! Tudo bem?\nComo não tivemos retorno, estou passando para ver se ainda faz sentido para você 😊\nSe precisar, posso montar uma nova proposta.',
    label: 'Follow-up 10 dias',
  },
};

function getStatus(days: number): NoResponseStatus {
  if (days >= 10) return 'lead_esfriando';
  if (days >= 5) return 'follow_up_urgente';
  if (days >= 2) return 'sem_resposta';
  return null;
}

export function useNoResponseDetection() {
  const [noResponseMap, setNoResponseMap] = useState<Map<string, NoResponseInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from('contact_history')
      .select('contact_id, interaction_type, interaction_date, description, created_at')
      .order('interaction_date', { ascending: false })
      .limit(5000);

    if (error || !data) {
      setLoading(false);
      return;
    }

    const contactEntries: Record<string, Array<{ interaction_type: string; interaction_date: string; description: string }>> = {};
    
    for (const entry of data) {
      if (!contactEntries[entry.contact_id]) contactEntries[entry.contact_id] = [];
      contactEntries[entry.contact_id].push({
        interaction_type: entry.interaction_type || '',
        interaction_date: entry.interaction_date || entry.created_at || '',
        description: entry.description || '',
      });
    }

    const map = new Map<string, NoResponseInfo>();
    const now = new Date();

    for (const [contactId, entries] of Object.entries(contactEntries)) {
      // entries are sorted desc by interaction_date
      // Find the most recent WhatsApp message sent
      const lastWhatsAppIdx = entries.findIndex(
        e => e.interaction_type === 'whatsapp' || e.description.includes('Mensagem iniciada via WhatsApp')
      );

      if (lastWhatsAppIdx === -1) continue; // No WhatsApp message sent

      const lastWhatsApp = entries[lastWhatsAppIdx];

      // Check if there's any newer interaction (index < lastWhatsAppIdx means newer)
      const hasNewerInteraction = lastWhatsAppIdx > 0;

      if (hasNewerInteraction) continue; // There's been a response/interaction after WhatsApp

      // Calculate days since WhatsApp message
      const whatsAppDate = new Date(lastWhatsApp.interaction_date);
      const days = differenceInDays(now, whatsAppDate);
      const status = getStatus(days);

      if (status) {
        const cfg = STATUS_CONFIG[status];
        const suggested = SUGGESTED_MESSAGES[status];
        map.set(contactId, {
          status,
          daysSince: days,
          label: cfg.label,
          emoji: cfg.emoji,
          suggestedMessage: suggested.message,
          suggestedLabel: suggested.label,
        });
      }
    }

    setNoResponseMap(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getNoResponseInfo = useCallback((contactId: string): NoResponseInfo | null => {
    return noResponseMap.get(contactId) || null;
  }, [noResponseMap]);

  const refreshNoResponse = fetchData;

  return { getNoResponseInfo, noResponseMap, loading, refreshNoResponse };
}
