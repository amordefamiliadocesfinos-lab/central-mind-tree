import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProductListItem {
  id: string;
  name: string;
  sku: string;
  cover_image_url: string | null;
  price: number | null;
  cost: number | null;
  category: string | null;
  description: string | null;
  media_urls: string[];
}

export function useProductsList() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, cover_image_url, price, cost, category, description, media_urls')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');

      if (!error && data) {
        setProducts(data as ProductListItem[]);
      }
      setLoading(false);
    };

    fetch();
  }, []);

  return { products, loading };
}
