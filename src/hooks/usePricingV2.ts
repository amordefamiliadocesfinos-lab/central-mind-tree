import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface PriceChannel {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface PriceStore {
  id: string;
  channel_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  channel?: PriceChannel;
}

export interface PriceFeeField {
  id: string;
  name: string;
  field_type: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

export interface PriceParamFee {
  id: string;
  param_id: string;
  fee_field_id: string;
  value: number;
}

export interface PriceParam {
  id: string;
  channel_id: string;
  store_id: string | null;
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
  store?: PriceStore;
  fees?: PriceParamFee[];
}

export interface PriceParamHistory {
  id: string;
  param_id: string;
  snapshot: unknown;
  changed_at: string;
  notes: string | null;
}

export interface PriceSimulation {
  id: string;
  param_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  items?: PriceSimulationItem[];
}

export interface PriceSimulationItem {
  id: string;
  simulation_id: string;
  product_name: string;
  pack_qty: number;
  pack_cost: number;
  unit_price: number;
  order_index: number;
  created_at: string;
}

// Calculation helpers
export interface CalculatedItem extends PriceSimulationItem {
  unit_cost: number;
  net_received: number;
  margin_pct: number;
  ideal_price: number;
  scenarios: { increase_pct: number; new_price: number; new_margin: number }[];
}

export function calculatePricingV2(
  item: Pick<PriceSimulationItem, 'pack_qty' | 'pack_cost' | 'unit_price'>,
  totalFeesPct: number,
  fixedCosts: number,
  targetMarginPct: number
): Omit<CalculatedItem, keyof PriceSimulationItem> {
  const unit_cost = item.pack_qty > 0 ? item.pack_cost / item.pack_qty : 0;
  
  // Net received = price - (price * fees%) - fixed costs
  const net_received = item.unit_price * (1 - totalFeesPct) - fixedCosts;
  
  // Real margin = (net_received - unit_cost) / unit_price
  const totalCosts = unit_cost + fixedCosts + (item.unit_price * totalFeesPct);
  const margin_pct = item.unit_price > 0 ? (item.unit_price - totalCosts) / item.unit_price : 0;
  
  // Ideal price based on target margin
  const divisor = 1 - (totalFeesPct + targetMarginPct);
  const ideal_price = divisor > 0 ? (unit_cost + fixedCosts) / divisor : 0;

  // Scenarios: +10%, +20%, +30%
  const scenarios = [10, 20, 30].map(increase_pct => {
    const new_price = item.unit_price * (1 + increase_pct / 100);
    const new_costs = unit_cost + fixedCosts + (new_price * totalFeesPct);
    const new_margin = new_price > 0 ? (new_price - new_costs) / new_price : 0;
    return { increase_pct, new_price, new_margin };
  });

  return {
    unit_cost,
    net_received,
    margin_pct,
    ideal_price,
    scenarios
  };
}

export function usePricingV2() {
  const [channels, setChannels] = useState<PriceChannel[]>([]);
  const [stores, setStores] = useState<PriceStore[]>([]);
  const [feeFields, setFeeFields] = useState<PriceFeeField[]>([]);
  const [params, setParams] = useState<PriceParam[]>([]);
  const [paramFees, setParamFees] = useState<PriceParamFee[]>([]);
  const [history, setHistory] = useState<PriceParamHistory[]>([]);
  const [simulations, setSimulations] = useState<PriceSimulation[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all data
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

  const fetchStores = useCallback(async () => {
    const { data, error } = await supabase
      .from('price_stores')
      .select('*, channel:price_channels(*)')
      .order('name');
    if (error) {
      toast.error('Erro ao carregar lojas');
      return;
    }
    setStores(data || []);
  }, []);

  const fetchFeeFields = useCallback(async () => {
    const { data, error } = await supabase
      .from('price_fee_fields')
      .select('*')
      .order('order_index');
    if (error) {
      toast.error('Erro ao carregar campos de taxa');
      return;
    }
    setFeeFields(data || []);
  }, []);

  const fetchParams = useCallback(async () => {
    const { data, error } = await supabase
      .from('price_params')
      .select('*, channel:price_channels(*), store:price_stores(*)')
      .order('name');
    if (error) {
      toast.error('Erro ao carregar parâmetros');
      return;
    }
    setParams(data || []);
  }, []);

  const fetchParamFees = useCallback(async () => {
    const { data, error } = await supabase
      .from('price_param_fees')
      .select('*');
    if (error) {
      toast.error('Erro ao carregar valores de taxas');
      return;
    }
    setParamFees(data || []);
  }, []);

  const fetchHistory = useCallback(async (paramId?: string) => {
    let query = supabase
      .from('price_param_history')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(100);
    
    if (paramId) {
      query = query.eq('param_id', paramId);
    }
    
    const { data, error } = await query;
    if (error) {
      toast.error('Erro ao carregar histórico');
      return;
    }
    setHistory(data || []);
  }, []);

  const fetchSimulations = useCallback(async (paramId?: string) => {
    let query = supabase
      .from('price_simulations')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (paramId) {
      query = query.eq('param_id', paramId);
    }
    
    const { data, error } = await query;
    if (error) {
      toast.error('Erro ao carregar simulações');
      return;
    }
    setSimulations(data || []);
  }, []);

  const fetchSimulationItems = useCallback(async (simulationId: string) => {
    const { data, error } = await supabase
      .from('price_simulation_items')
      .select('*')
      .eq('simulation_id', simulationId)
      .order('order_index');
    if (error) {
      toast.error('Erro ao carregar itens da simulação');
      return [];
    }
    return data || [];
  }, []);

  // CRUD Channels
  const createChannel = async (name: string) => {
    setLoading(true);
    const { error } = await supabase.from('price_channels').insert({ name });
    if (error) {
      toast.error('Erro ao criar canal');
      setLoading(false);
      return false;
    }
    toast.success('Canal criado');
    await fetchChannels();
    setLoading(false);
    return true;
  };

  const updateChannel = async (id: string, name: string) => {
    setLoading(true);
    const { error } = await supabase.from('price_channels').update({ name }).eq('id', id);
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
    const { error } = await supabase.from('price_channels').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir canal');
      setLoading(false);
      return false;
    }
    toast.success('Canal excluído');
    await fetchChannels();
    setLoading(false);
    return true;
  };

  // CRUD Stores
  const createStore = async (channelId: string, name: string) => {
    setLoading(true);
    const { error } = await supabase.from('price_stores').insert({ channel_id: channelId, name });
    if (error) {
      toast.error('Erro ao criar loja');
      setLoading(false);
      return false;
    }
    toast.success('Loja criada');
    await fetchStores();
    setLoading(false);
    return true;
  };

  const updateStore = async (id: string, data: Partial<PriceStore>) => {
    setLoading(true);
    const { channel, ...updateData } = data;
    const { error } = await supabase.from('price_stores').update(updateData).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar loja');
      setLoading(false);
      return false;
    }
    toast.success('Loja atualizada');
    await fetchStores();
    setLoading(false);
    return true;
  };

  const deleteStore = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from('price_stores').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir loja');
      setLoading(false);
      return false;
    }
    toast.success('Loja excluída');
    await fetchStores();
    setLoading(false);
    return true;
  };

  // CRUD Fee Fields
  const createFeeField = async (name: string, fieldType: 'percentage' | 'fixed') => {
    setLoading(true);
    const maxOrder = feeFields.length > 0 ? Math.max(...feeFields.map(f => f.order_index)) + 1 : 0;
    const { error } = await supabase.from('price_fee_fields').insert({ 
      name, 
      field_type: fieldType,
      order_index: maxOrder 
    });
    if (error) {
      toast.error('Erro ao criar campo de taxa');
      setLoading(false);
      return false;
    }
    toast.success('Campo de taxa criado');
    await fetchFeeFields();
    setLoading(false);
    return true;
  };

  const updateFeeField = async (id: string, data: Partial<PriceFeeField>) => {
    setLoading(true);
    const { error } = await supabase.from('price_fee_fields').update(data).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar campo de taxa');
      setLoading(false);
      return false;
    }
    toast.success('Campo de taxa atualizado');
    await fetchFeeFields();
    setLoading(false);
    return true;
  };

  const deleteFeeField = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from('price_fee_fields').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir campo de taxa');
      setLoading(false);
      return false;
    }
    toast.success('Campo de taxa excluído');
    await fetchFeeFields();
    setLoading(false);
    return true;
  };

  // CRUD Params with history
  const createParam = async (
    data: Omit<PriceParam, 'id' | 'created_at' | 'updated_at' | 'channel' | 'store' | 'fees'>,
    feeValues?: { fee_field_id: string; value: number }[]
  ) => {
    setLoading(true);
    const { data: newParam, error } = await supabase
      .from('price_params')
      .insert(data)
      .select()
      .single();
    
    if (error || !newParam) {
      toast.error('Erro ao criar parâmetro');
      setLoading(false);
      return false;
    }

    // Insert fee values
    if (feeValues && feeValues.length > 0) {
      const feeInserts = feeValues.map(f => ({
        param_id: newParam.id,
        fee_field_id: f.fee_field_id,
        value: f.value
      }));
      await supabase.from('price_param_fees').insert(feeInserts);
    }

    toast.success('Parâmetro criado');
    await Promise.all([fetchParams(), fetchParamFees()]);
    setLoading(false);
    return true;
  };

  const updateParam = async (
    id: string, 
    data: Partial<PriceParam>,
    feeValues?: { fee_field_id: string; value: number }[],
    historyNote?: string
  ) => {
    setLoading(true);
    
    // Get current param for history snapshot
    const currentParam = params.find(p => p.id === id);
    if (currentParam) {
      // Save to history
      await supabase.from('price_param_history').insert([{
        param_id: id,
        snapshot: JSON.parse(JSON.stringify(currentParam)),
        notes: historyNote || null
      }]);
    }

    const { channel, store, fees, ...updateData } = data;
    const { error } = await supabase.from('price_params').update(updateData).eq('id', id);
    
    if (error) {
      toast.error('Erro ao atualizar parâmetro');
      setLoading(false);
      return false;
    }

    // Update fee values
    if (feeValues) {
      // Delete existing and insert new
      await supabase.from('price_param_fees').delete().eq('param_id', id);
      if (feeValues.length > 0) {
        const feeInserts = feeValues.map(f => ({
          param_id: id,
          fee_field_id: f.fee_field_id,
          value: f.value
        }));
        await supabase.from('price_param_fees').insert(feeInserts);
      }
    }

    toast.success('Parâmetro atualizado');
    await Promise.all([fetchParams(), fetchParamFees(), fetchHistory(id)]);
    setLoading(false);
    return true;
  };

  const deleteParam = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from('price_params').delete().eq('id', id);
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

  // CRUD Simulations
  const createSimulation = async (paramId: string, name: string) => {
    setLoading(true);
    const { data: newSim, error } = await supabase
      .from('price_simulations')
      .insert({ param_id: paramId, name })
      .select()
      .single();
    
    if (error || !newSim) {
      toast.error('Erro ao criar simulação');
      setLoading(false);
      return null;
    }

    toast.success('Simulação criada');
    await fetchSimulations(paramId);
    setLoading(false);
    return newSim;
  };

  const updateSimulation = async (id: string, name: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('price_simulations')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      toast.error('Erro ao atualizar simulação');
      setLoading(false);
      return false;
    }

    toast.success('Simulação atualizada');
    await fetchSimulations();
    setLoading(false);
    return true;
  };

  const deleteSimulation = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from('price_simulations').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir simulação');
      setLoading(false);
      return false;
    }
    toast.success('Simulação excluída');
    await fetchSimulations();
    setLoading(false);
    return true;
  };

  // CRUD Simulation Items
  const saveSimulationItems = async (
    simulationId: string, 
    items: Omit<PriceSimulationItem, 'id' | 'simulation_id' | 'created_at'>[]
  ) => {
    setLoading(true);
    
    // Delete existing items
    await supabase.from('price_simulation_items').delete().eq('simulation_id', simulationId);
    
    // Insert new items
    if (items.length > 0) {
      const itemInserts = items.map((item, index) => ({
        simulation_id: simulationId,
        product_name: item.product_name,
        pack_qty: item.pack_qty,
        pack_cost: item.pack_cost,
        unit_price: item.unit_price,
        order_index: index
      }));
      
      const { error } = await supabase.from('price_simulation_items').insert(itemInserts);
      if (error) {
        toast.error('Erro ao salvar itens');
        setLoading(false);
        return false;
      }
    }

    // Update simulation timestamp
    await supabase
      .from('price_simulations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', simulationId);

    toast.success('Simulação salva');
    setLoading(false);
    return true;
  };

  // Get calculated totals for a param
  const getParamTotals = useCallback((paramId: string) => {
    const param = params.find(p => p.id === paramId);
    if (!param) return { totalFeesPct: 0, fixedCosts: 0, targetMarginPct: 0 };

    const paramFeesForParam = paramFees.filter(f => f.param_id === paramId);
    
    let totalFeesPct = param.platform_fee_pct + param.payment_fee_pct + param.extra_fee_pct;
    let fixedCosts = param.packaging_cost + param.shipping_cost;

    // Add custom fee fields
    for (const pf of paramFeesForParam) {
      const field = feeFields.find(f => f.id === pf.fee_field_id);
      if (field) {
        if (field.field_type === 'percentage') {
          totalFeesPct += pf.value;
        } else {
          fixedCosts += pf.value;
        }
      }
    }

    return {
      totalFeesPct,
      fixedCosts,
      targetMarginPct: param.target_margin_pct
    };
  }, [params, paramFees, feeFields]);

  // Initial load
  useEffect(() => {
    Promise.all([
      fetchChannels(),
      fetchStores(),
      fetchFeeFields(),
      fetchParams(),
      fetchParamFees(),
      fetchSimulations()
    ]);
  }, [fetchChannels, fetchStores, fetchFeeFields, fetchParams, fetchParamFees, fetchSimulations]);

  return {
    // Data
    channels,
    stores,
    feeFields,
    params,
    paramFees,
    history,
    simulations,
    loading,
    
    // Fetch
    fetchChannels,
    fetchStores,
    fetchFeeFields,
    fetchParams,
    fetchParamFees,
    fetchHistory,
    fetchSimulations,
    fetchSimulationItems,
    
    // CRUD Channels
    createChannel,
    updateChannel,
    deleteChannel,
    
    // CRUD Stores
    createStore,
    updateStore,
    deleteStore,
    
    // CRUD Fee Fields
    createFeeField,
    updateFeeField,
    deleteFeeField,
    
    // CRUD Params
    createParam,
    updateParam,
    deleteParam,
    
    // CRUD Simulations
    createSimulation,
    updateSimulation,
    deleteSimulation,
    saveSimulationItems,
    
    // Helpers
    getParamTotals,
    calculatePricing: calculatePricingV2
  };
}
