import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ContactHistoryEntry {
  id: string;
  contact_id: string;
  event_type: string;
  description: string;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

export function useContactHistory() {
  const [entries, setEntries] = useState<ContactHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async (contactId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_history')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error) setEntries((data || []) as unknown as ContactHistoryEntry[]);
    setLoading(false);
  }, []);

  const addEntry = useCallback(async (contactId: string, eventType: string, description: string, oldValue?: string, newValue?: string) => {
    await supabase.from('contact_history').insert({
      contact_id: contactId,
      event_type: eventType,
      description,
      old_value: oldValue || null,
      new_value: newValue || null,
    });
  }, []);

  return { entries, loading, fetchHistory, addEntry };
}
