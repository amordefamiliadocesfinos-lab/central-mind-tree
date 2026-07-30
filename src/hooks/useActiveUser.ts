import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AppUser {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  is_active: boolean;
}

/**
 * Identidade operacional.
 * Resolve exatamente um app_users ativo por auth_user_id = session.user.id.
 * Sem localStorage, sem fallback por e-mail/nome, sem escolha manual.
 */
export function useActiveUser() {
  const { user, loading: authLoading } = useAuth();
  const [activeUser, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLinked = useCallback(async () => {
    if (!user) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('app_users')
      .select('id, name, role, email, is_active')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    setUser(!error && data ? (data as AppUser) : null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    fetchLinked();
  }, [authLoading, fetchLinked]);

  return {
    activeUserId: activeUser?.id ?? null,
    activeUser,
    /** Mantido por compatibilidade: sempre a própria identidade autenticada. */
    users: activeUser ? [activeUser] : [],
    loading: loading || authLoading,
    /** Sem vínculo operacional → ações devem ser bloqueadas. */
    isLinked: !!activeUser,
    refetch: fetchLinked,
  };
}
