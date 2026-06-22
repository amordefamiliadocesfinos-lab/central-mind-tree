import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ConvoSummary {
  openCount: number;
  totalUnread: number;
}

/**
 * Bulk fetch service_conversations once and index by contact_id.
 * Replaces the per-card useContactConversations hook which previously
 * created N queries when listing many contacts.
 */
export function useAllConversationsSummary() {
  const [byContact, setByContact] = useState<Record<string, ConvoSummary>>({});
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const PAGE = 1000;
      let from = 0;
      const map: Record<string, ConvoSummary> = {};
      while (true) {
        const { data, error } = await supabase
          .from('service_conversations')
          .select('contact_id, status, unread_count')
          .not('contact_id', 'is', null)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const c of data) {
          const id = (c as any).contact_id as string;
          if (!id) continue;
          const entry = map[id] || { openCount: 0, totalUnread: 0 };
          if ((c as any).status === 'open') entry.openCount += 1;
          entry.totalUnread += Number((c as any).unread_count) || 0;
          map[id] = entry;
        }
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setByContact(map);
    } catch (e) {
      console.error('useAllConversationsSummary error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { byContact, loading, refetch: fetchAll };
}
