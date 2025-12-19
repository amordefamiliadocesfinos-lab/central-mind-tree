import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductionLog {
  id: string;
  date: string;
  period: 'manha' | 'tarde' | 'noite';
  employee_name: string;
  process: string;
  product_id: string | null;
  quantity: number;
  notes: string | null;
  warnings: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
}

export interface ProductionSummary {
  total_quantity: number;
  by_employee: Record<string, number>;
  by_process: Record<string, number>;
  by_product: Record<string, { name: string; quantity: number }>;
  employees_working: string[];
}

export const PRODUCTION_PERIODS = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
} as const;

export const PRODUCTION_PROCESSES = [
  'preparo',
  'producao',
  'embalagem',
  'conferencia',
  'expedicao',
] as const;

export const PROCESS_LABELS: Record<string, string> = {
  preparo: 'Preparo',
  producao: 'Produção',
  embalagem: 'Embalagem',
  conferencia: 'Conferência',
  expedicao: 'Expedição',
};

export function useProductionLogs() {
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async (date?: string) => {
    setLoading(true);
    let query = supabase
      .from('production_logs')
      .select(`
        *,
        product:products(id, name, sku)
      `)
      .order('created_at', { ascending: false });

    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching production logs:', error);
      setLoading(false);
      return;
    }

    setLogs((data || []) as ProductionLog[]);
    setLoading(false);
  }, []);

  const createLog = useCallback(async (log: Omit<ProductionLog, 'id' | 'created_at' | 'updated_at' | 'product'>) => {
    const { data, error } = await supabase
      .from('production_logs')
      .insert({
        date: log.date,
        period: log.period,
        employee_name: log.employee_name,
        process: log.process,
        product_id: log.product_id,
        quantity: log.quantity,
        notes: log.notes,
        warnings: log.warnings,
        order_id: log.order_id,
      })
      .select(`*, product:products(id, name, sku)`)
      .single();

    if (error) {
      toast.error('Erro ao criar lançamento');
      return null;
    }

    toast.success('Lançamento criado!');
    setLogs(prev => [data as ProductionLog, ...prev]);
    return data as ProductionLog;
  }, []);

  const updateLog = useCallback(async (id: string, updates: Partial<ProductionLog>) => {
    const { data, error } = await supabase
      .from('production_logs')
      .update({
        date: updates.date,
        period: updates.period,
        employee_name: updates.employee_name,
        process: updates.process,
        product_id: updates.product_id,
        quantity: updates.quantity,
        notes: updates.notes,
        warnings: updates.warnings,
        order_id: updates.order_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`*, product:products(id, name, sku)`)
      .single();

    if (error) {
      toast.error('Erro ao atualizar lançamento');
      return null;
    }

    toast.success('Lançamento atualizado!');
    setLogs(prev => prev.map(l => l.id === id ? data as ProductionLog : l));
    return data as ProductionLog;
  }, []);

  const deleteLog = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('production_logs')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir lançamento');
      return false;
    }

    toast.success('Lançamento excluído!');
    setLogs(prev => prev.filter(l => l.id !== id));
    return true;
  }, []);

  const getSummary = useCallback((logsToSummarize: ProductionLog[]): ProductionSummary => {
    const summary: ProductionSummary = {
      total_quantity: 0,
      by_employee: {},
      by_process: {},
      by_product: {},
      employees_working: [],
    };

    const employeeSet = new Set<string>();

    logsToSummarize.forEach(log => {
      summary.total_quantity += log.quantity;
      employeeSet.add(log.employee_name);

      // By employee
      summary.by_employee[log.employee_name] = 
        (summary.by_employee[log.employee_name] || 0) + log.quantity;

      // By process
      summary.by_process[log.process] = 
        (summary.by_process[log.process] || 0) + log.quantity;

      // By product
      if (log.product_id && log.product) {
        if (!summary.by_product[log.product_id]) {
          summary.by_product[log.product_id] = {
            name: log.product.name,
            quantity: 0,
          };
        }
        summary.by_product[log.product_id].quantity += log.quantity;
      }
    });

    summary.employees_working = Array.from(employeeSet);
    return summary;
  }, []);

  const getLogsByDate = useCallback(async (date: string): Promise<ProductionLog[]> => {
    const { data, error } = await supabase
      .from('production_logs')
      .select(`*, product:products(id, name, sku)`)
      .eq('date', date)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching logs by date:', error);
      return [];
    }

    return (data || []) as ProductionLog[];
  }, []);

  const getLogsByEmployee = useCallback(async (employeeName: string, startDate?: string, endDate?: string): Promise<ProductionLog[]> => {
    let query = supabase
      .from('production_logs')
      .select(`*, product:products(id, name, sku)`)
      .eq('employee_name', employeeName);

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query.order('date', { ascending: false });

    if (error) {
      console.error('Error fetching logs by employee:', error);
      return [];
    }

    return (data || []) as ProductionLog[];
  }, []);

  const getUniqueEmployees = useCallback(async (): Promise<string[]> => {
    const { data, error } = await supabase
      .from('production_logs')
      .select('employee_name')
      .order('employee_name');

    if (error) return [];

    const unique = new Set((data || []).map(d => d.employee_name));
    return Array.from(unique);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    fetchLogs,
    createLog,
    updateLog,
    deleteLog,
    getSummary,
    getLogsByDate,
    getLogsByEmployee,
    getUniqueEmployees,
    PERIODS: PRODUCTION_PERIODS,
    PROCESSES: PRODUCTION_PROCESSES,
    PROCESS_LABELS,
  };
}
