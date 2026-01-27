import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface KnowledgeItem {
  id: string;
  platform_id: string | null;
  category: string;
  question: string;
  answer: string;
  keywords: string[] | null;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export function useKnowledgeBase() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('digital_knowledge_base')
      .select('*')
      .order('category')
      .order('usage_count', { ascending: false });

    if (error) {
      console.error('Error fetching knowledge base:', error);
      setLoading(false);
      return;
    }

    setItems((data || []) as unknown as KnowledgeItem[]);
    setLoading(false);
  }, []);

  const createItem = useCallback(async (item: Partial<KnowledgeItem>) => {
    const { data, error } = await supabase
      .from('digital_knowledge_base')
      .insert({
        platform_id: item.platform_id,
        category: item.category || 'geral',
        question: item.question || '',
        answer: item.answer || '',
        keywords: item.keywords || [],
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar item');
      return null;
    }

    toast.success('FAQ adicionada!');
    fetchItems();
    return data as unknown as KnowledgeItem;
  }, [fetchItems]);

  const updateItem = useCallback(async (id: string, updates: Partial<KnowledgeItem>) => {
    const { error } = await supabase
      .from('digital_knowledge_base')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar item');
      return;
    }

    fetchItems();
  }, [fetchItems]);

  const deleteItem = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('digital_knowledge_base')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir item');
      return;
    }

    toast.success('FAQ excluída');
    fetchItems();
  }, [fetchItems]);

  const incrementUsage = useCallback(async (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      await updateItem(id, { usage_count: item.usage_count + 1 });
    }
  }, [items, updateItem]);

  const searchByKeywords = useCallback((query: string) => {
    const queryLower = query.toLowerCase();
    return items.filter(item => {
      if (!item.is_active) return false;
      
      // Search in question
      if (item.question.toLowerCase().includes(queryLower)) return true;
      
      // Search in answer
      if (item.answer.toLowerCase().includes(queryLower)) return true;
      
      // Search in keywords
      if (item.keywords?.some(k => k.toLowerCase().includes(queryLower))) return true;
      
      return false;
    });
  }, [items]);

  const getCategories = useCallback(() => {
    const categories = new Set(items.map(i => i.category));
    return Array.from(categories);
  }, [items]);

  useEffect(() => {
    fetchItems();

    const channel = supabase
      .channel('knowledge-base-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'digital_knowledge_base',
      }, fetchItems)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchItems]);

  return {
    items,
    loading,
    createItem,
    updateItem,
    deleteItem,
    incrementUsage,
    searchByKeywords,
    getCategories,
    refetch: fetchItems,
  };
}
