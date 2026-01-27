import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DigitalInteraction {
  id: string;
  platform_id: string | null;
  variation_id: string | null;
  contact_name: string | null;
  contact_handle: string | null;
  interaction_type: 'comment' | 'dm' | 'mention';
  funnel_stage: 'lead' | 'interested' | 'engaged' | 'customer';
  content: string;
  ai_suggested_response: string | null;
  actual_response: string | null;
  status: 'pending' | 'responded' | 'ignored';
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export const FUNNEL_STAGES = {
  lead: { label: 'Lead', color: 'bg-blue-500', order: 1 },
  interested: { label: 'Interessado', color: 'bg-yellow-500', order: 2 },
  engaged: { label: 'Engajado', color: 'bg-orange-500', order: 3 },
  customer: { label: 'Cliente', color: 'bg-green-500', order: 4 },
};

export const INTERACTION_TYPES = {
  comment: { label: 'Comentário', icon: '💬' },
  dm: { label: 'Direct', icon: '✉️' },
  mention: { label: 'Menção', icon: '🔔' },
};

export function useDigitalInteractions() {
  const [interactions, setInteractions] = useState<DigitalInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestingFor, setSuggestingFor] = useState<string | null>(null);

  const fetchInteractions = useCallback(async () => {
    const { data, error } = await supabase
      .from('digital_interactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching interactions:', error);
      setLoading(false);
      return;
    }

    setInteractions((data || []) as unknown as DigitalInteraction[]);
    setLoading(false);
  }, []);

  const createInteraction = useCallback(async (interaction: Partial<DigitalInteraction>) => {
    const { data, error } = await supabase
      .from('digital_interactions')
      .insert({
        platform_id: interaction.platform_id,
        variation_id: interaction.variation_id,
        contact_name: interaction.contact_name,
        contact_handle: interaction.contact_handle,
        interaction_type: interaction.interaction_type || 'comment',
        funnel_stage: interaction.funnel_stage || 'lead',
        content: interaction.content || '',
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar interação');
      return null;
    }

    toast.success('Interação registrada!');
    fetchInteractions();
    return data as unknown as DigitalInteraction;
  }, [fetchInteractions]);

  const updateInteraction = useCallback(async (id: string, updates: Partial<DigitalInteraction>) => {
    const { error } = await supabase
      .from('digital_interactions')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar interação');
      return;
    }

    fetchInteractions();
  }, [fetchInteractions]);

  const deleteInteraction = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('digital_interactions')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir interação');
      return;
    }

    toast.success('Interação excluída');
    fetchInteractions();
  }, [fetchInteractions]);

  const markAsResponded = useCallback(async (id: string, response: string) => {
    await updateInteraction(id, {
      actual_response: response,
      status: 'responded',
      responded_at: new Date().toISOString(),
    } as Partial<DigitalInteraction>);
    toast.success('Marcado como respondido!');
  }, [updateInteraction]);

  const suggestResponse = useCallback(async (interaction: DigitalInteraction, platformName?: string, knowledgeBase?: string) => {
    setSuggestingFor(interaction.id);

    try {
      const { data, error } = await supabase.functions.invoke('digital-trends', {
        body: {
          type: 'suggest_response',
          query: {
            interaction_type: interaction.interaction_type,
            platform: platformName || 'Rede social',
            content: interaction.content,
            funnel_stage: interaction.funnel_stage,
            knowledge_base: knowledgeBase,
          },
        },
      });

      if (error) throw error;

      if (data?.success && data?.data?.response) {
        await updateInteraction(interaction.id, {
          ai_suggested_response: data.data.response,
        } as Partial<DigitalInteraction>);
        toast.success('Sugestão gerada!');
      }
    } catch (error) {
      console.error('Error suggesting response:', error);
      toast.error('Erro ao gerar sugestão');
    } finally {
      setSuggestingFor(null);
    }
  }, [updateInteraction]);

  const getByFunnelStage = useCallback((stage: string) => {
    return interactions.filter(i => i.funnel_stage === stage);
  }, [interactions]);

  const getPendingCount = useCallback(() => {
    return interactions.filter(i => i.status === 'pending').length;
  }, [interactions]);

  const getStats = useCallback(() => {
    return {
      total: interactions.length,
      pending: interactions.filter(i => i.status === 'pending').length,
      responded: interactions.filter(i => i.status === 'responded').length,
      byFunnel: Object.keys(FUNNEL_STAGES).reduce((acc, stage) => {
        acc[stage] = interactions.filter(i => i.funnel_stage === stage).length;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [interactions]);

  useEffect(() => {
    fetchInteractions();

    const channel = supabase
      .channel('interactions-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'digital_interactions',
      }, fetchInteractions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInteractions]);

  return {
    interactions,
    loading,
    suggestingFor,
    createInteraction,
    updateInteraction,
    deleteInteraction,
    markAsResponded,
    suggestResponse,
    getByFunnelStage,
    getPendingCount,
    getStats,
    refetch: fetchInteractions,
    FUNNEL_STAGES,
    INTERACTION_TYPES,
  };
}
