import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductionClosingItem {
  id: string;
  closing_id: string;
  employee_name: string;
  process_id: string | null;
  total_quantity: number;
  total_value: number;
  process?: {
    id: string;
    name: string;
  };
}

export interface ProductionClosing {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  total_value: number;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
  items?: ProductionClosingItem[];
}

export const CLOSING_STATUS = {
  aberto: { label: 'Aberto', color: 'bg-blue-500' },
  pago: { label: 'Pago', color: 'bg-green-500' },
};

export function useProductionClosing() {
  const [closings, setClosings] = useState<ProductionClosing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClosings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_closings')
      .select(`
        *,
        items:production_closing_items(
          *,
          process:processes(id, name)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching closings:', error);
    } else {
      setClosings(data || []);
    }
    setLoading(false);
  }, []);

  // Create a new closing period
  const createClosing = useCallback(async (startDate: string, endDate: string, notes?: string) => {
    // Get all entries in the period
    const { data: entries, error: entriesError } = await supabase
      .from('production_entries')
      .select(`
        employee_name,
        process_id,
        quantity,
        total_value,
        process:processes(id, name)
      `)
      .gte('date', startDate)
      .lte('date', endDate);

    if (entriesError) {
      toast.error('Erro ao buscar lançamentos');
      return null;
    }

    if (!entries || entries.length === 0) {
      toast.error('Nenhum lançamento no período');
      return null;
    }

    // Aggregate by employee + process
    const aggregated: Record<string, { employee_name: string; process_id: string; total_quantity: number; total_value: number }> = {};
    let grandTotal = 0;

    entries.forEach((entry: any) => {
      const key = `${entry.employee_name}|${entry.process_id}`;
      if (!aggregated[key]) {
        aggregated[key] = {
          employee_name: entry.employee_name,
          process_id: entry.process_id,
          total_quantity: 0,
          total_value: 0,
        };
      }
      aggregated[key].total_quantity += entry.quantity;
      aggregated[key].total_value += entry.total_value;
      grandTotal += entry.total_value;
    });

    // Create closing
    const { data: closing, error: closingError } = await supabase
      .from('production_closings')
      .insert({
        start_date: startDate,
        end_date: endDate,
        status: 'aberto',
        total_value: grandTotal,
        notes,
      })
      .select()
      .single();

    if (closingError) {
      toast.error('Erro ao criar fechamento');
      return null;
    }

    // Insert items
    const items = Object.values(aggregated).map(item => ({
      closing_id: closing.id,
      employee_name: item.employee_name,
      process_id: item.process_id,
      total_quantity: item.total_quantity,
      total_value: item.total_value,
    }));

    const { error: itemsError } = await supabase
      .from('production_closing_items')
      .insert(items);

    if (itemsError) {
      console.error('Error inserting closing items:', itemsError);
    }

    toast.success('Fechamento criado');
    fetchClosings();
    return closing;
  }, [fetchClosings]);

  // Mark closing as paid
  const markAsPaid = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('production_closings')
      .update({
        status: 'pago',
        closed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao marcar como pago');
      return false;
    }

    toast.success('Fechamento marcado como pago');
    fetchClosings();
    return true;
  }, [fetchClosings]);

  // Delete closing
  const deleteClosing = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('production_closings')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir fechamento');
      return false;
    }

    toast.success('Fechamento excluído');
    setClosings(prev => prev.filter(c => c.id !== id));
    return true;
  }, []);

  // Get summary by employee for a closing
  const getClosingSummaryByEmployee = useCallback((closing: ProductionClosing) => {
    const byEmployee: Record<string, { total: number; items: ProductionClosingItem[] }> = {};

    (closing.items || []).forEach(item => {
      if (!byEmployee[item.employee_name]) {
        byEmployee[item.employee_name] = { total: 0, items: [] };
      }
      byEmployee[item.employee_name].total += item.total_value;
      byEmployee[item.employee_name].items.push(item);
    });

    return byEmployee;
  }, []);

  useEffect(() => {
    fetchClosings();
  }, [fetchClosings]);

  return {
    closings,
    loading,
    fetchClosings,
    createClosing,
    markAsPaid,
    deleteClosing,
    getClosingSummaryByEmployee,
  };
}
