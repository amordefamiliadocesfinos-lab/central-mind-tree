import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface IdeaType {
  id: string;
  key: string;
  label: string;
  icon: string;
  color: string;
  is_default: boolean;
  order_index: number;
  is_active: boolean;
}

export function useIdeaTypes() {
  const [ideaTypes, setIdeaTypes] = useState<IdeaType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('digital_idea_types')
      .select('*')
      .eq('is_active', true)
      .order('order_index');

    if (error) {
      console.error('Error fetching idea types:', error);
      setLoading(false);
      return;
    }

    setIdeaTypes((data || []) as unknown as IdeaType[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const typesMap = new Map(ideaTypes.map(t => [t.key, t]));

  const getType = (key: string): IdeaType | undefined => typesMap.get(key);

  const createType = useCallback(async (type: { label: string; icon: string; color: string }) => {
    const key = type.label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    const maxOrder = ideaTypes.reduce((max, t) => Math.max(max, t.order_index), 0);

    const { error } = await supabase
      .from('digital_idea_types')
      .insert({
        key,
        label: type.label,
        icon: type.icon,
        color: type.color,
        order_index: maxOrder + 1,
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('Já existe um tipo com esse nome');
      } else {
        toast.error('Erro ao criar tipo');
      }
      return null;
    }

    toast.success('Tipo criado!');
    fetchTypes();
    return key;
  }, [ideaTypes, fetchTypes]);

  const updateType = useCallback(async (id: string, updates: Partial<Pick<IdeaType, 'label' | 'icon' | 'color'>>) => {
    const { error } = await supabase
      .from('digital_idea_types')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar tipo');
      return;
    }

    fetchTypes();
  }, [fetchTypes]);

  const deleteType = useCallback(async (id: string) => {
    const type = ideaTypes.find(t => t.id === id);
    if (type?.is_default) {
      toast.error('Tipos padrão não podem ser excluídos');
      return;
    }

    const { error } = await supabase
      .from('digital_idea_types')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir tipo');
      return;
    }

    toast.success('Tipo removido!');
    fetchTypes();
  }, [ideaTypes, fetchTypes]);

  return {
    ideaTypes,
    loading,
    typesMap,
    getType,
    createType,
    updateType,
    deleteType,
    refetch: fetchTypes,
  };
}
