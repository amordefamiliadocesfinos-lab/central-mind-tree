import { useState, useEffect } from 'react';
import { useProductCosts, ProductProcess, ProductOptionalCost, ProductCostBreakdown } from '@/hooks/useProductCosts';
import { useProcesses, Process } from '@/hooks/useProcesses';
import { useBOM } from '@/hooks/useBOM';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Cog, Package, DollarSign, Trash2, RefreshCw } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface ProductCostEditorProps {
  productId: string;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCostUpdated?: () => void;
}

export function ProductCostEditor({ 
  productId, 
  productName, 
  open, 
  onOpenChange,
  onCostUpdated,
}: ProductCostEditorProps) {
  const { 
    productProcesses,
    optionalCosts,
    loading,
    fetchProductProcesses,
    addProductProcess,
    updateProductProcess,
    removeProductProcess,
    fetchOptionalCosts,
    addOptionalCost,
    updateOptionalCost,
    deleteOptionalCost,
    calculateProductCost,
    syncProductCost,
  } = useProductCosts();
  const { activeProcesses } = useProcesses();
  const { fetchComponentsForProduct, components } = useBOM();

  const [costBreakdown, setCostBreakdown] = useState<ProductCostBreakdown | null>(null);
  const [showAddProcess, setShowAddProcess] = useState(false);
  const [showAddOptional, setShowAddOptional] = useState(false);
  const [newProcess, setNewProcess] = useState({ process_id: '', cost_per_unit: 0 });
  const [newOptional, setNewOptional] = useState({ name: '', cost_per_unit: 0 });

  useEffect(() => {
    if (open && productId) {
      fetchProductProcesses(productId);
      fetchOptionalCosts(productId);
      fetchComponentsForProduct(productId);
      loadCostBreakdown();
    }
  }, [open, productId, fetchProductProcesses, fetchOptionalCosts, fetchComponentsForProduct]);

  const loadCostBreakdown = async () => {
    const breakdown = await calculateProductCost(productId);
    setCostBreakdown(breakdown);
  };

  const handleAddProcess = async () => {
    if (!newProcess.process_id) return;
    await addProductProcess(productId, newProcess.process_id, newProcess.cost_per_unit);
    setShowAddProcess(false);
    setNewProcess({ process_id: '', cost_per_unit: 0 });
    loadCostBreakdown();
  };

  const handleRemoveProcess = async (id: string) => {
    if (confirm('Remover este processo?')) {
      await removeProductProcess(id);
      loadCostBreakdown();
    }
  };

  const handleAddOptional = async () => {
    if (!newOptional.name.trim()) return;
    await addOptionalCost(productId, newOptional.name, newOptional.cost_per_unit);
    setShowAddOptional(false);
    setNewOptional({ name: '', cost_per_unit: 0 });
    loadCostBreakdown();
  };

  const handleToggleOptional = async (cost: ProductOptionalCost) => {
    await updateOptionalCost(cost.id, { is_active: !cost.is_active });
    loadCostBreakdown();
  };

  const handleDeleteOptional = async (id: string) => {
    if (confirm('Excluir este custo opcional?')) {
      await deleteOptionalCost(id);
      loadCostBreakdown();
    }
  };

  const handleSyncCost = async () => {
    await syncProductCost(productId);
    onCostUpdated?.();
  };

  // Filter out already linked processes
  const availableProcesses = activeProcesses.filter(
    p => !productProcesses.some(pp => pp.process_id === p.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Custos: {productName}
          </DialogTitle>
        </DialogHeader>

        {/* Cost Summary */}
        {costBreakdown && (
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold">{formatCurrency(costBreakdown.materials)}</p>
                  <p className="text-xs text-muted-foreground">Materiais</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{formatCurrency(costBreakdown.processes)}</p>
                  <p className="text-xs text-muted-foreground">Processos</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{formatCurrency(costBreakdown.optionals)}</p>
                  <p className="text-xs text-muted-foreground">Opcionais</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">{formatCurrency(costBreakdown.total)}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-3"
                onClick={handleSyncCost}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar Custo do Produto
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="processes" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="materials">Materiais</TabsTrigger>
            <TabsTrigger value="processes">Processos</TabsTrigger>
            <TabsTrigger value="optionals">Opcionais</TabsTrigger>
          </TabsList>

          {/* Materials Tab (BOM - Read Only) */}
          <TabsContent value="materials" className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Componentes da BOM (gerenciar na aba Componentes do produto)
            </p>
            {components.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Sem componentes</p>
            ) : (
              components.map((comp) => (
                <Card key={comp.id}>
                  <CardContent className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{comp.component?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(comp.qty_per_unit)} {comp.component?.unit}
                      </p>
                    </div>
                    <Badge variant="secondary">BOM</Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Processes Tab */}
          <TabsContent value="processes" className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setShowAddProcess(true)}
              disabled={availableProcesses.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Vincular Processo
            </Button>

            {productProcesses.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum processo vinculado</p>
            ) : (
              productProcesses.map((pp) => (
                <Card key={pp.id}>
                  <CardContent className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{pp.process?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Base: {formatCurrency(pp.process?.value_per_unit || 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="any"
                        className="w-28 h-8 text-right"
                        value={pp.cost_per_unit}
                        onChange={(e) => {
                          updateProductProcess(pp.id, parseFloat(e.target.value) || 0);
                        }}
                      />
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleRemoveProcess(pp.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Add Process Dialog */}
            {showAddProcess && (
              <Card className="border-primary">
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <Label>Processo</Label>
                    <Select
                      value={newProcess.process_id}
                      onValueChange={(v) => {
                        const proc = activeProcesses.find(p => p.id === v);
                        setNewProcess({ 
                          process_id: v, 
                          cost_per_unit: proc?.value_per_unit || 0 
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProcesses.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Custo por Unidade (R$)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={newProcess.cost_per_unit}
                      onChange={(e) => setNewProcess({ ...newProcess, cost_per_unit: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowAddProcess(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddProcess}>Adicionar</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Optionals Tab */}
          <TabsContent value="optionals" className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setShowAddOptional(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Custo Opcional
            </Button>

            {optionalCosts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum custo opcional</p>
            ) : (
              optionalCosts.map((cost) => (
                <Card key={cost.id} className={!cost.is_active ? 'opacity-60' : ''}>
                  <CardContent className="p-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Switch 
                        checked={cost.is_active}
                        onCheckedChange={() => handleToggleOptional(cost)}
                      />
                      <div>
                        <p className="font-medium">{cost.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cost.is_active ? 'Ativo' : 'Inativo'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCurrency(cost.cost_per_unit)}</span>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleDeleteOptional(cost.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Add Optional Dialog */}
            {showAddOptional && (
              <Card className="border-primary">
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      value={newOptional.name}
                      onChange={(e) => setNewOptional({ ...newOptional, name: e.target.value })}
                      placeholder="Ex: Embalagem, Logística"
                    />
                  </div>
                  <div>
                    <Label>Custo por Unidade (R$)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={newOptional.cost_per_unit}
                      onChange={(e) => setNewOptional({ ...newOptional, cost_per_unit: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowAddOptional(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddOptional}>Adicionar</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
