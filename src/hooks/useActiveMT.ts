import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useActiveUser } from './useActiveUser';

export interface ActiveMTInfo {
  id: string;
  name: string;
  area: string;
  icon: string | null;
  color: string | null;
  priority_modules: string[];
  target_role: string | null;
}

/**
 * Descobre o MT ativo para o momento atual:
 * 1) MT do bloco em andamento hoje
 * 2) MT mais usado hoje (por notes "MT: <nome>")
 * 3) MT marcado como padrão
 */
export function useActiveMT() {
  const [mt, setMt] = useState<ActiveMTInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { activeUserId } = useActiveUser();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data: mts } = await supabase
        .from('routine_mts' as any)
        .select('id, name, area, icon, color, priority_modules, target_role, is_default, is_active')
        .eq('is_active', true);
      const list = ((mts as any[]) || []).filter(Boolean);
      if (list.length === 0) { if (!cancelled) { setMt(null); setLoading(false); } return; }

      let q = supabase
        .from('routine_blocks')
        .select('title, notes, status')
        .eq('date', today);
      if (activeUserId) q = q.or(`assigned_user_id.eq.${activeUserId},assigned_user_id.is.null`);
      const { data: blocks } = await q;

      const findByNotes = (needle: string | null) => {
        if (!needle) return null;
        const m = needle.match(/MT:\s*([^\n]+)/i);
        if (!m) return null;
        const name = m[1].trim().toLowerCase();
        return list.find((x: any) => (x.name || '').toLowerCase() === name) || null;
      };

      // 1) Bloco em andamento
      const running = (blocks || []).find((b: any) => b.status === 'andamento');
      let picked = running ? findByNotes(running.notes) : null;

      // 2) MT mais frequente hoje
      if (!picked) {
        const counts = new Map<string, number>();
        (blocks || []).forEach((b: any) => {
          const found = findByNotes(b.notes);
          if (found) counts.set(found.id, (counts.get(found.id) || 0) + 1);
        });
        let best: string | null = null; let bestC = 0;
        counts.forEach((v, k) => { if (v > bestC) { best = k; bestC = v; } });
        picked = best ? list.find((x: any) => x.id === best) : null;
      }

      // 3) Padrão
      if (!picked) picked = list.find((x: any) => x.is_default) || null;

      if (!cancelled) {
        setMt(picked ? {
          id: picked.id,
          name: picked.name,
          area: picked.area,
          icon: picked.icon,
          color: picked.color,
          priority_modules: Array.isArray(picked.priority_modules) ? picked.priority_modules : [],
          target_role: picked.target_role,
        } : null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeUserId]);

  return { mt, loading };
}
