import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PriceChannel {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface PriceParam {
  id: string;
  channel_id: string;
  name: string;
  platform_fee_pct: number;
  payment_fee_pct: number;
  extra_fee_pct: number;
  packaging_cost: number;
  shipping_cost: number;
  target_margin_pct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  channel?: PriceChannel;
}

export interface SimulatorItem {
  id: string;
  product_name: string;
  pack_qty: number;
  pack_cost: number;
  unit_price: number;
}

export interface CalculatedItem extends SimulatorItem {
  unit_cost: number;
  net_received: number;
  margin_pct: number;
  ideal_price: number;
}

// Função de cálculo de precificação
export function calculatePricing(
  item: SimulatorItem,
  params: PriceParam
): CalculatedItem {
  const unit_cost = item.pack_qty > 0 ? item.pack_cost / item.pack_qty : 0;
  const total_fees_pct = params.platform_fee_pct + params.payment_fee_pct + params.extra_fee_pct;
  
  // Valor líquido recebido por unidade
  const net_received = item.unit_price * (1 - total_fees_pct) - params.packaging_cost - params.shipping_cost;
  
  // Margem real percentual
  const totalCosts = unit_cost + params.packaging_cost + params.shipping_cost + (item.unit_price * total_fees_pct);
  const margin_pct = item.unit_price > 0 ? (item.unit_price - totalCosts) / item.unit_price : 0;
  
  // Preço ideal baseado na margem alvo
  const divisor = 1 - (total_fees_pct + params.target_margin_pct);
  const ideal_price = divisor > 0 ? (unit_cost + params.packaging_cost + params.shipping_cost) / divisor : 0;

  return {
    ...item,
    unit_cost,
    net_received,
    margin_pct,
    ideal_price
  };
}

export function usePricing() {
  const [channels, setChannels] = useState<PriceChannel[]>([]);
  const [params, setParams] = useState<PriceParam[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChannels = useCallback(async () => {
    const { data, error } = await supabase
      .from('price_channels')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Erro ao carregar canais');
      return;
    }
    setChannels(data || []);
  }, []);

  const fetchParams = useCallback(async (channelId?: string) => {
    let query = supabase
      .from('price_params')
      .select('*, channel:price_channels(*)')
      .order('name');

    if (channelId) {
      query = query.eq('channel_id', channelId);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Erro ao carregar parâmetros');
      return;
    }
    setParams(data || []);
  }, []);

  const createChannel = async (name: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('price_channels')
      .insert({ name });

    if (error) {
      toast.error('Erro ao criar canal');
      setLoading(false);
      return false;
    }

    toast.success('Canal criado com sucesso');
    await fetchChannels();
    setLoading(false);
    return true;
  };

  const updateChannel = async (id: string, name: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('price_channels')
      .update({ name })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar canal');
      setLoading(false);
      return false;
    }

    toast.success('Canal atualizado');
    await fetchChannels();
    setLoading(false);
    return true;
  };

  const deleteChannel = async (id: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('price_channels')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir canal. Verifique se não há parâmetros vinculados.');
      setLoading(false);
      return false;
    }

    toast.success('Canal excluído');
    await fetchChannels();
    setLoading(false);
    return true;
  };

  const createParam = async (param: Omit<PriceParam, 'id' | 'created_at' | 'updated_at' | 'channel'>) => {
    setLoading(true);
    const { error } = await supabase
      .from('price_params')
      .insert(param);

    if (error) {
      toast.error('Erro ao criar parâmetro');
      setLoading(false);
      return false;
    }

    toast.success('Parâmetro criado com sucesso');
    await fetchParams();
    setLoading(false);
    return true;
  };

  const updateParam = async (id: string, param: Partial<PriceParam>) => {
    setLoading(true);
    const { channel, ...updateData } = param;
    const { error } = await supabase
      .from('price_params')
      .update(updateData)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar parâmetro');
      setLoading(false);
      return false;
    }

    toast.success('Parâmetro atualizado');
    await fetchParams();
    setLoading(false);
    return true;
  };

  const deleteParam = async (id: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('price_params')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir parâmetro');
      setLoading(false);
      return false;
    }

    toast.success('Parâmetro excluído');
    await fetchParams();
    setLoading(false);
    return true;
  };

  useEffect(() => {
    fetchChannels();
    fetchParams();
  }, [fetchChannels, fetchParams]);

  return {
    channels,
    params,
    loading,
    fetchChannels,
    fetchParams,
    createChannel,
    updateChannel,
    deleteChannel,
    createParam,
    updateParam,
    deleteParam
  };
}
