import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Platform {
  id: string;
  name: string;
  icon: string;
  group_type: 'social' | 'ecommerce' | 'marketplace' | 'other';
  aspect_ratio: string | null;
  duration: string | null;
  fields: string[];
  checklist_template: { id: string; text: string }[];
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export const GROUP_LABELS: Record<string, string> = {
  social: 'Redes Sociais',
  ecommerce: 'E-commerce',
  marketplace: 'Marketplaces',
  other: 'Outros',
};

export const GROUP_ICONS: Record<string, string> = {
  social: '📱',
  ecommerce: '🛒',
  marketplace: '🏪',
  other: '📦',
};

export function usePlatforms() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlatforms = useCallback(async () => {
    const { data, error } = await supabase
      .from('digital_platforms')
      .select('*')
      .order('group_type')
      .order('order_index');

    if (error) {
      console.error('Error fetching platforms:', error);
      setLoading(false);
      return;
    }

    // Parse checklist_template from Json to proper array
    const parsedData = (data || []).map(p => ({
      ...p,
      fields: p.fields || [],
      checklist_template: Array.isArray(p.checklist_template) 
        ? p.checklist_template as { id: string; text: string }[]
        : [],
    })) as Platform[];

    setPlatforms(parsedData);
    setLoading(false);
  }, []);

  const createPlatform = useCallback(async (platform: Partial<Platform>) => {
    const { data, error } = await supabase
      .from('digital_platforms')
      .insert({
        name: platform.name || 'Nova Plataforma',
        icon: platform.icon || '📱',
        group_type: platform.group_type || 'other',
        aspect_ratio: platform.aspect_ratio,
        duration: platform.duration,
        fields: platform.fields || ['caption', 'cta'],
        checklist_template: platform.checklist_template || [],
        is_active: true,
        order_index: platforms.length,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar plataforma');
      return null;
    }

    toast.success('Plataforma criada!');
    fetchPlatforms();
    return data as Platform;
  }, [fetchPlatforms, platforms.length]);

  const updatePlatform = useCallback(async (id: string, updates: Partial<Platform>) => {
    const { error } = await supabase
      .from('digital_platforms')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar plataforma');
      return;
    }

    fetchPlatforms();
  }, [fetchPlatforms]);

  const deletePlatform = useCallback(async (id: string) => {
    // Check if there are variations using this platform
    const { data: variations } = await supabase
      .from('digital_variations')
      .select('id')
      .eq('platform', id)
      .limit(1);

    if (variations && variations.length > 0) {
      toast.error('Não é possível excluir: existem variações usando esta plataforma');
      return false;
    }

    const { error } = await supabase
      .from('digital_platforms')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir plataforma');
      return false;
    }

    toast.success('Plataforma excluída!');
    fetchPlatforms();
    return true;
  }, [fetchPlatforms]);

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    await updatePlatform(id, { is_active: isActive });
    toast.success(isActive ? 'Plataforma ativada' : 'Plataforma desativada');
  }, [updatePlatform]);

  // Group platforms by type
  const groupedPlatforms = platforms.reduce((acc, p) => {
    const group = p.group_type || 'other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(p);
    return acc;
  }, {} as Record<string, Platform[]>);

  // Only active platforms for use in variations
  const activePlatforms = platforms.filter(p => p.is_active);

  // Convert to PLATFORMS-like object for backwards compatibility
  const platformsMap = activePlatforms.reduce((acc, p) => {
    acc[p.id] = {
      label: p.name,
      icon: p.icon,
      group: p.group_type,
      aspectRatio: p.aspect_ratio,
      duration: p.duration,
      fields: p.fields,
      checklist: p.checklist_template,
    };
    return acc;
  }, {} as Record<string, {
    label: string;
    icon: string;
    group: string;
    aspectRatio?: string | null;
    duration?: string | null;
    fields: string[];
    checklist: { id: string; text: string }[];
  }>);

  useEffect(() => {
    fetchPlatforms();

    const channel = supabase
      .channel('platforms-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'digital_platforms',
      }, fetchPlatforms)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPlatforms]);

  return {
    platforms,
    activePlatforms,
    groupedPlatforms,
    platformsMap,
    loading,
    createPlatform,
    updatePlatform,
    deletePlatform,
    toggleActive,
    refetch: fetchPlatforms,
    GROUP_LABELS,
    GROUP_ICONS,
  };
}
