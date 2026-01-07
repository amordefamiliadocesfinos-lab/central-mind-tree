import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProcesses } from '@/hooks/useProcesses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { 
  Factory, 
  Users, 
  Calendar as CalendarIcon, 
  Download, 
  Filter,
  TrendingUp
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProductionEntry {
  id: string;
  date: string;
  employee_name: string;
  process: string;
  process_name?: string;
  quantity: number;
  value_per_unit: number;
  total_value: number;
  notes: string | null;
  source: 'legacy' | 'op';
}

interface ProcessSummary {
  process: string;
  total_quantity: number;
  total_value: number;
}

interface EmployeeSummary {
  employee: string;
  total_quantity: number;
  total_value: number;
  processes: Record<string, { quantity: number; value: number }>;
}

const PERIOD_PRESETS = [
  { label: 'Hoje', getValue: () => ({ start: new Date(), end: new Date() }) },
  { label: 'Esta Semana', getValue: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: 'Este Mês', getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  { label: 'Últimos 7 dias', getValue: () => ({ start: subDays(new Date(), 6), end: new Date() }) },
  { label: 'Últimos 30 dias', getValue: () => ({ start: subDays(new Date(), 29), end: new Date() }) },
];

export function LegacyProductionReport() {
  const { processes } = useProcesses();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterProcess, setFilterProcess] = useState('all');

  // Get process value lookup
  const processValueMap = useMemo(() => {
    const map: Record<string, number> = {};
    processes.forEach(p => {
      map[p.name] = p.value_per_unit;
    });
    return map;
  }, [processes]);

  const fetchData = async () => {
    setLoading(true);
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    // Fetch legacy production_logs
    const { data: legacyData, error: legacyError } = await supabase
      .from('production_logs')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true });

    // Fetch production_entries (OP system)
    const { data: opData, error: opError } = await supabase
      .from('production_entries')
      .select(`
        *,
        process:processes(id, name, value_per_unit)
      `)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true });

    if (legacyError) console.error('Legacy error:', legacyError);
    if (opError) console.error('OP error:', opError);

    // Convert legacy logs
    const legacyEntries: ProductionEntry[] = (legacyData || []).map((log: any) => {
      const valuePerUnit = processValueMap[log.process] || 0;
      return {
        id: log.id,
        date: log.date,
        employee_name: log.employee_name,
        process: log.process,
        process_name: log.process,
        quantity: log.quantity,
        value_per_unit: valuePerUnit,
        total_value: log.quantity * valuePerUnit,
        notes: log.notes,
        source: 'legacy' as const,
      };
    });

    // Convert OP entries
    const opEntries: ProductionEntry[] = (opData || []).map((entry: any) => ({
      id: `op-${entry.id}`,
      date: entry.date,
      employee_name: entry.employee_name,
      process: entry.process?.name || 'Processo',
      process_name: entry.process?.name || 'Processo',
      quantity: entry.quantity,
      value_per_unit: entry.value_per_unit || entry.process?.value_per_unit || 0,
      total_value: entry.total_value || (entry.quantity * (entry.value_per_unit || entry.process?.value_per_unit || 0)),
      notes: entry.notes,
      source: 'op' as const,
    }));

    // Combine and sort
    const combined = [...legacyEntries, ...opEntries].sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    setEntries(combined);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, processValueMap]);

  // Get unique employees and processes for filters
  const uniqueEmployees = useMemo(() => {
    const set = new Set(entries.map(e => e.employee_name));
    return Array.from(set).sort();
  }, [entries]);

  const uniqueProcesses = useMemo(() => {
    const set = new Set(entries.map(e => e.process));
    return Array.from(set).sort();
  }, [entries]);

  // Apply filters
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchEmployee = filterEmployee === 'all' || e.employee_name === filterEmployee;
      const matchProcess = filterProcess === 'all' || e.process === filterProcess;
      return matchEmployee && matchProcess;
    });
  }, [entries, filterEmployee, filterProcess]);

  // Calculate summaries
  const summaries = useMemo(() => {
    const byProcess: Record<string, ProcessSummary> = {};
    const byEmployee: Record<string, EmployeeSummary> = {};
    let totalQuantity = 0;
    let totalValue = 0;

    filteredEntries.forEach(entry => {
      totalQuantity += entry.quantity;
      totalValue += entry.total_value;

      // By process
      if (!byProcess[entry.process]) {
        byProcess[entry.process] = { process: entry.process, total_quantity: 0, total_value: 0 };
      }
      byProcess[entry.process].total_quantity += entry.quantity;
      byProcess[entry.process].total_value += entry.total_value;

      // By employee
      if (!byEmployee[entry.employee_name]) {
        byEmployee[entry.employee_name] = { 
          employee: entry.employee_name, 
          total_quantity: 0, 
          total_value: 0,
          processes: {} 
        };
      }
      byEmployee[entry.employee_name].total_quantity += entry.quantity;
      byEmployee[entry.employee_name].total_value += entry.total_value;
      
      if (!byEmployee[entry.employee_name].processes[entry.process]) {
        byEmployee[entry.employee_name].processes[entry.process] = { quantity: 0, value: 0 };
      }
      byEmployee[entry.employee_name].processes[entry.process].quantity += entry.quantity;
      byEmployee[entry.employee_name].processes[entry.process].value += entry.total_value;
    });

    return {
      byProcess: Object.values(byProcess).sort((a, b) => b.total_quantity - a.total_quantity),
      byEmployee: Object.values(byEmployee).sort((a, b) => b.total_value - a.total_value),
      totalQuantity,
      totalValue,
      totalEmployees: Object.keys(byEmployee).length,
    };
  }, [filteredEntries]);

  const handleExportCSV = () => {
    const headers = ['Data', 'Funcionário', 'Processo', 'Quantidade', 'Valor Unitário', 'Valor Total', 'Observações'];
    const rows = filteredEntries.map(e => [
      format(parseISO(e.date), 'dd/MM/yyyy'),
      e.employee_name,
      e.process,
      e.quantity.toString(),
      e.value_per_unit.toFixed(2),
      e.total_value.toFixed(2),
      e.notes || '',
    ]);

    // Add summary rows
    rows.push([]);
    rows.push(['RESUMO POR PROCESSO']);
    summaries.byProcess.forEach(s => {
      rows.push([s.process, '', '', s.total_quantity.toString(), '', s.total_value.toFixed(2), '']);
    });

    rows.push([]);
    rows.push(['RESUMO POR FUNCIONÁRIO']);
    summaries.byEmployee.forEach(s => {
      rows.push([s.employee, '', '', s.total_quantity.toString(), '', s.total_value.toFixed(2), '']);
    });

    rows.push([]);
    rows.push(['TOTAL GERAL', '', '', summaries.totalQuantity.toString(), '', summaries.totalValue.toFixed(2), '']);

    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `producao-${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyPreset = (preset: typeof PERIOD_PRESETS[0]) => {
    const { start, end } = preset.getValue();
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <div className="space-y-4">
      {/* Period Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Período do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            {PERIOD_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'dd/MM/yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, 'dd/MM/yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <Factory className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{summaries.totalQuantity.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">Total Produzido</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold text-green-600">
              {summaries.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="text-xs text-muted-foreground">Valor Total Pago</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{summaries.totalEmployees}</p>
            <p className="text-xs text-muted-foreground">Funcionários</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <CalendarIcon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{filteredEntries.length}</p>
            <p className="text-xs text-muted-foreground">Lançamentos</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Export */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Funcionário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Funcionários</SelectItem>
            {uniqueEmployees.map(emp => (
              <SelectItem key={emp} value={emp}>{emp}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterProcess} onValueChange={setFilterProcess}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Processo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Processos</SelectItem>
            {uniqueProcesses.map(proc => (
              <SelectItem key={proc} value={proc}>{proc}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Summary by Process */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resumo por Processo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.byProcess.map((s) => (
                  <TableRow key={s.process}>
                    <TableCell className="font-medium">{s.process}</TableCell>
                    <TableCell className="text-right">{s.total_quantity.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                      {s.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">TOTAL</TableCell>
                  <TableCell className="text-right font-bold">{summaries.totalQuantity.toLocaleString('pt-BR')}</TableCell>
                  <TableCell className="text-right font-bold">
                    {summaries.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary by Employee */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resumo por Funcionário (Salário Pago)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Salário Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.byEmployee.map((s) => (
                  <TableRow key={s.employee}>
                    <TableCell className="font-medium">{s.employee}</TableCell>
                    <TableCell className="text-right">{s.total_quantity.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {s.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">TOTAL</TableCell>
                  <TableCell className="text-right font-bold">{summaries.totalQuantity.toLocaleString('pt-BR')}</TableCell>
                  <TableCell className="text-right font-bold text-green-600">
                    {summaries.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Entries Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Lançamentos Detalhados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Factory className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhum lançamento no período</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor/Un</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(parseISO(entry.date), 'dd/MM')}
                      </TableCell>
                      <TableCell>{entry.employee_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {entry.process}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.quantity.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {entry.value_per_unit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {entry.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
