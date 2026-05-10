import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ContactConversationLite {
  id: string;
  platform_id: string | null;
  status: string;
  funnel_stage: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
}

export function useContactConversations(contactId?: string | null) {
  const [conversations, setConversations] = useState<ContactConversationLite[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!contactId) { setConversations([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('service_conversations')
      .select('id, platform_id, status, funnel_stage, last_message_at, last_message_preview, unread_count')
      .eq('contact_id', contactId)
      .order('last_message_at', { ascending: false });
    setConversations((data || []) as ContactConversationLite[]);
    setLoading(false);
  }, [contactId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { conversations, loading, refetch: fetch };
}
