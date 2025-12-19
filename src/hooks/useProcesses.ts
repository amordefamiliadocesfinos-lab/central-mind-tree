import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Process {
  id: string;
  name: string;
  unit: string;
  value_per_unit: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useProcesses() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProcesses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('processes')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching processes:', error);
      toast.error('Erro ao carregar processos');
    } else {
      setProcesses(data || []);
    }
    setLoading(false);
  }, []);

  const createProcess = useCallback(async (process: { name: string; unit?: string; value_per_unit?: number; is_active?: boolean; description?: string }) => {
    const { data, error } = await supabase
      .from('processes')
      .insert({
        name: process.name,
        unit: process.unit || 'un',
        value_per_unit: process.value_per_unit || 0,
        is_active: process.is_active ?? true,
        description: process.description || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating process:', error);
      toast.error('Erro ao criar processo');
      return null;
    }

    toast.success('Processo criado');
    setProcesses(prev => [...prev, data]);
    return data;
  }, []);

  const updateProcess = useCallback(async (id: string, updates: Partial<Process>) => {
    const { data, error } = await supabase
      .from('processes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating process:', error);
      toast.error('Erro ao atualizar processo');
      return null;
    }

    toast.success('Processo atualizado');
    setProcesses(prev => prev.map(p => p.id === id ? data : p));
    return data;
  }, []);

  const deleteProcess = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('processes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting process:', error);
      toast.error('Erro ao excluir processo');
      return false;
    }

    toast.success('Processo excluído');
    setProcesses(prev => prev.filter(p => p.id !== id));
    return true;
  }, []);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  return {
    processes,
    activeProcesses: processes.filter(p => p.is_active),
    loading,
    fetchProcesses,
    createProcess,
    updateProcess,
    deleteProcess,
  };
}
