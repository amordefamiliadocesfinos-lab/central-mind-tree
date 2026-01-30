import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Plus, Pencil, Trash2, Download, Copy, TrendingUp, TrendingDown, Target, 
  Store, Settings, History, ChevronRight, ChevronDown, Save, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  usePricingV2, 
  PriceChannel, 
  PriceStore, 
  PriceFeeField, 
  PriceParam,
  PriceSimulation,
  PriceSimulationItem,
  calculatePricingV2 
} from '@/hooks/usePricingV2';
import { DecimalInput } from '@/components/ui/decimal-input';
import { parseDecimalInput } from '@/lib/decimal';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value);
};

const formatPercent = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const parseNum = (str: string): number => {
  const parsed = parseDecimalInput(str);
  return parsed?.number || 0;
};

const getMarginColor = (margin: number, target: number) => {
  if (margin < 0) return 'text-red-600 bg-red-50 dark:bg-red-950';
  if (margin < target * 0.8) return 'text-amber-600 bg-amber-50 dark:bg-amber-950';
  return 'text-green-600 bg-green-50 dark:bg-green-950';
};

// Sub-components
function ChannelStoreTree({
  channels,
  stores,
  onEditChannel,
  onDeleteChannel,
  onAddStore,
  onEditStore,
  onDeleteStore
}: {
  channels: PriceChannel[];
  stores: PriceStore[];
  onEditChannel: (c: PriceChannel) => void;
  onDeleteChannel: (id: string) => void;
  onAddStore: (channelId: string) => void;
  onEditStore: (s: PriceStore) => void;
  onDeleteStore: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-1">
      {channels.map(channel => {
        const channelStores = stores.filter(s => s.channel_id === channel.id);
        const isExpanded = expanded[channel.id] ?? true;
        
        return (
          <div key={channel.id} className="border rounded-lg">
            <Collapsible open={isExpanded} onOpenChange={(open) => setExpanded(prev => ({ ...prev, [channel.id]: open }))}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer rounded-t-lg">
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium">{channel.name}</span>
                    <Badge variant="secondary" className="text-xs">{channelStores.length} lojas</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onAddStore(channel.id); }}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEditChannel(channel); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onDeleteChannel(channel.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pl-8 pb-2 space-y-1">
                  {channelStores.map(store => (
                    <div key={store.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Store className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{store.name}</span>
                        {!store.is_active && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditStore(store)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDeleteStore(store.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {channelStores.length === 0 && (
                    <p className="text-xs text-muted-foreground pl-5">Nenhuma loja cadastrada</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}

function FeeFieldsManager({
  feeFields,
  onAdd,
  onEdit,
  onDelete
}: {
  feeFields: PriceFeeField[];
  onAdd: () => void;
  onEdit: (f: PriceFeeField) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Campos de Taxa Personalizados
          </CardTitle>
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-3 w-3 mr-1" /> Novo Campo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {feeFields.map(field => (
            <Badge key={field.id} variant="outline" className="py-1.5 px-3 flex items-center gap-2">
              <span>{field.name}</span>
              <span className="text-xs text-muted-foreground">
                ({field.field_type === 'percentage' ? '%' : 'R$'})
              </span>
              <button onClick={() => onEdit(field)} className="hover:text-primary ml-1">
                <Pencil className="h-2.5 w-2.5" />
              </button>
              <button onClick={() => onDelete(field.id)} className="hover:text-destructive">
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          {feeFields.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum campo personalizado</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SimulatorRowData {
  id: string;
  product_name: string;
  pack_qty: number;
  pack_cost: number;
  unit_price: number;
  pack_cost_str: string;
  unit_price_str: string;
}

export function PricingManagerV2() {
  const {
    channels,
    stores,
    feeFields,
    params,
    paramFees,
    history,
    simulations,
    loading,
    createChannel,
    updateChannel,
    deleteChannel,
    createStore,
    updateStore,
    deleteStore,
    createFeeField,
    updateFeeField,
    deleteFeeField,
    createParam,
    updateParam,
    deleteParam,
    createSimulation,
    updateSimulation,
    deleteSimulation,
    saveSimulationItems,
    fetchSimulationItems,
    fetchHistory,
    getParamTotals,
    calculatePricing
  } = usePricingV2();

  // Dialog states
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [feeFieldDialogOpen, setFeeFieldDialogOpen] = useState(false);
  const [paramDialogOpen, setParamDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [simulationDialogOpen, setSimulationDialogOpen] = useState(false);

  // Editing states
  const [editingChannel, setEditingChannel] = useState<PriceChannel | null>(null);
  const [editingStore, setEditingStore] = useState<PriceStore | null>(null);
  const [editingStoreChannelId, setEditingStoreChannelId] = useState<string>('');
  const [editingFeeField, setEditingFeeField] = useState<PriceFeeField | null>(null);
  const [editingParam, setEditingParam] = useState<PriceParam | null>(null);
  const [viewingHistoryParamId, setViewingHistoryParamId] = useState<string | null>(null);

  // Form states
  const [channelName, setChannelName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [feeFieldName, setFeeFieldName] = useState('');
  const [feeFieldType, setFeeFieldType] = useState<'percentage' | 'fixed'>('percentage');

  // Param form
  const [paramForm, setParamForm] = useState({
    channel_id: '',
    store_id: '',
    name: '',
    platform_fee_pct: '0',
    payment_fee_pct: '0',
    extra_fee_pct: '0',
    packaging_cost: '0',
    shipping_cost: '0',
    target_margin_pct: '20',
    is_active: true,
    customFees: {} as Record<string, string>
  });

  // Filter states
  const [filterChannelId, setFilterChannelId] = useState<string>('all');
  const [filterStoreId, setFilterStoreId] = useState<string>('all');

  // Simulator states
  const [selectedParamId, setSelectedParamId] = useState<string>('');
  const [selectedSimulationId, setSelectedSimulationId] = useState<string>('');
  const [simulatorItems, setSimulatorItems] = useState<SimulatorRowData[]>([
    { id: '1', product_name: '', pack_qty: 1, pack_cost: 0, unit_price: 0, pack_cost_str: '0', unit_price_str: '0' }
  ]);
  const [simulationName, setSimulationName] = useState('');

  // Persist selections
  useEffect(() => {
    const savedParam = localStorage.getItem('pricing_v2_selected_param');
    if (savedParam) setSelectedParamId(savedParam);
  }, []);

  useEffect(() => {
    if (selectedParamId) {
      localStorage.setItem('pricing_v2_selected_param', selectedParamId);
    }
  }, [selectedParamId]);

  // Get selected param
  const selectedParam = useMemo(() => {
    return params.find(p => p.id === selectedParamId);
  }, [params, selectedParamId]);

  // Get param totals for calculation
  const paramTotals = useMemo(() => {
    if (!selectedParamId) return { totalFeesPct: 0, fixedCosts: 0, targetMarginPct: 0.2 };
    return getParamTotals(selectedParamId);
  }, [selectedParamId, getParamTotals]);

  // Calculate items with scenarios
  const calculatedItems = useMemo(() => {
    if (!selectedParam) return [];
    return simulatorItems
      .filter(item => item.product_name.trim() !== '')
      .map(item => ({
        ...item,
        ...calculatePricing(
          { pack_qty: item.pack_qty, pack_cost: item.pack_cost, unit_price: item.unit_price },
          paramTotals.totalFeesPct,
          paramTotals.fixedCosts,
          paramTotals.targetMarginPct
        )
      }));
  }, [simulatorItems, selectedParam, paramTotals, calculatePricing]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (calculatedItems.length === 0) return null;
    const margins = calculatedItems.map(i => i.margin_pct);
    return {
      avg: margins.reduce((a, b) => a + b, 0) / margins.length,
      min: Math.min(...margins),
      max: Math.max(...margins)
    };
  }, [calculatedItems]);

  // Filter params
  const filteredParams = useMemo(() => {
    let result = params;
    if (filterChannelId !== 'all') {
      result = result.filter(p => p.channel_id === filterChannelId);
    }
    if (filterStoreId !== 'all') {
      result = result.filter(p => p.store_id === filterStoreId);
    }
    return result;
  }, [params, filterChannelId, filterStoreId]);

  // Stores for selected channel filter
  const filteredStores = useMemo(() => {
    if (filterChannelId === 'all') return stores;
    return stores.filter(s => s.channel_id === filterChannelId);
  }, [stores, filterChannelId]);

  // Simulations for selected param
  const paramSimulations = useMemo(() => {
    if (!selectedParamId) return [];
    return simulations.filter(s => s.param_id === selectedParamId);
  }, [simulations, selectedParamId]);

  // Handlers
  const handleSaveChannel = async () => {
    if (!channelName.trim()) return;
    if (editingChannel) {
      await updateChannel(editingChannel.id, channelName);
    } else {
      await createChannel(channelName);
    }
    setChannelDialogOpen(false);
    setChannelName('');
    setEditingChannel(null);
  };

  const handleOpenChannelDialog = (channel?: PriceChannel) => {
    setEditingChannel(channel || null);
    setChannelName(channel?.name || '');
    setChannelDialogOpen(true);
  };

  const handleDeleteChannel = async (id: string) => {
    if (confirm('Excluir canal? Isso removerá também as lojas vinculadas.')) {
      await deleteChannel(id);
    }
  };

  const handleSaveStore = async () => {
    if (!storeName.trim()) return;
    if (editingStore) {
      await updateStore(editingStore.id, { name: storeName });
    } else if (editingStoreChannelId) {
      await createStore(editingStoreChannelId, storeName);
    }
    setStoreDialogOpen(false);
    setStoreName('');
    setEditingStore(null);
    setEditingStoreChannelId('');
  };

  const handleOpenStoreDialog = (channelId: string, store?: PriceStore) => {
    setEditingStoreChannelId(channelId);
    setEditingStore(store || null);
    setStoreName(store?.name || '');
    setStoreDialogOpen(true);
  };

  const handleDeleteStore = async (id: string) => {
    if (confirm('Excluir loja?')) {
      await deleteStore(id);
    }
  };

  const handleSaveFeeField = async () => {
    if (!feeFieldName.trim()) return;
    if (editingFeeField) {
      await updateFeeField(editingFeeField.id, { name: feeFieldName, field_type: feeFieldType });
    } else {
      await createFeeField(feeFieldName, feeFieldType);
    }
    setFeeFieldDialogOpen(false);
    setFeeFieldName('');
    setFeeFieldType('percentage');
    setEditingFeeField(null);
  };

  const handleOpenFeeFieldDialog = (field?: PriceFeeField) => {
    setEditingFeeField(field || null);
    setFeeFieldName(field?.name || '');
    setFeeFieldType((field?.field_type as 'percentage' | 'fixed') || 'percentage');
    setFeeFieldDialogOpen(true);
  };

  const handleDeleteFeeField = async (id: string) => {
    if (confirm('Excluir campo de taxa?')) {
      await deleteFeeField(id);
    }
  };

  const handleOpenParamDialog = (param?: PriceParam) => {
    if (param) {
      setEditingParam(param);
      // Get custom fees for this param
      const customFees: Record<string, string> = {};
      paramFees.filter(pf => pf.param_id === param.id).forEach(pf => {
        const field = feeFields.find(f => f.id === pf.fee_field_id);
        if (field) {
          customFees[pf.fee_field_id] = field.field_type === 'percentage' 
            ? String(pf.value * 100) 
            : String(pf.value);
        }
      });
      setParamForm({
        channel_id: param.channel_id,
        store_id: param.store_id || '',
        name: param.name,
        platform_fee_pct: String(param.platform_fee_pct * 100),
        payment_fee_pct: String(param.payment_fee_pct * 100),
        extra_fee_pct: String(param.extra_fee_pct * 100),
        packaging_cost: String(param.packaging_cost),
        shipping_cost: String(param.shipping_cost),
        target_margin_pct: String(param.target_margin_pct * 100),
        is_active: param.is_active,
        customFees
      });
    } else {
      setEditingParam(null);
      const defaultCustomFees: Record<string, string> = {};
      feeFields.forEach(f => { defaultCustomFees[f.id] = '0'; });
      setParamForm({
        channel_id: filterChannelId !== 'all' ? filterChannelId : (channels[0]?.id || ''),
        store_id: filterStoreId !== 'all' ? filterStoreId : '',
        name: '',
        platform_fee_pct: '0',
        payment_fee_pct: '0',
        extra_fee_pct: '0',
        packaging_cost: '0',
        shipping_cost: '0',
        target_margin_pct: '20',
        is_active: true,
        customFees: defaultCustomFees
      });
    }
    setParamDialogOpen(true);
  };

  const handleSaveParam = async () => {
    if (!paramForm.channel_id || !paramForm.name.trim()) return;

    const data = {
      channel_id: paramForm.channel_id,
      store_id: paramForm.store_id || null,
      name: paramForm.name,
      platform_fee_pct: parseNum(paramForm.platform_fee_pct) / 100,
      payment_fee_pct: parseNum(paramForm.payment_fee_pct) / 100,
      extra_fee_pct: parseNum(paramForm.extra_fee_pct) / 100,
      packaging_cost: parseNum(paramForm.packaging_cost),
      shipping_cost: parseNum(paramForm.shipping_cost),
      target_margin_pct: parseNum(paramForm.target_margin_pct) / 100,
      is_active: paramForm.is_active
    };

    const feeValues = Object.entries(paramForm.customFees).map(([fee_field_id, valueStr]) => {
      const field = feeFields.find(f => f.id === fee_field_id);
      const value = field?.field_type === 'percentage' 
        ? parseNum(valueStr) / 100 
        : parseNum(valueStr);
      return { fee_field_id, value };
    });

    if (editingParam) {
      await updateParam(editingParam.id, data, feeValues, 'Atualização manual');
    } else {
      await createParam(data, feeValues);
    }
    setParamDialogOpen(false);
    setEditingParam(null);
  };

  const handleDeleteParam = async (id: string) => {
    if (confirm('Excluir parâmetro?')) {
      await deleteParam(id);
    }
  };

  const handleViewHistory = async (paramId: string) => {
    setViewingHistoryParamId(paramId);
    await fetchHistory(paramId);
    setHistoryDialogOpen(true);
  };

  // Simulator handlers
  const addSimulatorRow = () => {
    setSimulatorItems([
      ...simulatorItems,
      { id: Date.now().toString(), product_name: '', pack_qty: 1, pack_cost: 0, unit_price: 0, pack_cost_str: '0', unit_price_str: '0' }
    ]);
  };

  const duplicateRow = (id: string) => {
    const item = simulatorItems.find(i => i.id === id);
    if (item) {
      setSimulatorItems([
        ...simulatorItems,
        { ...item, id: Date.now().toString() }
      ]);
    }
  };

  const removeRow = (id: string) => {
    if (simulatorItems.length > 1) {
      setSimulatorItems(simulatorItems.filter(i => i.id !== id));
    }
  };

  const updateSimulatorItem = (id: string, field: string, value: string | number) => {
    setSimulatorItems(simulatorItems.map(item => {
      if (item.id !== id) return item;
      
      if (field === 'pack_cost_str') {
        const parsed = parseDecimalInput(value as string);
        return { ...item, pack_cost_str: value as string, pack_cost: parsed?.number || 0 };
      }
      if (field === 'unit_price_str') {
        const parsed = parseDecimalInput(value as string);
        return { ...item, unit_price_str: value as string, unit_price: parsed?.number || 0 };
      }
      return { ...item, [field]: value };
    }));
  };

  const handleSaveSimulation = async () => {
    if (!selectedParamId) return;
    
    if (selectedSimulationId) {
      // Update existing
      await saveSimulationItems(
        selectedSimulationId,
        simulatorItems.filter(i => i.product_name.trim()).map((item, idx) => ({
          product_name: item.product_name,
          pack_qty: item.pack_qty,
          pack_cost: item.pack_cost,
          unit_price: item.unit_price,
          order_index: idx
        }))
      );
    } else {
      // Create new
      const name = simulationName || `Simulação ${new Date().toLocaleDateString('pt-BR')}`;
      const sim = await createSimulation(selectedParamId, name);
      if (sim) {
        setSelectedSimulationId(sim.id);
        await saveSimulationItems(
          sim.id,
          simulatorItems.filter(i => i.product_name.trim()).map((item, idx) => ({
            product_name: item.product_name,
            pack_qty: item.pack_qty,
            pack_cost: item.pack_cost,
            unit_price: item.unit_price,
            order_index: idx
          }))
        );
      }
    }
    setSimulationDialogOpen(false);
    setSimulationName('');
  };

  const handleLoadSimulation = async (simId: string) => {
    setSelectedSimulationId(simId);
    const items = await fetchSimulationItems(simId);
    if (items.length > 0) {
      setSimulatorItems(items.map(item => ({
        id: item.id,
        product_name: item.product_name,
        pack_qty: item.pack_qty,
        pack_cost: item.pack_cost,
        unit_price: item.unit_price,
        pack_cost_str: String(item.pack_cost),
        unit_price_str: String(item.unit_price)
      })));
    }
  };

  const handleNewSimulation = () => {
    setSelectedSimulationId('');
    setSimulatorItems([
      { id: '1', product_name: '', pack_qty: 1, pack_cost: 0, unit_price: 0, pack_cost_str: '0', unit_price_str: '0' }
    ]);
  };

  const exportCSV = () => {
    if (calculatedItems.length === 0) return;
    
    const headers = [
      'Produto', 'Qtd/Pacote', 'Custo Pacote', 'Custo Unit', 'Preço Unit', 
      'Recebemos Líq.', 'Margem %', 'Preço Ideal',
      '+10% Preço', '+10% Margem', '+20% Preço', '+20% Margem', '+30% Preço', '+30% Margem'
    ];
    
    const rows = calculatedItems.map(item => [
      item.product_name,
      item.pack_qty,
      item.pack_cost.toFixed(4),
      item.unit_cost.toFixed(4),
      item.unit_price.toFixed(2),
      item.net_received.toFixed(2),
      (item.margin_pct * 100).toFixed(2) + '%',
      item.ideal_price.toFixed(2),
      item.scenarios[0]?.new_price.toFixed(2) || '',
      ((item.scenarios[0]?.new_margin || 0) * 100).toFixed(2) + '%',
      item.scenarios[1]?.new_price.toFixed(2) || '',
      ((item.scenarios[1]?.new_margin || 0) * 100).toFixed(2) + '%',
      item.scenarios[2]?.new_price.toFixed(2) || '',
      ((item.scenarios[2]?.new_margin || 0) * 100).toFixed(2) + '%'
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulacao_precos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stores for param form
  const paramFormStores = useMemo(() => {
    if (!paramForm.channel_id) return [];
    return stores.filter(s => s.channel_id === paramForm.channel_id);
  }, [stores, paramForm.channel_id]);

  return (
    <div className="space-y-4 pb-20">
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="params">Parâmetros</TabsTrigger>
          <TabsTrigger value="simulator">Simulador</TabsTrigger>
        </TabsList>

        {/* Configuração Tab */}
        <TabsContent value="config" className="space-y-4">
          {/* Channels & Stores */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Canais e Lojas</CardTitle>
                <Button size="sm" onClick={() => handleOpenChannelDialog()}>
                  <Plus className="h-4 w-4 mr-1" /> Novo Canal
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ChannelStoreTree
                channels={channels}
                stores={stores}
                onEditChannel={handleOpenChannelDialog}
                onDeleteChannel={handleDeleteChannel}
                onAddStore={(channelId) => handleOpenStoreDialog(channelId)}
                onEditStore={(store) => handleOpenStoreDialog(store.channel_id, store)}
                onDeleteStore={handleDeleteStore}
              />
              {channels.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Nenhum canal cadastrado</p>
              )}
            </CardContent>
          </Card>

          {/* Fee Fields */}
          <FeeFieldsManager
            feeFields={feeFields}
            onAdd={() => handleOpenFeeFieldDialog()}
            onEdit={handleOpenFeeFieldDialog}
            onDelete={handleDeleteFeeField}
          />
        </TabsContent>

        {/* Parâmetros Tab */}
        <TabsContent value="params" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Parâmetros de Precificação</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={filterChannelId} onValueChange={(v) => { setFilterChannelId(v); setFilterStoreId('all'); }}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Canal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos canais</SelectItem>
                      {channels.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStoreId} onValueChange={setFilterStoreId} disabled={filterChannelId === 'all'}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Loja" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas lojas</SelectItem>
                      {filteredStores.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => handleOpenParamDialog()}>
                    <Plus className="h-4 w-4 mr-1" /> Novo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Canal</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Total Taxas</TableHead>
                      <TableHead className="text-right">Custos Fixos</TableHead>
                      <TableHead className="text-right">Margem Alvo</TableHead>
                      <TableHead className="text-center">Ativo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParams.map(param => {
                      const totals = getParamTotals(param.id);
                      return (
                        <TableRow key={param.id}>
                          <TableCell className="font-medium">{param.channel?.name}</TableCell>
                          <TableCell>{param.store?.name || '-'}</TableCell>
                          <TableCell>{param.name}</TableCell>
                          <TableCell className="text-right">{formatPercent(totals.totalFeesPct)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(totals.fixedCosts)}</TableCell>
                          <TableCell className="text-right">{formatPercent(totals.targetMarginPct)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={param.is_active ? 'default' : 'secondary'}>
                              {param.is_active ? 'Sim' : 'Não'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewHistory(param.id)}>
                                <History className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenParamDialog(param)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteParam(param.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredParams.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhum parâmetro cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Simulador Tab */}
        <TabsContent value="simulator" className="space-y-4">
          {/* Selection */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Label>Parâmetro</Label>
                  <Select value={selectedParamId} onValueChange={(v) => { setSelectedParamId(v); setSelectedSimulationId(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o parâmetro" />
                    </SelectTrigger>
                    <SelectContent>
                      {params.filter(p => p.is_active).map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.channel?.name} {p.store ? `> ${p.store.name}` : ''} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label>Simulação Salva</Label>
                  <div className="flex gap-2">
                    <Select value={selectedSimulationId} onValueChange={handleLoadSimulation} disabled={!selectedParamId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Nova simulação" />
                      </SelectTrigger>
                      <SelectContent>
                        {paramSimulations.map(sim => (
                          <SelectItem key={sim.id} value={sim.id}>
                            {sim.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={handleNewSimulation} disabled={!selectedParamId}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Param Summary */}
          {selectedParam && (
            <Card className="bg-muted/50">
              <CardContent className="py-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Taxas: </span>
                    <span className="font-medium">{formatPercent(paramTotals.totalFeesPct)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Custos Fixos: </span>
                    <span className="font-medium">{formatCurrency(paramTotals.fixedCosts)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Margem Alvo: </span>
                    <span className="font-medium">{formatPercent(paramTotals.targetMarginPct)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Stats */}
          {summaryStats && selectedParam && (
            <div className="grid grid-cols-3 gap-3">
              <Card className={cn("p-3", getMarginColor(summaryStats.avg, paramTotals.targetMarginPct))}>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <div>
                    <p className="text-xs text-muted-foreground">Média Margem</p>
                    <p className="text-lg font-bold">{formatPercent(summaryStats.avg)}</p>
                  </div>
                </div>
              </Card>
              <Card className={cn("p-3", getMarginColor(summaryStats.min, paramTotals.targetMarginPct))}>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  <div>
                    <p className="text-xs text-muted-foreground">Menor</p>
                    <p className="text-lg font-bold">{formatPercent(summaryStats.min)}</p>
                  </div>
                </div>
              </Card>
              <Card className={cn("p-3", getMarginColor(summaryStats.max, paramTotals.targetMarginPct))}>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <div>
                    <p className="text-xs text-muted-foreground">Maior</p>
                    <p className="text-lg font-bold">{formatPercent(summaryStats.max)}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Simulator Table */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Simulação de Preços</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addSimulatorRow}>
                    <Plus className="h-4 w-4 mr-1" /> Linha
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSimulationDialogOpen(true)} disabled={!selectedParamId || calculatedItems.length === 0}>
                    <Save className="h-4 w-4 mr-1" /> Salvar
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportCSV} disabled={calculatedItems.length === 0}>
                    <Download className="h-4 w-4 mr-1" /> CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Produto</TableHead>
                      <TableHead className="text-right w-[80px]">Qtd</TableHead>
                      <TableHead className="text-right w-[100px]">Custo Pct</TableHead>
                      <TableHead className="text-right w-[80px]">C.Unit</TableHead>
                      <TableHead className="text-right w-[100px]">Preço</TableHead>
                      <TableHead className="text-right w-[90px]">Líquido</TableHead>
                      <TableHead className="text-right w-[80px]">Margem</TableHead>
                      <TableHead className="text-right w-[90px]">Ideal</TableHead>
                      <TableHead className="text-center w-[120px]">+10%</TableHead>
                      <TableHead className="text-center w-[120px]">+20%</TableHead>
                      <TableHead className="text-center w-[120px]">+30%</TableHead>
                      <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulatorItems.map((item) => {
                      const calc = calculatedItems.find(c => c.id === item.id);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Input
                              value={item.product_name}
                              onChange={(e) => updateSimulatorItem(item.id, 'product_name', e.target.value)}
                              placeholder="Produto"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={item.pack_qty}
                              onChange={(e) => updateSimulatorItem(item.id, 'pack_qty', parseInt(e.target.value) || 1)}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <DecimalInput
                              value={item.pack_cost_str}
                              onValueChange={(v) => updateSimulatorItem(item.id, 'pack_cost_str', v)}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-xs">
                            {calc ? formatCurrency(calc.unit_cost) : '-'}
                          </TableCell>
                          <TableCell>
                            <DecimalInput
                              value={item.unit_price_str}
                              onValueChange={(v) => updateSimulatorItem(item.id, 'unit_price_str', v)}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {calc ? formatCurrency(calc.net_received) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {calc && selectedParam ? (
                              <Badge className={cn("font-mono text-xs", getMarginColor(calc.margin_pct, paramTotals.targetMarginPct))}>
                                {formatPercent(calc.margin_pct)}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-xs">
                            {calc ? formatCurrency(calc.ideal_price) : '-'}
                          </TableCell>
                          {/* Scenarios */}
                          {[0, 1, 2].map(idx => (
                            <TableCell key={idx} className="text-center text-xs">
                              {calc?.scenarios[idx] ? (
                                <div>
                                  <div>{formatCurrency(calc.scenarios[idx].new_price)}</div>
                                  <Badge className={cn("text-xs", getMarginColor(calc.scenarios[idx].new_margin, paramTotals.targetMarginPct))}>
                                    {formatPercent(calc.scenarios[idx].new_margin)}
                                  </Badge>
                                </div>
                              ) : '-'}
                            </TableCell>
                          ))}
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => duplicateRow(item.id)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6" 
                                onClick={() => removeRow(item.id)}
                                disabled={simulatorItems.length === 1}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              {!selectedParam && (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  Selecione um parâmetro para calcular
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Channel Dialog */}
      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChannel ? 'Editar Canal' : 'Novo Canal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Canal</Label>
              <Input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="Ex: Shopee, Mercado Livre..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChannelDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveChannel} disabled={loading}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Store Dialog */}
      <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStore ? 'Editar Loja' : 'Nova Loja'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Loja</Label>
              <Input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ex: Loja Principal, Loja 2..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStoreDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveStore} disabled={loading}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Field Dialog */}
      <Dialog open={feeFieldDialogOpen} onOpenChange={setFeeFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFeeField ? 'Editar Campo de Taxa' : 'Novo Campo de Taxa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Campo</Label>
              <Input
                value={feeFieldName}
                onChange={(e) => setFeeFieldName(e.target.value)}
                placeholder="Ex: Taxa Ads, Desconto Campanha..."
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={feeFieldType} onValueChange={(v) => setFeeFieldType(v as 'percentage' | 'fixed')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeeFieldDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveFeeField} disabled={loading}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Param Dialog */}
      <Dialog open={paramDialogOpen} onOpenChange={setParamDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingParam ? 'Editar Parâmetro' : 'Novo Parâmetro'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Canal</Label>
                <Select value={paramForm.channel_id} onValueChange={(v) => setParamForm({ ...paramForm, channel_id: v, store_id: '' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Loja (opcional)</Label>
                <Select value={paramForm.store_id} onValueChange={(v) => setParamForm({ ...paramForm, store_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Geral" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Geral (todas lojas)</SelectItem>
                    {paramFormStores.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Nome do Parâmetro</Label>
              <Input
                value={paramForm.name}
                onChange={(e) => setParamForm({ ...paramForm, name: e.target.value })}
                placeholder="Ex: Padrão, Promoção, Black Friday..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>% Plataforma</Label>
                <DecimalInput
                  value={paramForm.platform_fee_pct}
                  onValueChange={(v) => setParamForm({ ...paramForm, platform_fee_pct: v })}
                />
              </div>
              <div>
                <Label>% Pagamento</Label>
                <DecimalInput
                  value={paramForm.payment_fee_pct}
                  onValueChange={(v) => setParamForm({ ...paramForm, payment_fee_pct: v })}
                />
              </div>
              <div>
                <Label>% Extra</Label>
                <DecimalInput
                  value={paramForm.extra_fee_pct}
                  onValueChange={(v) => setParamForm({ ...paramForm, extra_fee_pct: v })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Embalagem (R$)</Label>
                <DecimalInput
                  value={paramForm.packaging_cost}
                  onValueChange={(v) => setParamForm({ ...paramForm, packaging_cost: v })}
                />
              </div>
              <div>
                <Label>Frete (R$)</Label>
                <DecimalInput
                  value={paramForm.shipping_cost}
                  onValueChange={(v) => setParamForm({ ...paramForm, shipping_cost: v })}
                />
              </div>
              <div>
                <Label>% Margem Alvo</Label>
                <DecimalInput
                  value={paramForm.target_margin_pct}
                  onValueChange={(v) => setParamForm({ ...paramForm, target_margin_pct: v })}
                />
              </div>
            </div>

            {/* Custom Fee Fields */}
            {feeFields.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Campos Personalizados</Label>
                <div className="grid grid-cols-2 gap-4">
                  {feeFields.map(field => (
                    <div key={field.id}>
                      <Label className="text-xs">{field.name}</Label>
                      <DecimalInput
                        value={paramForm.customFees[field.id] || '0'}
                        onValueChange={(v) => setParamForm({
                          ...paramForm,
                          customFees: { ...paramForm.customFees, [field.id]: v }
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={paramForm.is_active}
                onCheckedChange={(v) => setParamForm({ ...paramForm, is_active: v })}
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParamDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveParam} disabled={loading}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de Alterações
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {history.length > 0 ? (
              <div className="space-y-3">
                {history.map(h => {
                  const snapshot = h.snapshot as Record<string, unknown> | null;
                  return (
                    <Card key={h.id} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {format(parseISO(h.changed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        {h.notes && <Badge variant="outline">{h.notes}</Badge>}
                      </div>
                      {snapshot && (
                        <div className="text-xs text-muted-foreground grid grid-cols-3 gap-2">
                          <div>Plat: {formatPercent(Number(snapshot.platform_fee_pct) || 0)}</div>
                          <div>Pag: {formatPercent(Number(snapshot.payment_fee_pct) || 0)}</div>
                          <div>Extra: {formatPercent(Number(snapshot.extra_fee_pct) || 0)}</div>
                          <div>Emb: {formatCurrency(Number(snapshot.packaging_cost) || 0)}</div>
                          <div>Frete: {formatCurrency(Number(snapshot.shipping_cost) || 0)}</div>
                          <div>Alvo: {formatPercent(Number(snapshot.target_margin_pct) || 0)}</div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum histórico disponível</p>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simulation Save Dialog */}
      <Dialog open={simulationDialogOpen} onOpenChange={setSimulationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Simulação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Simulação</Label>
              <Input
                value={simulationName || (selectedSimulationId ? simulations.find(s => s.id === selectedSimulationId)?.name : '')}
                onChange={(e) => setSimulationName(e.target.value)}
                placeholder={`Simulação ${new Date().toLocaleDateString('pt-BR')}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSimulationDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSimulation} disabled={loading}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
