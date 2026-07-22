import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, AlertTriangle, Clock, CheckCircle, Wallet,
  BarChart3, PieChart as PieIcon, Search, CheckSquare, Square,
} from 'lucide-react';
import { useFinancial, FinancialSummary, FinancialEntry, getEntryStatus } from '@/hooks/useFinancial';
import { format, parseISO } from 'date-fns';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

interface SummaryCardProps {
  title: string;
  value: number;
  count?: number;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

function SummaryCard({ title, value, count, icon, variant = 'default' }: SummaryCardProps) {
  const variants = {
    default: 'bg-card',
    success: 'bg-emerald-500/10 border-emerald-500/20',
    warning: 'bg-amber-500/10 border-amber-500/20',
    danger: 'bg-red-500/10 border-red-500/20',
  };
  const iconVariants = {
    default: 'text-muted-foreground',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    danger: 'text-red-500',
  };
  return (
    <Card className={variants[variant]}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{formatCurrency(value)}</p>
            {count !== undefined && <p className="text-xs text-muted-foreground">{count} lançamento(s)</p>}
          </div>
          <div className={iconVariants[variant]}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function TypeSummary({ title, summary, type }: { title: string; summary: FinancialSummary; type: 'pagar' | 'receber' }) {
  const Icon = type === 'receber' ? TrendingUp : TrendingDown;
  const iconColor = type === 'receber' ? 'text-emerald-500' : 'text-red-500';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />Em Aberto
            </div>
            <p className="text-lg font-semibold">{formatCurrency(summary.total_open)}</p>
            <p className="text-xs text-muted-foreground">{summary.count_open} lançamento(s)</p>
          </div>
          <div className="rounded-lg bg-red-500/10 p-3">
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4" />Atrasadas
            </div>
            <p className="text-lg font-semibold text-red-500">{formatCurrency(summary.total_overdue)}</p>
            <p className="text-xs text-muted-foreground">{summary.count_overdue} lançamento(s)</p>
          </div>
        </div>
        <div className="rounded-lg bg-emerald-500/10 p-3">
          <div className="flex items-center gap-2 text-sm text-emerald-500">
            <CheckCircle className="h-4 w-4" />{type === 'receber' ? 'Recebido' : 'Pago'}
          </div>
          <p className="text-lg font-semibold text-emerald-500">{formatCurrency(summary.total_paid)}</p>
          <p className="text-xs text-muted-foreground">{summary.count_paid} lançamento(s)</p>
        </div>
        {summary.count_partial > 0 && (
          <p className="text-xs text-amber-500">{summary.count_partial} lançamento(s) com pagamento parcial</p>
        )}
      </CardContent>
    </Card>
  );
}

type GroupBy = 'category' | 'contact' | 'account' | 'type' | 'status';
type ChartKind = 'pie' | 'bar';
type ValueMode = 'value' | 'value_paid' | 'value_open';

const PALETTE = [
  '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#e11d48',
  '#a855f7', '#22c55e', '#eab308', '#0ea5e9',
];

function InteractiveBreakdown({ entries }: { entries: FinancialEntry[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pagar' | 'receber'>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [chartKind, setChartKind] = useState<ChartKind>('pie');
  const [valueMode, setValueMode] = useState<ValueMode>('value');

  const filteredList = useMemo(() => {
    const s = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (!s) return true;
      return (
        e.description?.toLowerCase().includes(s) ||
        e.category?.name?.toLowerCase().includes(s) ||
        e.contact?.name?.toLowerCase().includes(s)
      );
    });
  }, [entries, search, typeFilter]);

  const activeEntries = useMemo(() => {
    if (selected.size === 0) return filteredList;
    return filteredList.filter((e) => selected.has(e.id));
  }, [filteredList, selected]);

  const getValue = (e: FinancialEntry) => {
    if (valueMode === 'value_paid') return e.value_paid || 0;
    if (valueMode === 'value_open') return Math.max(0, (e.value || 0) - (e.value_paid || 0));
    return e.value || 0;
  };

  const groupKey = (e: FinancialEntry): string => {
    switch (groupBy) {
      case 'category': return e.category?.name || 'Sem categoria';
      case 'contact': return e.contact?.name || 'Sem contato';
      case 'account': return e.account?.name || 'Sem conta';
      case 'type': return e.type === 'pagar' ? 'A Pagar' : 'A Receber';
      case 'status': return getEntryStatus(e);
    }
  };

  const chartData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    for (const e of activeEntries) {
      const key = groupKey(e);
      const cur = map.get(key) || { name: key, value: 0, count: 0 };
      cur.value += getValue(e);
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [activeEntries, groupBy, valueMode]);

  const totalValue = chartData.reduce((s, d) => s + d.value, 0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === filteredList.length) setSelected(new Set());
    else setSelected(new Set(filteredList.map((e) => e.id)));
  };
  const allSelected = selected.size > 0 && selected.size === filteredList.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-primary" />
            Análise interativa de gastos
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {selected.size > 0 ? `${selected.size} selecionadas` : `${filteredList.length} lançamentos`}
            </Badge>
            <span className="text-sm font-semibold">{formatCurrency(totalValue)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="grid gap-2 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, categoria ou contato"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v: 'all' | 'pagar' | 'receber') => setTypeFilter(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="pagar">A Pagar</SelectItem>
              <SelectItem value="receber">A Receber</SelectItem>
            </SelectContent>
          </Select>
          <Select value={valueMode} onValueChange={(v: ValueMode) => setValueMode(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="value">Valor total</SelectItem>
              <SelectItem value="value_paid">Valor pago</SelectItem>
              <SelectItem value="value_open">Valor em aberto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <TabsList>
              <TabsTrigger value="category">Categoria</TabsTrigger>
              <TabsTrigger value="contact">Contato</TabsTrigger>
              <TabsTrigger value="account">Conta</TabsTrigger>
              <TabsTrigger value="type">Tipo</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-1">
            <Button size="sm" variant={chartKind === 'pie' ? 'default' : 'outline'} onClick={() => setChartKind('pie')}>
              <PieIcon className="h-4 w-4 mr-1" /> Pizza
            </Button>
            <Button size="sm" variant={chartKind === 'bar' ? 'default' : 'outline'} onClick={() => setChartKind('bar')}>
              <BarChart3 className="h-4 w-4 mr-1" /> Barras
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Chart */}
          <div className="rounded-lg border bg-muted/20 p-3 h-[340px]">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Sem dados para o filtro atual
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartKind === 'pie' ? (
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={110}
                      paddingAngle={2}
                      label={(e: { percent?: number }) =>
                        e.percent && e.percent > 0.04 ? `${(e.percent * 100).toFixed(0)}%` : ''
                      }
                    >
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, n: string) => [formatCurrency(v), n]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={60} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, { compact: true })} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>

          {/* Selectable list */}
          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b p-2">
              <Button size="sm" variant="ghost" onClick={toggleAll} className="gap-2">
                {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
              </Button>
              {selected.size > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Limpar seleção
                </Button>
              )}
            </div>
            <ScrollArea className="h-[290px]">
              <div className="divide-y">
                {filteredList.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">Nenhum lançamento</p>
                ) : (
                  filteredList.map((e) => {
                    const status = getEntryStatus(e);
                    const isSel = selected.has(e.id);
                    return (
                      <label
                        key={e.id}
                        className={`flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer ${isSel ? 'bg-primary/5' : ''}`}
                      >
                        <Checkbox checked={isSel} onCheckedChange={() => toggle(e.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{e.description}</span>
                            <Badge variant={e.type === 'receber' ? 'default' : 'destructive'} className="text-[10px] h-4">
                              {e.type === 'receber' ? 'R' : 'P'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                            <span>{format(parseISO(e.due_date), 'dd/MM/yyyy')}</span>
                            {e.category?.name && <span>· {e.category.name}</span>}
                            {e.contact?.name && <span>· {e.contact.name}</span>}
                            <span>· {status}</span>
                          </div>
                        </div>
                        <span className={`text-sm font-semibold ${e.type === 'receber' ? 'text-emerald-500' : 'text-red-500'}`}>
                          {formatCurrency(getValue(e))}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Breakdown table */}
        {chartData.length > 0 && (
          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b bg-muted/30 p-2 text-xs font-semibold text-muted-foreground">
              <span>Grupo</span>
              <span className="text-right">Qtd</span>
              <span className="text-right">Valor</span>
              <span className="text-right">%</span>
            </div>
            <div className="divide-y">
              {chartData.map((d, i) => (
                <div key={d.name} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 p-2 text-sm items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="truncate">{d.name}</span>
                  </div>
                  <span className="text-right text-xs text-muted-foreground">{d.count}</span>
                  <span className="text-right font-semibold">{formatCurrency(d.value)}</span>
                  <span className="text-right text-xs text-muted-foreground">
                    {totalValue > 0 ? `${((d.value / totalValue) * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FinancialDashboard() {
  const { getDashboardSummary, accounts, entries } = useFinancial();
  const summary = getDashboardSummary();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Total Entradas (Período)" value={summary.totalEntradas}
          icon={<TrendingUp className="h-6 w-6" />} variant="success" />
        <SummaryCard title="Total Saídas (Período)" value={summary.totalSaidas}
          icon={<TrendingDown className="h-6 w-6" />} variant="danger" />
        <SummaryCard title="Saldo do Período" value={summary.saldo}
          icon={<Wallet className="h-6 w-6" />} variant={summary.saldo >= 0 ? 'success' : 'danger'} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TypeSummary title="Contas a Receber" summary={summary.receber} type="receber" />
        <TypeSummary title="Contas a Pagar" summary={summary.pagar} type="pagar" />
      </div>

      <InteractiveBreakdown entries={entries} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-5 w-5" />Saldo por Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
                  </div>
                  <p className={`font-semibold ${account.current_balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {formatCurrency(account.current_balance)}
                  </p>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-3">
                <p className="font-medium">Total</p>
                <p className={`text-lg font-bold ${summary.totalAccountsBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatCurrency(summary.totalAccountsBalance)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
