import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay } from 'date-fns';

export interface DailyMetrics {
  contactsAttended: number;
  messagesSent: number;
  responsesReceived: number;
  ordersGenerated: number;
}

export function useDailyMetrics() {
  const [metrics, setMetrics] = useState<DailyMetrics>({
    contactsAttended: 0,
    messagesSent: 0,
    responsesReceived: 0,
    ordersGenerated: 0,
  });

  const todayStr = useMemo(() => startOfDay(new Date()).toISOString(), []);

  const fetchMetrics = useCallback(async () => {
    const { data, error } = await supabase
      .from('contact_history')
      .select('contact_id, interaction_type, description')
      .gte('interaction_date', todayStr);

    if (error || !data) return;

    const uniqueContacts = new Set<string>();
    let messages = 0;
    let responses = 0;
    let orders = 0;

    for (const entry of data) {
      uniqueContacts.add(entry.contact_id);
      const type = (entry.interaction_type || '').toLowerCase();
      const desc = (entry.description || '').toLowerCase();

      if (type === 'whatsapp' || type === 'mensagem' || desc.includes('mensagem')) {
        messages++;
      }
      if (type === 'ligacao' || type === 'reuniao' || desc.includes('resposta') || desc.includes('respondeu') || desc.includes('retornou')) {
        responses++;
      }
      if (type === 'venda' || type === 'orcamento' || desc.includes('pedido') || desc.includes('convertido')) {
        orders++;
      }
    }

    setMetrics({
      contactsAttended: uniqueContacts.size,
      messagesSent: messages,
      responsesReceived: responses,
      ordersGenerated: orders,
    });
  }, [todayStr]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { dailyMetrics: metrics, refetchDaily: fetchMetrics };
}
