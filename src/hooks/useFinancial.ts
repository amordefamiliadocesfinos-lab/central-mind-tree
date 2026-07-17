import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format, isBefore, startOfDay, parseISO } from 'date-fns';

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'pagar' | 'receber' | 'ambos';
  color: string;
  is_active: boolean;
}

export interface FinancialAccount {
  id: string;
  name: string;
  type: 'caixa' | 'banco' | 'cartao';
  initial_balance: number;
  current_balance: number;
  bank_name?: string;
  agency?: string;
  account_number?: string;
  is_active: boolean;
}

export interface FinancialEntry {
  id: string;
  type: 'pagar' | 'receber';
  description: string;
  value: number;
  value_paid: number;
  due_date: string;
  payment_date?: string;
  category_id?: string;
  account_id?: string;
  contact_id?: string;
  order_id?: string;
  document_number?: string;
  notes?: string;
  is_conciliated: boolean;
  conciliated_at?: string;
  created_at: string;
  updated_at: string;
  category?: FinancialCategory;
  account?: FinancialAccount;
  contact?: { id: string; name: string };
  // Recurrence fields
  recurrence_type?: string;
  recurrence_day?: number;
  recurrence_end_date?: string;
  recurrence_use_business_days?: boolean;
  parent_entry_id?: string;
  original_due_date?: string;
  issue_date?: string;
  competence_date?: string;
}

export interface FinancialMovement {
  id: string;
  entry_id: string;
  account_id?: string;
  value: number;
  movement_date: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  account?: FinancialAccount;
}

export type EntryStatus = 'atrasada' | 'parcial' | 'pago' | 'em_aberto';

export interface FinancialSummary {
  total_open: number;
  total_overdue: number;
  total_paid: number;
  count_open: number;
  count_overdue: number;
  count_paid: number;
  count_partial: number;
}

export interface FinancialFilters {
  type?: 'pagar' | 'receber';
  status?: EntryStatus | 'all';
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  accountId?: string;
  search?: string;
}

export function getEntryStatus(entry: FinancialEntry): EntryStatus {
  const today = startOfDay(new Date());
  const dueDate = startOfDay(new Date(entry.due_date));
  
  if (entry.value_paid >= entry.value) {
    return 'pago';
  }
  if (entry.value_paid > 0 && entry.value_paid < entry.value) {
    return 'parcial';
  }
  if (isBefore(dueDate, today) && entry.value_paid < entry.value) {
    return 'atrasada';
  }
  return 'em_aberto';
}

export function useFinancial() {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FinancialFilters>({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    status: 'all',
  });

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('financial_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setCategories(data as FinancialCategory[]);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('financial_accounts')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setAccounts(data as FinancialAccount[]);
    }
  }, []);

  const fetchEntries = useCallback(async (customFilters?: FinancialFilters) => {
    setLoading(true);
    const activeFilters = customFilters || filters;

    let query = supabase
      .from('financial_entries')
      .select(`
        *,
        category:financial_categories(*),
        account:financial_accounts(*),
        contact:contacts(id, name)
      `)
      .order('due_date', { ascending: true });

    if (activeFilters.type) {
      query = query.eq('type', activeFilters.type);
    }

    if (activeFilters.startDate) {
      query = query.gte('due_date', format(activeFilters.startDate, 'yyyy-MM-dd'));
    }

    if (activeFilters.endDate) {
      query = query.lte('due_date', format(activeFilters.endDate, 'yyyy-MM-dd'));
    }

    if (activeFilters.categoryId) {
      query = query.eq('category_id', activeFilters.categoryId);
    }

    if (activeFilters.accountId) {
      query = query.eq('account_id', activeFilters.accountId);
    }

    if (activeFilters.search) {
      query = query.ilike('description', `%${activeFilters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching entries:', error);
      setLoading(false);
      return;
    }

    let filteredData = (data || []) as FinancialEntry[];

    // Filter by status in memory (since it's calculated)
    if (activeFilters.status && activeFilters.status !== 'all') {
      filteredData = filteredData.filter(e => getEntryStatus(e) === activeFilters.status);
    }

    setEntries(filteredData);
    setLoading(false);
  }, [filters]);

  const createEntry = async (entry: Omit<FinancialEntry, 'id' | 'value_paid' | 'is_conciliated' | 'created_at' | 'updated_at'> & { saveAndPay?: boolean }) => {
    const { data, error } = await supabase
      .from('financial_entries')
      .insert({
        type: entry.type,
        description: entry.description,
        value: entry.value,
        due_date: entry.due_date,
        payment_date: entry.payment_date,
        category_id: entry.category_id,
        account_id: entry.account_id,
        contact_id: entry.contact_id,
        order_id: entry.order_id,
        document_number: entry.document_number,
        notes: entry.notes,
        recurrence_type: entry.recurrence_type,
        recurrence_day: entry.recurrence_day,
        recurrence_end_date: entry.recurrence_end_date,
        recurrence_use_business_days: entry.recurrence_use_business_days,
        issue_date: entry.issue_date,
        competence_date: entry.competence_date,
        original_due_date: entry.due_date,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating entry:', error);
      throw error;
    }

    // If saveAndPay is true, register a full payment
    if (entry.saveAndPay && data) {
      await registerPayment(data.id, entry.value, entry.account_id);
    }

    fetchEntries();
    return data;
  };

  const updateEntry = async (id: string, updates: Partial<FinancialEntry>) => {
    const { error } = await supabase
      .from('financial_entries')
      .update({
        description: updates.description,
        value: updates.value,
        due_date: updates.due_date,
        payment_date: updates.payment_date,
        category_id: updates.category_id,
        account_id: updates.account_id,
        contact_id: updates.contact_id,
        document_number: updates.document_number,
        notes: updates.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating entry:', error);
      throw error;
    }

    fetchEntries();
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase
      .from('financial_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting entry:', error);
      throw error;
    }

    fetchEntries();
  };

  const registerPayment = async (entryId: string, value: number, accountId?: string, notes?: string) => {
    const { error } = await supabase
      .from('financial_movements')
      .insert({
        entry_id: entryId,
        account_id: accountId,
        value,
        movement_date: format(new Date(), 'yyyy-MM-dd'),
        notes,
      });

    if (error) {
      console.error('Error registering payment:', error);
      throw error;
    }

    // Update payment_date if fully paid
    const entry = entries.find(e => e.id === entryId);
    if (entry && (entry.value_paid + value) >= entry.value) {
      await supabase
        .from('financial_entries')
        .update({ payment_date: format(new Date(), 'yyyy-MM-dd') })
        .eq('id', entryId);
    }

    fetchEntries();
    fetchAccounts();
  };

  const registerBatchPayment = async (payments: { id: string; value: number; accountId?: string }[]) => {
    for (const payment of payments) {
      await registerPayment(payment.id, payment.value, payment.accountId);
    }
  };

  const conciliateEntry = async (id: string) => {
    const { error } = await supabase
      .from('financial_entries')
      .update({
        is_conciliated: true,
        conciliated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error conciliating entry:', error);
      throw error;
    }

    fetchEntries();
  };

  const getSummary = useCallback((type: 'pagar' | 'receber'): FinancialSummary => {
    const typeEntries = entries.filter(e => e.type === type);
    
    return {
      total_open: typeEntries.filter(e => getEntryStatus(e) === 'em_aberto').reduce((sum, e) => sum + (e.value - e.value_paid), 0),
      total_overdue: typeEntries.filter(e => getEntryStatus(e) === 'atrasada').reduce((sum, e) => sum + (e.value - e.value_paid), 0),
      total_paid: typeEntries.filter(e => getEntryStatus(e) === 'pago').reduce((sum, e) => sum + e.value, 0),
      count_open: typeEntries.filter(e => getEntryStatus(e) === 'em_aberto').length,
      count_overdue: typeEntries.filter(e => getEntryStatus(e) === 'atrasada').length,
      count_paid: typeEntries.filter(e => getEntryStatus(e) === 'pago').length,
      count_partial: typeEntries.filter(e => getEntryStatus(e) === 'parcial').length,
    };
  }, [entries]);

  const getDashboardSummary = useCallback(() => {
    const pagar = getSummary('pagar');
    const receber = getSummary('receber');

    return {
      pagar,
      receber,
      totalEntradas: receber.total_paid,
      totalSaidas: pagar.total_paid,
      saldo: receber.total_paid - pagar.total_paid,
      totalAccountsBalance: accounts.reduce((sum, a) => sum + a.current_balance, 0),
    };
  }, [getSummary, accounts]);

  // Export to CSV
  const exportToCSV = useCallback((type?: 'pagar' | 'receber') => {
    const dataToExport = type ? entries.filter(e => e.type === type) : entries;
    
    const headers = ['Descrição', 'Tipo', 'Valor', 'Valor Pago', 'Vencimento', 'Status', 'Categoria', 'Conta'];
    const rows = dataToExport.map(e => [
      e.description,
      e.type === 'pagar' ? 'A Pagar' : 'A Receber',
      e.value.toFixed(2),
      e.value_paid.toFixed(2),
      format(new Date(e.due_date), 'dd/MM/yyyy'),
      getEntryStatus(e),
      e.category?.name || '',
      e.account?.name || '',
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financeiro_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  }, [entries]);

  // Create/Update Category
  const saveCategory = async (category: Partial<FinancialCategory> & { name: string; type: string }) => {
    if (category.id) {
      await supabase.from('financial_categories').update(category).eq('id', category.id);
    } else {
      await supabase.from('financial_categories').insert(category);
    }
    fetchCategories();
  };

  // Create/Update Account
  const saveAccount = async (account: Partial<FinancialAccount> & { name: string; type: string }) => {
    if (account.id) {
      await supabase.from('financial_accounts').update(account).eq('id', account.id);
    } else {
      await supabase.from('financial_accounts').insert({
        ...account,
        current_balance: account.initial_balance || 0,
      });
    }
    fetchAccounts();
  };

  useEffect(() => {
    Promise.all([fetchCategories(), fetchAccounts()]).then(() => {
      fetchEntries();
    });
  }, []);

  return {
    entries,
    categories,
    accounts,
    loading,
    filters,
    setFilters,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    registerPayment,
    registerBatchPayment,
    conciliateEntry,
    getSummary,
    getDashboardSummary,
    exportToCSV,
    saveCategory,
    saveAccount,
    fetchAccounts,
    getEntryStatus,
  };
}
