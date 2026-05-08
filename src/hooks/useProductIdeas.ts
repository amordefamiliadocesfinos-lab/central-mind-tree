import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LinkedIdeaSummary {
  id: string;
  title: string;
  platforms: string[]; // platform ids
}

export function useProductIdeas() {
  const [map, setMap] = useState<Record<string, LinkedIdeaSummary[]>>({});

  const fetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('digital_ideas')
      .select('id, title, product_id, variations:digital_variations(platform)')
      .not('product_id', 'is', null);

    if (error || !data) return;

    const next: Record<string, LinkedIdeaSummary[]> = {};
    for (const idea of data as any[]) {
      if (!idea.product_id) continue;
      const platforms = Array.from(
        new Set((idea.variations || []).map((v: any) => v.platform).filter(Boolean))
      ) as string[];
      if (!next[idea.product_id]) next[idea.product_id] = [];
      next[idea.product_id].push({ id: idea.id, title: idea.title, platforms });
    }
    setMap(next);
  }, []);

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel('product-ideas-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'digital_ideas' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'digital_variations' }, fetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetch]);

  return { productIdeasMap: map, refetch: fetch };
}
