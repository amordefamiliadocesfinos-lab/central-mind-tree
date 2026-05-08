import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductCategory {
  id: string;
  name: string;
  color: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useProductCategories() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .eq('is_active', true)
      .order('order_index');
    if (!error && data) setCategories(data as ProductCategory[]);
    setLoading(false);
  }, []);

  const createCategory = useCallback(async (name: string, color?: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Informe o nome da categoria');
      return null;
    }
    const { data, error } = await supabase
      .from('product_categories')
      .insert({ name: trimmed, color: color || null, order_index: categories.length })
      .select()
      .single();
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Categoria já existe' : 'Erro ao criar categoria');
      return null;
    }
    toast.success('Categoria criada!');
    fetchCategories();
    return data as ProductCategory;
  }, [categories.length, fetchCategories]);

  const updateCategory = useCallback(async (id: string, updates: Partial<ProductCategory>) => {
    const { error } = await supabase.from('product_categories').update(updates).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar categoria');
      return;
    }
    toast.success('Categoria atualizada!');
    fetchCategories();
  }, [fetchCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await supabase.from('product_categories').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir categoria');
      return false;
    }
    toast.success('Categoria excluída!');
    fetchCategories();
    return true;
  }, [fetchCategories]);

  useEffect(() => {
    fetchCategories();
    const channel = supabase
      .channel('product-categories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_categories' }, fetchCategories)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCategories]);

  return {
    categories,
    categoryNames: categories.map(c => c.name),
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    refetch: fetchCategories,
  };
}
