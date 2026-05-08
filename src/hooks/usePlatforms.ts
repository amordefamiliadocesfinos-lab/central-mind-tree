import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CustomField {
  id: string;
  label: string;
  type: 'input' | 'textarea' | 'number' | 'select' | 'date' | 'media';
  select_options?: string[];
}

export interface ReplicaField {
  id: string;
  label: string;
  type: 'input' | 'textarea' | 'number' | 'select' | 'media' | 'switch' | 'price' | 'tags' | 'date';
  placeholder?: string;
  hint?: string;
  required?: boolean;
  options?: string[];
  prefix?: string;
  suffix?: string;
  max_length?: number;
}

export interface ReplicaSection {
  id: string;
  title: string;
  icon?: string;
  fields: ReplicaField[];
}

export interface PlatformReplica {
  brand_color?: string;
  brand_name?: string;
  sections: ReplicaSection[];
}

export interface Platform {
  id: string;
  name: string;
  icon: string;
  group_type: 'social' | 'ecommerce' | 'marketplace' | 'other';
  group_id: string | null;
  parent_id: string | null;
  aspect_ratio: string | null;
  duration: string | null;
  fields: string[]; // Legacy - kept for backwards compatibility
  custom_fields: CustomField[];
  checklist_template: { id: string; text: string }[];
  structure_media_urls: string[];
  platform_replica: PlatformReplica;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// Legacy - kept for backwards compatibility
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

    // Parse checklist_template and custom_fields from Json to proper arrays
    const parsedData = (data || []).map(p => ({
      ...p,
      fields: p.fields || [],
      group_id: p.group_id || null,
      parent_id: p.parent_id || null,
      custom_fields: Array.isArray(p.custom_fields) 
        ? (p.custom_fields as unknown as CustomField[])
        : [],
      checklist_template: Array.isArray(p.checklist_template) 
        ? (p.checklist_template as unknown as { id: string; text: string }[])
        : [],
      structure_media_urls: Array.isArray((p as any).structure_media_urls)
        ? ((p as any).structure_media_urls as string[])
        : [],
      platform_replica: ((p as any).platform_replica && typeof (p as any).platform_replica === 'object' && Array.isArray((p as any).platform_replica.sections))
        ? ((p as any).platform_replica as PlatformReplica)
        : { sections: [] },
    })) as unknown as Platform[];

    setPlatforms(parsedData);
    setLoading(false);
  }, []);

  const createPlatform = useCallback(async (platform: Partial<Platform>) => {
    const insertData = {
      name: platform.name || 'Nova Plataforma',
      icon: platform.icon || '📱',
      group_type: platform.group_type || 'other',
      aspect_ratio: platform.aspect_ratio,
      duration: platform.duration,
      fields: platform.fields || ['caption', 'cta'],
      custom_fields: JSON.parse(JSON.stringify(platform.custom_fields || [
        { id: 'caption', label: 'Legenda', type: 'textarea' },
        { id: 'cta', label: 'Call to Action', type: 'input' },
      ])),
      checklist_template: JSON.parse(JSON.stringify(platform.checklist_template || [])),
      structure_media_urls: JSON.parse(JSON.stringify(platform.structure_media_urls || [])),
      is_active: true,
      order_index: platforms.length,
    };

    const { data, error } = await supabase
      .from('digital_platforms')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar plataforma');
      return null;
    }

    toast.success('Plataforma criada!');
    fetchPlatforms();
    return data as unknown as Platform;
  }, [fetchPlatforms, platforms.length]);

  const updatePlatform = useCallback(async (id: string, updates: Partial<Platform>) => {
    // Convert custom_fields to JSON-compatible format
    const dbUpdates: Record<string, unknown> = { ...updates };
    if (updates.custom_fields) {
      dbUpdates.custom_fields = JSON.parse(JSON.stringify(updates.custom_fields));
    }
    if (updates.checklist_template) {
      dbUpdates.checklist_template = JSON.parse(JSON.stringify(updates.checklist_template));
    }
    
    const { error } = await supabase
      .from('digital_platforms')
      .update(dbUpdates)
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

  // Group platforms by group_id (new) or group_type (legacy fallback)
  const groupedPlatforms = platforms.reduce((acc, p) => {
    const group = p.group_id || p.group_type || 'other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(p);
    return acc;
  }, {} as Record<string, Platform[]>);

  // Build parent-child hierarchy
  const getChildren = (parentId: string | null): Platform[] => {
    return platforms.filter(p => p.parent_id === parentId);
  };

  const rootPlatforms = platforms.filter(p => !p.parent_id);

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
      customFields: p.custom_fields,
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
    customFields: CustomField[];
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
    rootPlatforms,
    getChildren,
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
