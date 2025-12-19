import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StorageLocation {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export function useStorageLocations() {
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('storage_locations')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching locations:', error);
      setLoading(false);
      return [];
    }

    setLocations((data as StorageLocation[]) || []);
    setLoading(false);
    return (data as StorageLocation[]) || [];
  }, []);

  const createLocation = useCallback(async (name: string, description?: string) => {
    const { data, error } = await supabase
      .from('storage_locations')
      .insert({ name, description: description || null })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        toast.error('Já existe um local com esse nome');
      } else {
        toast.error('Erro ao criar local');
      }
      return null;
    }

    toast.success('Local criado!');
    fetchLocations();
    return data as StorageLocation;
  }, [fetchLocations]);

  const updateLocation = useCallback(async (id: string, updates: Partial<StorageLocation>) => {
    const { error } = await supabase
      .from('storage_locations')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar local');
      return false;
    }

    toast.success('Local atualizado!');
    fetchLocations();
    return true;
  }, [fetchLocations]);

  const deleteLocation = useCallback(async (id: string) => {
    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('storage_locations')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao remover local');
      return false;
    }

    toast.success('Local removido!');
    fetchLocations();
    return true;
  }, [fetchLocations]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  return {
    locations,
    loading,
    fetchLocations,
    createLocation,
    updateLocation,
    deleteLocation,
  };
}
