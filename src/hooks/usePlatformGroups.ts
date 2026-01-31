import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PlatformGroup {
  id: string;
  name: string;
  icon: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

export function usePlatformGroups() {
  const [groups, setGroups] = useState<PlatformGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    const { data, error } = await supabase
      .from('digital_platform_groups')
      .select('*')
      .order('order_index');

    if (error) {
      console.error('Error fetching platform groups:', error);
      setLoading(false);
      return;
    }

    setGroups(data || []);
    setLoading(false);
  }, []);

  const createGroup = useCallback(async (group: Partial<PlatformGroup>) => {
    const { data, error } = await supabase
      .from('digital_platform_groups')
      .insert({
        name: group.name || 'Novo Grupo',
        icon: group.icon || '📦',
        order_index: groups.length,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar grupo');
      return null;
    }

    toast.success('Grupo criado!');
    fetchGroups();
    return data as PlatformGroup;
  }, [fetchGroups, groups.length]);

  const updateGroup = useCallback(async (id: string, updates: Partial<PlatformGroup>) => {
    const { error } = await supabase
      .from('digital_platform_groups')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar grupo');
      return;
    }

    fetchGroups();
  }, [fetchGroups]);

  const deleteGroup = useCallback(async (id: string) => {
    // Check if there are platforms using this group
    const { data: platforms } = await supabase
      .from('digital_platforms')
      .select('id')
      .eq('group_id', id)
      .limit(1);

    if (platforms && platforms.length > 0) {
      toast.error('Não é possível excluir: existem plataformas neste grupo');
      return false;
    }

    const { error } = await supabase
      .from('digital_platform_groups')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir grupo');
      return false;
    }

    toast.success('Grupo excluído!');
    fetchGroups();
    return true;
  }, [fetchGroups]);

  useEffect(() => {
    fetchGroups();

    const channel = supabase
      .channel('platform-groups-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'digital_platform_groups',
      }, fetchGroups)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchGroups]);

  // Build lookup maps
  const groupsMap = groups.reduce((acc, g) => {
    acc[g.id] = g;
    return acc;
  }, {} as Record<string, PlatformGroup>);

  return {
    groups,
    groupsMap,
    loading,
    createGroup,
    updateGroup,
    deleteGroup,
    refetch: fetchGroups,
  };
}
