import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getTodayISO } from '@/lib/dateUtils';

export interface DailyMetrics {
  contactsAttended: number;
  messagesSent: number;
  responsesReceived: number;
  ordersGenerated: number;
}

export function useDailyMetrics() {
  const contactedTodayRef = useRef<Set<string>>(new Set());
  const [metrics, setMetrics] = useState<DailyMetrics>({
    contactsAttended: 0,
    messagesSent: 0,
    responsesReceived: 0,
    ordersGenerated: 0,
  });

  const todayStart = useMemo(() => `${getTodayISO()}T00:00:00-03:00`, []);

  const fetchMetrics = useCallback(async () => {
    const { data, error } = await supabase
      .from('contact_history')
      .select('contact_id, interaction_type, description')
      .gte('interaction_date', todayStart);

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

    contactedTodayRef.current = uniqueContacts;

    setMetrics(prev => ({
      contactsAttended: Math.max(prev.contactsAttended, uniqueContacts.size),
      messagesSent: Math.max(prev.messagesSent, messages),
      responsesReceived: responses,
      ordersGenerated: orders,
    }));
  }, [todayStart]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    const handleWhatsAppSent = (event: Event) => {
      const contactId = (event as CustomEvent<{ contactId?: string }>).detail?.contactId;
      if (!contactId) return;

      setMetrics(prev => {
        const alreadyCounted = contactedTodayRef.current.has(contactId);
        contactedTodayRef.current.add(contactId);
        return {
          ...prev,
          contactsAttended: prev.contactsAttended + (alreadyCounted ? 0 : 1),
          messagesSent: prev.messagesSent + 1,
        };
      });
    };

    window.addEventListener('crm:whatsapp-sent', handleWhatsAppSent);
    return () => window.removeEventListener('crm:whatsapp-sent', handleWhatsAppSent);
  }, [fetchMetrics]);

  return { dailyMetrics: metrics, refetchDaily: fetchMetrics };
}
