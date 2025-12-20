import { useState, useEffect, useMemo } from 'react';
import { useProductionLogs, ProductionLog, PROCESS_LABELS, PRODUCTION_PERIODS } from '@/hooks/useProductionLogs';
import { useOrders, Product } from '@/hooks/useOrders';
import { useMRP } from '@/hooks/useMRP';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductionLogForm } from './ProductionLogForm';
import { ProductivityCharts } from './ProductivityCharts';
import { ProcessesManager } from './ProcessesManager';
import { ProductionOrdersTab } from './ProductionOrdersTab';
import { ProductionClosingTab } from './ProductionClosingTab';
import { Plus, Factory, Users, Calendar, ChevronLeft, ChevronRight, Pencil, Download, BarChart3, Cog, ClipboardList, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionTabProps {
  products: Product[];
  onRefetch?: () => void;
}

export function ProductionTab({ products, onRefetch }: ProductionTabProps) {
  const {
    logs,
    loading,
    fetchLogs,
    createLog,
    updateLog,
    deleteLog,
    getSummary,
    getUniqueEmployees,
  } = useProductionLogs();
  const { consumeMaterials } = useMRP();

  const [activeSubTab, setActiveSubTab] = useState('orders');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<ProductionLog | null>(null);
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterProcess, setFilterProcess] = useState('all');
  const [showCharts, setShowCharts] = useState(true);

  useEffect(() => {
    if (activeSubTab === 'logs') {
      fetchLogs(selectedDate);
      getUniqueEmployees().then(setEmployees);
    }
  }, [selectedDate, activeSubTab, fetchLogs, getUniqueEmployees]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesDate = log.date === selectedDate;
      const matchesEmployee = filterEmployee === 'all' || log.employee_name === filterEmployee;
      const matchesProcess = filterProcess === 'all' || log.process === filterProcess;
      return matchesDate && matchesEmployee && matchesProcess;
    });
  }, [logs, selectedDate, filterEmployee, filterProcess]);

  const summary = useMemo(() => getSummary(filteredLogs), [filteredLogs, getSummary]);

  const navigateDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleExportCSV = () => {
    const headers = ['Data', 'Período', 'Funcionário', 'Processo', 'Produto', 'Quantidade', 'Observações', 'Avisos'];
    const rows = filteredLogs.map(log => [
      log.date,
      PRODUCTION_PERIODS[log.period],
      log.employee_name,
      PROCESS_LABELS[log.process] || log.process,
      log.product?.name || '',
      log.quantity.toString(),
      log.notes || '',
      log.warnings || '',
    ]);

    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `producao-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async (data: Omit<ProductionLog, 'id' | 'created_at' | 'updated_at' | 'product'>, consumeStock?: boolean) => {
    const result = await createLog(data);
    if (result) {
      await getUniqueEmployees().then(setEmployees);
      
      // Consume stock via BOM if requested
      if (consumeStock && data.product_id && data.quantity > 0) {
        await consumeMaterials(
          result.id, 
          [{ product_id: data.product_id, quantity: data.quantity }]
        );
        onRefetch?.();
      }
    }
    return result;
  };

  const handleUpdate = async (id: string, data: Partial<ProductionLog>) => {
    const result = await updateLog(id, data);
    setEditingLog(null);
    return result;
  };

  const handleDelete = async (id: string) => {
    const result = await deleteLog(id);
    setEditingLog(null);
    return result;
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs Navigation */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="orders" className="gap-1">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">OPs</span>
          </TabsTrigger>
          <TabsTrigger value="processes" className="gap-1">
            <Cog className="h-4 w-4" />
            <span className="hidden sm:inline">Processos</span>
          </TabsTrigger>
          <TabsTrigger value="closing" className="gap-1">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Fechamento</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1">
            <Factory className="h-4 w-4" />
            <span className="hidden sm:inline">Legado</span>
          </TabsTrigger>
        </TabsList>

        {/* Production Orders Tab */}
        <TabsContent value="orders">
          <ProductionOrdersTab products={products} />
        </TabsContent>

        {/* Processes Tab */}
        <TabsContent value="processes">
          <ProcessesManager />
        </TabsContent>

        {/* Closing Tab */}
        <TabsContent value="closing">
          <ProductionClosingTab />
        </TabsContent>

        {/* Legacy Logs Tab */}
        <TabsContent value="logs">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Date Navigation */}
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    className="w-auto h-10"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => navigateDate(1)}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold">{summary.total_quantity}</p>
                    <p className="text-xs text-muted-foreground">Total Produzido</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      <p className="text-3xl font-bold">{summary.employees_working.length}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Funcionários</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Toggle & Productivity Charts */}
              <div className="flex items-center justify-between">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowCharts(!showCharts)}
                  className="gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  {showCharts ? 'Ocultar Gráficos' : 'Ver Gráficos'}
                </Button>
              </div>

              {showCharts && <ProductivityCharts logs={filteredLogs} selectedDate={selectedDate} />}

              {/* By Employee Summary */}
              {Object.keys(summary.by_employee).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Resumo por Funcionário</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(summary.by_employee).map(([name, qty]) => (
                        <Badge key={name} variant="secondary" className="text-sm py-1 px-3">
                          {name}: <span className="font-bold ml-1">{qty}</span>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Filters */}
              <div className="flex gap-2">
                <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterProcess} onValueChange={setFilterProcess}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Processo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(PROCESS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button className="flex-1 h-12" onClick={() => setShowForm(true)}>
                  <Plus className="h-5 w-5 mr-2" />
                  Novo Lançamento
                </Button>
                <Button variant="outline" size="icon" className="h-12 w-12" onClick={handleExportCSV}>
                  <Download className="h-5 w-5" />
                </Button>
              </div>

              {/* Log List */}
              <div className="space-y-2">
                {filteredLogs.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhum lançamento para esta data</p>
                  </Card>
                ) : (
                  filteredLogs.map((log) => (
                    <Card 
                      key={log.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setEditingLog(log)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{log.employee_name}</span>
                              <Badge variant="outline" className="text-xs">
                                {PRODUCTION_PERIODS[log.period]}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="secondary" className="text-xs">
                                {PROCESS_LABELS[log.process] || log.process}
                              </Badge>
                              {log.product && (
                                <span>{log.product.name}</span>
                              )}
                            </div>
                            {log.notes && (
                              <p className="text-xs text-muted-foreground">{log.notes}</p>
                            )}
                            {log.warnings && (
                              <p className="text-xs text-amber-600">⚠ {log.warnings}</p>
                            )}
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <span className="text-2xl font-bold">{log.quantity}</span>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Form Dialog */}
              <ProductionLogForm
                open={showForm || !!editingLog}
                onOpenChange={(open) => {
                  if (!open) {
                    setShowForm(false);
                    setEditingLog(null);
                  }
                }}
                log={editingLog}
                products={products}
                employees={employees}
                onSave={handleSave}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                defaultDate={selectedDate}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
