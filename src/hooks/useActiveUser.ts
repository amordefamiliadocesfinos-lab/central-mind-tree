import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AppUser {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  is_active: boolean;
}

const STORAGE_KEY = 'pc.activeUserId';
const EVENT = 'pc:active-user-changed';

function readStored(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function setActiveUserId(id: string | null) {
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id } }));
}

export function getActiveUserId(): string | null {
  return readStored();
}

export function useActiveUser() {
  const [activeUserId, setLocal] = useState<string | null>(() => readStored());
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_users')
      .select('id, name, role, email, is_active')
      .eq('is_active', true)
      .order('name');
    if (!error && data) setUsers(data as AppUser[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setLocal(detail?.id ?? null);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [fetchUsers]);

  const activeUser = users.find((u) => u.id === activeUserId) || null;

  const setActive = useCallback((id: string | null) => {
    setActiveUserId(id);
    setLocal(id);
  }, []);

  return { activeUserId, activeUser, users, loading, setActiveUser: setActive, refetch: fetchUsers };
}
