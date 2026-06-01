import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MobileHeader } from '@/components/ui/mobile-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Target,
  TrendingUp,
  Users,
  Package,
  DollarSign,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Calendar,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

type GoalType = 'faturamento' | 'producao' | 'lucro' | 'novos_clientes';

interface MonthlyGoal {
  id: string;
  year: number;
  month: number;
  goal_type: GoalType;
  target_value: number;
  achieved_value: number;
}

const GOAL_CONFIG: Record<GoalType, { label: string; icon: React.ElementType; color: string; unit: string }> = {
  faturamento: { label: 'Faturamento', icon: DollarSign, color: 'text-emerald-500', unit: 'R$' },
  producao: { label: 'Produção', icon: Package, color: 'text-blue-500', unit: 'un' },
  lucro: { label: 'Lucro', icon: TrendingUp, color: 'text-purple-500', unit: 'R$' },
  novos_clientes: { label: 'Novos Clientes', icon: Users, color: 'text-amber-500', unit: 'cli' },
};

export default function Metas() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newGoalType, setNewGoalType] = useState<GoalType>('faturamento');
  const [newTarget, setNewTarget] = useState('');

  const monthLabel = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth - 1, 1);
    return format(d, "MMMM 'de' yyyy", { locale: ptBR });
  }, [selectedYear, selectedMonth]);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('monthly_goals')
      .select('id, year, month, goal_type, target_value, achieved_value')
      .eq('year', selectedYear)
      .eq('month', selectedMonth);

    if (!error && data) {
      setGoals(data as unknown as MonthlyGoal[]);
    }
    setLoading(false);
  }, [selectedYear, selectedMonth]);

  // Auto-calculate achieved values from real data
  const fetchRealData = useCallback(async () => {
    const monthStart = format(startOfMonth(new Date(selectedYear, selectedMonth - 1, 1)), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date(selectedYear, selectedMonth - 1, 1)), 'yyyy-MM-dd');

    const [
      ordersResult,
      contactsResult,
      entriesResult,
      productionResult,
    ] = await Promise.all([
      supabase.from('orders').select('total_value').gte('order_date', monthStart).lte('order_date', monthEnd).is('deleted_at', null),
      supabase.from('contacts').select('id').gte('created_at', monthStart).lte('created_at', monthEnd),
      supabase.from('financial_entries').select('value, type').eq('type', 'receber').gte('created_at', monthStart).lte('created_at', monthEnd),
      supabase.from('orders').select('id').eq('status', 'producao').is('deleted_at', null),
    ]);

    const orders = ordersResult.data || [];
    const contacts = contactsResult.data || [];
    const entries = entriesResult.data || [];
    const production = productionResult.data || [];

    const faturamento = orders.reduce((sum, o) => sum + (o.total_value || 0), 0);
    const lucro = entries.reduce((sum, e) => sum + (e.value || 0), 0) * 0.25;
    const novosClientes = contacts.length;
    const producaoCount = production.length;

    const updated = await Promise.all(
      goals.map(async (g) => {
        let achieved = 0;
        if (g.goal_type === 'faturamento') achieved = faturamento;
        else if (g.goal_type === 'lucro') achieved = lucro;
        else if (g.goal_type === 'novos_clientes') achieved = novosClientes;
        else if (g.goal_type === 'producao') achieved = producaoCount;

        if (g.achieved_value !== achieved) {
          await supabase.from('monthly_goals').update({ achieved_value: achieved }).eq('id', g.id);
        }
        return { ...g, achieved_value: achieved };
      })
    );

    setGoals(updated);
  }, [selectedYear, selectedMonth, goals]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    if (goals.length > 0) {
      fetchRealData();
    }
  }, [goals.length, fetchRealData]);

  const handleAdd = async () => {
    const target = parseFloat(newTarget);
    if (!target || target <= 0) {
      toast({ title: 'Informe um valor válido para a meta', variant: 'destructive' });
      return;
    }

    const payload = {
      year: selectedYear,
      month: selectedMonth,
      goal_type: newGoalType,
      target_value: target,
      achieved_value: 0,
    };

    const { error } = await supabase.from('monthly_goals').insert(payload as any);

    if (error) {
      toast({ title: 'Erro ao criar meta', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Meta criada!' });
      setShowAdd(false);
      setNewTarget('');
      fetchGoals();
    }
  };

  const handleUpdateTarget = async (id: string) => {
    const target = parseFloat(editTarget);
    if (!target || target <= 0) return;

    const { error } = await supabase
      .from('monthly_goals')
      .update({ target_value: target } as any)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    } else {
      toast({ title: 'Meta atualizada!' });
      setEditingId(null);
      fetchGoals();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('monthly_goals').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } else {
      toast({ title: 'Meta removida' });
      fetchGoals();
    }
  };

  const percent = (target: number, achieved: number) => {
    if (target <= 0) return 0;
    return Math.min(100, Math.round((achieved / target) * 100));
  };

  const formatValue = (type: GoalType, value: number) => {
    if (type === 'faturamento' || type === 'lucro') return formatCurrency(value);
    return Math.round(value).toLocaleString('pt-BR');
  };

  const missingTypes = (['faturamento', 'producao', 'lucro', 'novos_clientes'] as GoalType[]).filter(
    (t) => !goals.find((g) => g.goal_type === t)
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader title="Metas" />

      <div className="container mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Metas Mensais
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {monthLabel}
            </p>
          </div>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Meta
          </Button>
        </div>

        {/* Month/Year selector */}
        <div className="flex gap-2">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {format(new Date(2024, i, 1), 'MMMM', { locale: ptBR })}
              </option>
            ))}
          </select>
          <Input
            type="number"
            className="w-24"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
          />
        </div>

        {/* Add goal form */}
        {showAdd && (
          <Card className="border-dashed border-primary/30">
            <CardContent className="pt-4 space-y-3">
              <Label>Nova Meta</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm flex-1"
                  value={newGoalType}
                  onChange={(e) => setNewGoalType(e.target.value as GoalType)}
                >
                  {missingTypes.map((t) => (
                    <option key={t} value={t}>{GOAL_CONFIG[t].label}</option>
                  ))}
                  {missingTypes.length === 0 && (
                    <option value="">Todos os tipos já cadastrados</option>
                  )}
                </select>
                <Input
                  type="number"
                  placeholder="Valor da meta"
                  className="flex-1"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                />
                <div className="flex gap-1">
                  <Button size="sm" onClick={handleAdd} disabled={missingTypes.length === 0 || !newTarget}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewTarget(''); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Goals list */}
        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : goals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Nenhuma meta cadastrada para este mês.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Criar primeira meta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
            {goals.map((goal) => {
              const config = GOAL_CONFIG[goal.goal_type];
              const Icon = config.icon;
              const pct = percent(goal.target_value, goal.achieved_value);
              const isComplete = pct >= 100;

              return (
                <Card key={goal.id} className={cn('relative overflow-hidden', isComplete && 'border-emerald-500/30')}>
                  {isComplete && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-bl-lg font-medium">
                      Concluído
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Icon className={cn('h-5 w-5', config.color)} />
                        {config.label}
                      </span>
                      <div className="flex gap-1">
                        {editingId === goal.id ? (
                          <>
                            <Input
                              type="number"
                              className="w-24 h-7 text-sm"
                              value={editTarget}
                              autoFocus
                              onChange={(e) => setEditTarget(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdateTarget(goal.id)}
                            />
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleUpdateTarget(goal.id)}>
                              <Check className="h-4 w-4 text-emerald-500" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setEditingId(goal.id);
                                setEditTarget(goal.target_value.toString());
                              }}
                            >
                              <Edit3 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => handleDelete(goal.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Meta</p>
                        <p className="font-semibold">{formatValue(goal.goal_type, goal.target_value)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Realizado</p>
                        <p className={cn('font-semibold', isComplete ? 'text-emerald-500' : 'text-foreground')}>
                          {formatValue(goal.goal_type, goal.achieved_value)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className={cn('font-bold', pct >= 100 ? 'text-emerald-500' : pct >= 70 ? 'text-amber-500' : 'text-red-500')}>
                          {pct}%
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className={cn(
                          'h-3',
                          pct >= 100 ? '[&>div]:bg-emerald-500' : pct >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
