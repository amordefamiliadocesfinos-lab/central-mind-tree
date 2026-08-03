import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CrmEventCode } from '@/lib/crm/model';
import type { Database, Json } from '@/integrations/supabase/types';

export const INTERACTION_TYPES = [
  { value: 'mensagem', label: 'Mensagem', icon: '💬' },
  { value: 'ligacao', label: 'Ligação', icon: '📞' },
  { value: 'orcamento', label: 'Orçamento', icon: '📋' },
  { value: 'reuniao', label: 'Reunião', icon: '🤝' },
  { value: 'venda', label: 'Venda', icon: '💰' },
  { value: 'observacao', label: 'Observação', icon: '📝' },
] as const;

export interface ContactHistoryEntry {
  id: string;
  contact_id: string;
  event_type: string;
  interaction_type: string;
  description: string;
  event_code?: string | null;
  event_metadata?: Json;
  interaction_date: string;
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
      .order('interaction_date', { ascending: false })
      .limit(100);

    if (!error) setEntries((data || []) as unknown as ContactHistoryEntry[]);
    setLoading(false);
  }, []);

  const addEntry = useCallback(async (
    contactId: string,
    interactionType: string,
    description: string,
    interactionDate: string,
    eventCode?: CrmEventCode,
    eventMetadata: Json = {},
  ) => {
    const { error } = await supabase.from('contact_history').insert({
      contact_id: contactId,
      event_type: interactionType,
      interaction_type: interactionType,
      event_code: eventCode || null,
      event_metadata: eventMetadata,
      description,
      interaction_date: interactionDate,
    });
    if (error) { toast.error('Erro ao adicionar'); return; }

    // Auto-update ultimo_contato on contact
    await supabase.from('contacts').update({
      ultimo_contato: new Date(interactionDate).toISOString().split('T')[0],
    }).eq('id', contactId);

    toast.success('Interação registrada');
    await fetchHistory(contactId);
  }, [fetchHistory]);

  const updateEntry = useCallback(async (
    id: string,
    contactId: string,
    updates: { interaction_type?: string; description?: string; interaction_date?: string }
  ) => {
    const updateData: Database['public']['Tables']['contact_history']['Update'] = {};
    if (updates.interaction_type) {
      updateData.interaction_type = updates.interaction_type;
      updateData.event_type = updates.interaction_type;
    }
    if (updates.description) updateData.description = updates.description;
    if (updates.interaction_date) updateData.interaction_date = updates.interaction_date;

    const { error } = await supabase.from('contact_history').update(updateData).eq('id', id);
    if (error) { toast.error('Erro ao atualizar'); return; }
    toast.success('Interação atualizada');
    await fetchHistory(contactId);
  }, [fetchHistory]);

  const deleteEntry = useCallback(async (id: string, contactId: string) => {
    const { error } = await supabase.from('contact_history').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Interação excluída');
    await fetchHistory(contactId);
  }, [fetchHistory]);

  return { entries, loading, fetchHistory, addEntry, updateEntry, deleteEntry };
}
