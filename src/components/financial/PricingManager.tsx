import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Download, Copy, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { usePricing, PriceParam, SimulatorItem, calculatePricing, CalculatedItem } from '@/hooks/usePricing';
import { DecimalInput } from '@/components/ui/decimal-input';
import { parseDecimalInput } from '@/lib/decimal';
import { cn } from '@/lib/utils';

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

export function PricingManager() {
  const {
    channels,
    params,
    loading,
    createChannel,
    updateChannel,
    deleteChannel,
    createParam,
    updateParam,
    deleteParam,
    fetchParams
  } = usePricing();

  // State for dialogs
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [paramDialogOpen, setParamDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<{ id: string; name: string } | null>(null);
  const [editingParam, setEditingParam] = useState<PriceParam | null>(null);
  const [channelName, setChannelName] = useState('');
  const [filterChannelId, setFilterChannelId] = useState<string>('all');

  // Param form state (using strings for decimal inputs)
  const [paramForm, setParamForm] = useState({
    channel_id: '',
    name: '',
    platform_fee_pct: '0',
    payment_fee_pct: '0',
    extra_fee_pct: '0',
    packaging_cost: '0',
    shipping_cost: '0',
    target_margin_pct: '20',
    is_active: true
  });

  // Simulator state
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [selectedParamId, setSelectedParamId] = useState<string>('');
  const [simulatorItems, setSimulatorItems] = useState<(SimulatorItem & { pack_cost_str: string; unit_price_str: string })[]>([
    { id: '1', product_name: '', pack_qty: 1, pack_cost: 0, unit_price: 0, pack_cost_str: '0', unit_price_str: '0' }
  ]);

  // Persist simulator selections
  useEffect(() => {
    const savedChannel = localStorage.getItem('pricing_selected_channel');
    const savedParam = localStorage.getItem('pricing_selected_param');
    if (savedChannel) setSelectedChannelId(savedChannel);
    if (savedParam) setSelectedParamId(savedParam);
  }, []);

  useEffect(() => {
    if (selectedChannelId) {
      localStorage.setItem('pricing_selected_channel', selectedChannelId);
    }
  }, [selectedChannelId]);

  useEffect(() => {
    if (selectedParamId) {
      localStorage.setItem('pricing_selected_param', selectedParamId);
    }
  }, [selectedParamId]);

  // Get selected param
  const selectedParam = useMemo(() => {
    return params.find(p => p.id === selectedParamId);
  }, [params, selectedParamId]);

  // Calculate items
  const calculatedItems: CalculatedItem[] = useMemo(() => {
    if (!selectedParam) return [];
    return simulatorItems
      .filter(item => item.product_name.trim() !== '')
      .map(item => calculatePricing(item, selectedParam));
  }, [simulatorItems, selectedParam]);

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

  // Filter params by channel
  const filteredParams = useMemo(() => {
    if (filterChannelId === 'all') return params;
    return params.filter(p => p.channel_id === filterChannelId);
  }, [params, filterChannelId]);

  // Params for selected channel in simulator
  const channelParams = useMemo(() => {
    return params.filter(p => p.channel_id === selectedChannelId && p.is_active);
  }, [params, selectedChannelId]);

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

  const handleEditChannel = (channel: { id: string; name: string }) => {
    setEditingChannel(channel);
    setChannelName(channel.name);
    setChannelDialogOpen(true);
  };

  const handleDeleteChannel = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este canal?')) {
      await deleteChannel(id);
    }
  };

  const handleOpenParamDialog = (param?: PriceParam) => {
    if (param) {
      setEditingParam(param);
      setParamForm({
        channel_id: param.channel_id,
        name: param.name,
        platform_fee_pct: String(param.platform_fee_pct * 100),
        payment_fee_pct: String(param.payment_fee_pct * 100),
        extra_fee_pct: String(param.extra_fee_pct * 100),
        packaging_cost: String(param.packaging_cost),
        shipping_cost: String(param.shipping_cost),
        target_margin_pct: String(param.target_margin_pct * 100),
        is_active: param.is_active
      });
    } else {
      setEditingParam(null);
      setParamForm({
        channel_id: filterChannelId !== 'all' ? filterChannelId : (channels[0]?.id || ''),
        name: '',
        platform_fee_pct: '0',
        payment_fee_pct: '0',
        extra_fee_pct: '0',
        packaging_cost: '0',
        shipping_cost: '0',
        target_margin_pct: '20',
        is_active: true
      });
    }
    setParamDialogOpen(true);
  };

  const parseNum = (str: string): number => {
    const parsed = parseDecimalInput(str);
    return parsed?.number || 0;
  };

  const handleSaveParam = async () => {
    if (!paramForm.channel_id || !paramForm.name.trim()) return;

    const data = {
      channel_id: paramForm.channel_id,
      name: paramForm.name,
      platform_fee_pct: parseNum(paramForm.platform_fee_pct) / 100,
      payment_fee_pct: parseNum(paramForm.payment_fee_pct) / 100,
      extra_fee_pct: parseNum(paramForm.extra_fee_pct) / 100,
      packaging_cost: parseNum(paramForm.packaging_cost),
      shipping_cost: parseNum(paramForm.shipping_cost),
      target_margin_pct: parseNum(paramForm.target_margin_pct) / 100,
      is_active: paramForm.is_active
    };

    if (editingParam) {
      await updateParam(editingParam.id, data);
    } else {
      await createParam(data);
    }
    setParamDialogOpen(false);
    setEditingParam(null);
  };

  const handleDeleteParam = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este parâmetro?')) {
      await deleteParam(id);
    }
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

  const exportCSV = () => {
    if (calculatedItems.length === 0) return;
    
    const channel = channels.find(c => c.id === selectedChannelId);
    const headers = ['Canal', 'Parâmetro', 'Produto', 'Qtd/Pacote', 'Custo Pacote', 'Custo Unit', 'Preço Unit', 'Recebemos Líquido', 'Margem %', 'Preço Ideal'];
    const rows = calculatedItems.map(item => [
      channel?.name || '',
      selectedParam?.name || '',
      item.product_name,
      item.pack_qty,
      item.pack_cost.toFixed(2),
      item.unit_cost.toFixed(4),
      item.unit_price.toFixed(2),
      item.net_received.toFixed(2),
      (item.margin_pct * 100).toFixed(2) + '%',
      item.ideal_price.toFixed(2)
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

  const getMarginColor = (margin: number, target: number) => {
    if (margin < 0) return 'text-red-600 bg-red-50';
    if (margin < target) return 'text-amber-600 bg-amber-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="params" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="params">Parâmetros</TabsTrigger>
          <TabsTrigger value="simulator">Simulador</TabsTrigger>
        </TabsList>

        {/* Parâmetros Tab */}
        <TabsContent value="params" className="space-y-4">
          {/* Canais */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Canais de Venda</CardTitle>
                <Button size="sm" onClick={() => { setEditingChannel(null); setChannelName(''); setChannelDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Novo Canal
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {channels.map(channel => (
                  <Badge 
                    key={channel.id} 
                    variant="outline" 
                    className="py-1.5 px-3 flex items-center gap-2"
                  >
                    {channel.name}
                    <button onClick={() => handleEditChannel(channel)} className="hover:text-primary">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => handleDeleteChannel(channel.id)} className="hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Parâmetros */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Parâmetros de Precificação</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={filterChannelId} onValueChange={setFilterChannelId}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar por canal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os canais</SelectItem>
                      {channels.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => handleOpenParamDialog()}>
                    <Plus className="h-4 w-4 mr-1" /> Novo Parâmetro
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Canal</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">% Plataforma</TableHead>
                      <TableHead className="text-right">% Pagamento</TableHead>
                      <TableHead className="text-right">% Extra</TableHead>
                      <TableHead className="text-right">Embalagem</TableHead>
                      <TableHead className="text-right">Frete</TableHead>
                      <TableHead className="text-right">% Margem Alvo</TableHead>
                      <TableHead className="text-center">Ativo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParams.map(param => (
                      <TableRow key={param.id}>
                        <TableCell className="font-medium">{param.channel?.name}</TableCell>
                        <TableCell>{param.name}</TableCell>
                        <TableCell className="text-right">{formatPercent(param.platform_fee_pct)}</TableCell>
                        <TableCell className="text-right">{formatPercent(param.payment_fee_pct)}</TableCell>
                        <TableCell className="text-right">{formatPercent(param.extra_fee_pct)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(param.packaging_cost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(param.shipping_cost)}</TableCell>
                        <TableCell className="text-right">{formatPercent(param.target_margin_pct)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={param.is_active ? 'default' : 'secondary'}>
                            {param.is_active ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenParamDialog(param)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteParam(param.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredParams.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          Nenhum parâmetro cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
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
                  <Label>Canal</Label>
                  <Select value={selectedChannelId} onValueChange={(v) => { setSelectedChannelId(v); setSelectedParamId(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o canal" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label>Parâmetro</Label>
                  <Select value={selectedParamId} onValueChange={setSelectedParamId} disabled={!selectedChannelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o parâmetro" />
                    </SelectTrigger>
                    <SelectContent>
                      {channelParams.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          {summaryStats && selectedParam && (
            <div className="grid grid-cols-3 gap-3">
              <Card className={cn("p-3", getMarginColor(summaryStats.avg, selectedParam.target_margin_pct))}>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <div>
                    <p className="text-xs text-muted-foreground">Média Margem</p>
                    <p className="text-lg font-bold">{formatPercent(summaryStats.avg)}</p>
                  </div>
                </div>
              </Card>
              <Card className={cn("p-3", getMarginColor(summaryStats.min, selectedParam.target_margin_pct))}>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  <div>
                    <p className="text-xs text-muted-foreground">Menor Margem</p>
                    <p className="text-lg font-bold">{formatPercent(summaryStats.min)}</p>
                  </div>
                </div>
              </Card>
              <Card className={cn("p-3", getMarginColor(summaryStats.max, selectedParam.target_margin_pct))}>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <div>
                    <p className="text-xs text-muted-foreground">Maior Margem</p>
                    <p className="text-lg font-bold">{formatPercent(summaryStats.max)}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Simulator Table */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Simulação de Preços</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addSimulatorRow}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Linha
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportCSV} disabled={calculatedItems.length === 0}>
                    <Download className="h-4 w-4 mr-1" /> Exportar CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Produto</TableHead>
                      <TableHead className="text-right w-[100px]">Qtd/Pacote</TableHead>
                      <TableHead className="text-right w-[120px]">Custo Pacote</TableHead>
                      <TableHead className="text-right w-[100px]">Custo Unit</TableHead>
                      <TableHead className="text-right w-[120px]">Preço Unit</TableHead>
                      <TableHead className="text-right w-[120px]">Recebemos Líq.</TableHead>
                      <TableHead className="text-right w-[100px]">Margem %</TableHead>
                      <TableHead className="text-right w-[120px]">Preço Ideal</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulatorItems.map((item) => {
                      const calc = selectedParam ? calculatePricing(item, selectedParam) : null;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Input
                              value={item.product_name}
                              onChange={(e) => updateSimulatorItem(item.id, 'product_name', e.target.value)}
                              placeholder="Nome do produto"
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
                          <TableCell className="text-right text-muted-foreground">
                            {calc ? formatCurrency(calc.unit_cost) : '-'}
                          </TableCell>
                          <TableCell>
                            <DecimalInput
                              value={item.unit_price_str}
                              onValueChange={(v) => updateSimulatorItem(item.id, 'unit_price_str', v)}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {calc ? formatCurrency(calc.net_received) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {calc && selectedParam ? (
                              <Badge className={cn("font-mono", getMarginColor(calc.margin_pct, selectedParam.target_margin_pct))}>
                                {formatPercent(calc.margin_pct)}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {calc ? formatCurrency(calc.ideal_price) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateRow(item.id)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7" 
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
              </div>
              {!selectedParam && (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  Selecione um canal e parâmetro para calcular os valores
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

      {/* Param Dialog */}
      <Dialog open={paramDialogOpen} onOpenChange={setParamDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingParam ? 'Editar Parâmetro' : 'Novo Parâmetro'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Canal</Label>
                <Select value={paramForm.channel_id} onValueChange={(v) => setParamForm({ ...paramForm, channel_id: v })}>
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
                <Label>Nome</Label>
                <Input
                  value={paramForm.name}
                  onChange={(e) => setParamForm({ ...paramForm, name: e.target.value })}
                  placeholder="Ex: Padrão, Promoção..."
                />
              </div>
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
                <Label>Custo Embalagem</Label>
                <DecimalInput
                  value={paramForm.packaging_cost}
                  onValueChange={(v) => setParamForm({ ...paramForm, packaging_cost: v })}
                />
              </div>
              <div>
                <Label>Custo Frete</Label>
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
    </div>
  );
}
