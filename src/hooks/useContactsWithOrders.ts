import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useContactsWithOrders() {
  const [contactIdsWithOrders, setContactIdsWithOrders] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('orders')
        .select('contact_id')
        .not('contact_id', 'is', null)
        .is('deleted_at', null);
      
      if (data) {
        const ids = new Set(data.map(d => d.contact_id).filter(Boolean) as string[]);
        setContactIdsWithOrders(ids);
      }
    };
    fetch();
  }, []);

  const hasOrders = (contactId: string) => contactIdsWithOrders.has(contactId);

  return { contactIdsWithOrders, hasOrders };
}
