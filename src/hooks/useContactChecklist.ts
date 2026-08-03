import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CRM_EVENT_CODES } from '@/lib/crm/model';
import { subDays } from 'date-fns';

export interface ContactChecklistStatus {
  messageSent: boolean;
  responseReceived: boolean;
  followUpDone: boolean;
  attemptConcluded: boolean;
}

export function useContactChecklist(contactIds: string[]) {
  const [checklistMap, setChecklistMap] = useState<Record<string, ContactChecklistStatus>>({});
  const [loading, setLoading] = useState(false);

  const fetchChecklists = useCallback(async () => {
    if (contactIds.length === 0) return;
    setLoading(true);

    // Lotes pequenos: URLs com centenas de UUIDs estouram o limite do servidor (414).
    const CHUNK = 60;
    const rows: Array<{ contact_id: string; interaction_type: string | null; description: string | null; event_type: string | null; event_code: string | null }> = [];
    for (let i = 0; i < contactIds.length; i += CHUNK) {
      const { data, error } = await supabase
        .from('contact_history')
        .select('contact_id, interaction_type, description, event_type, event_code')
        .in('contact_id', contactIds.slice(i, i + CHUNK))
        .gte('interaction_date', subDays(new Date(), 120).toISOString())
        .limit(5000);
      if (error) {
        setLoading(false);
        return;
      }
      rows.push(...(data || []));
    }
    const data = rows;


    const map: Record<string, ContactChecklistStatus> = {};

    for (const id of contactIds) {
      map[id] = {
        messageSent: false,
        responseReceived: false,
        followUpDone: false,
        attemptConcluded: false,
      };
    }

    for (const entry of data || []) {
      const status = map[entry.contact_id];
      if (!status) continue;

      const desc = (entry.description || '').toLowerCase();
      const type = (entry.interaction_type || '').toLowerCase();
      const eventCode = entry.event_code;

      // Message sent: whatsapp, mensagem or contains "mensagem"
      if (eventCode === CRM_EVENT_CODES.MESSAGE_SENT || type === 'whatsapp' || type === 'mensagem' || desc.includes('mensagem')) {
        status.messageSent = true;
      }

      // Response received: ligacao (inbound), reuniao, or descriptions indicating response
      if (eventCode === CRM_EVENT_CODES.CUSTOMER_REPLIED || (!eventCode && (type === 'ligacao' || type === 'reuniao' || desc.includes('resposta') || desc.includes('respondeu') || desc.includes('retornou')))) {
        status.responseReceived = true;
      }

      // Follow-up done: follow-up related entries
      if (eventCode === CRM_EVENT_CODES.FOLLOW_UP_COMPLETED || desc.includes('follow-up') || desc.includes('follow up') || desc.includes('acompanhamento') || type === 'follow_up') {
        status.followUpDone = true;
      }

      // Attempt concluded: orcamento, venda, proposta, or stage changes to fechado/perdido
      if ([CRM_EVENT_CODES.PROPOSAL_SENT, CRM_EVENT_CODES.SALE_WON, CRM_EVENT_CODES.SALE_LOST].includes(eventCode as any) || type === 'orcamento' || type === 'venda' || desc.includes('proposta') || desc.includes('orçamento')) {
        status.attemptConcluded = true;
      }
      if (entry.event_type === 'stage_change' && (desc.includes('fechado') || desc.includes('perdido'))) {
        status.attemptConcluded = true;
      }
    }

    setChecklistMap(map);
    setLoading(false);
  }, [contactIds.join(',')]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  return { checklistMap, loading, refetchChecklists: fetchChecklists };
}
