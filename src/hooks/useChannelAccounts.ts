import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChannelAccount {
  id: string;
  platform_id: string;
  name: string;
  external_identifier: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const DUPLICATE_MESSAGE = 'Já existe uma conta com este nome nesta plataforma.';

function isDuplicateError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '23505' || (error.message || '').includes('channel_accounts_platform_name_unique_idx');
}

/**
 * Gestão das Contas/Lojas canônicas (channel_accounts) vinculadas a uma Plataforma.
 * Fonte única consumida pelos demais módulos (ex.: importador Shopee).
 */
export function useChannelAccounts(platformId: string | null) {
  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!platformId) {
      setAccounts([]);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('channel_accounts')
      .select('*')
      .eq('platform_id', platformId)
      .order('name');

    if (error) {
      console.error('Error fetching channel accounts:', error);
      toast.error('Erro ao carregar contas/lojas');
    } else {
      setAccounts((data || []) as ChannelAccount[]);
    }
    setLoading(false);
  }, [platformId]);

  const createAccount = useCallback(async (name: string): Promise<boolean> => {
    if (!platformId) return false;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Informe o nome da conta/loja');
      return false;
    }

    setSaving(true);
    const { error } = await (supabase as any)
      .from('channel_accounts')
      .insert({ platform_id: platformId, name: trimmed });
    setSaving(false);

    if (error) {
      if (isDuplicateError(error)) {
        toast.error(DUPLICATE_MESSAGE);
      } else {
        console.error('Error creating channel account:', error);
        toast.error('Erro ao cadastrar conta/loja');
      }
      return false;
    }

    toast.success('Conta/Loja cadastrada!');
    fetchAccounts();
    return true;
  }, [platformId, fetchAccounts]);

  const updateAccountName = useCallback(async (id: string, name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Informe o nome da conta/loja');
      return false;
    }

    setSaving(true);
    const { error } = await (supabase as any)
      .from('channel_accounts')
      .update({ name: trimmed })
      .eq('id', id);
    setSaving(false);

    if (error) {
      if (isDuplicateError(error)) {
        toast.error(DUPLICATE_MESSAGE);
      } else {
        console.error('Error updating channel account:', error);
        toast.error('Erro ao atualizar conta/loja');
      }
      return false;
    }

    toast.success('Conta/Loja atualizada!');
    fetchAccounts();
    return true;
  }, [fetchAccounts]);

  const toggleAccountActive = useCallback(async (id: string, isActive: boolean) => {
    const { error } = await (supabase as any)
      .from('channel_accounts')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      console.error('Error toggling channel account:', error);
      toast.error('Erro ao alterar status da conta/loja');
      return;
    }

    toast.success(isActive ? 'Conta/Loja ativada' : 'Conta/Loja desativada');
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return {
    accounts,
    loading,
    saving,
    createAccount,
    updateAccountName,
    toggleAccountActive,
    refetch: fetchAccounts,
  };
}
