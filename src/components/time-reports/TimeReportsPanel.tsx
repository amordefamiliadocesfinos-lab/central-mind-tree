import { useState, useEffect } from 'react';
import { Clock, Calendar, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTimeTracking, TimeStats } from '@/hooks/useTimeTracking';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, LineChart, Line } from 'recharts';

interface Node {
  id: string;
  title: string;
  color: string;
}

interface Task {
  id: string;
  title: string;
  node_id: string;
}

export function TimeReportsPanel() {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [stats, setStats] = useState<TimeStats | null>(null);
  const [nodes, setNodes] = useState<Record<string, Node>>({});
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [loading, setLoading] = useState(true);
  const { getTimeStats, formatDuration } = useTimeTracking();

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Calculate date range
      let startDate: Date | undefined;
      const now = new Date();

      if (period === 'week') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
      } else if (period === 'month') {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
      }

      // Fetch stats and metadata
      const [statsData, nodesResult, tasksResult] = await Promise.all([
        getTimeStats(startDate),
        supabase.from('nodes').select('id, title, color'),
        supabase.from('tasks').select('id, title, node_id'),
      ]);

      setStats(statsData);

      if (nodesResult.data) {
        const nodesMap: Record<string, Node> = {};
        nodesResult.data.forEach(n => { nodesMap[n.id] = n; });
        setNodes(nodesMap);
      }

      if (tasksResult.data) {
        const tasksMap: Record<string, Task> = {};
        tasksResult.data.forEach(t => { tasksMap[t.id] = t; });
        setTasks(tasksMap);
      }
    } catch (error) {
      console.error('Error loading time data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum dado de tempo disponível
      </div>
    );
  }

  // Prepare chart data
  const dailyData = Object.entries(stats.byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, seconds]) => ({
      date: new Date(date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
      hours: Math.round((seconds / 3600) * 10) / 10,
      seconds,
    }));

  const nodeData = Object.entries(stats.byNode)
    .map(([nodeId, seconds]) => ({
      name: nodes[nodeId]?.title || 'Sem projeto',
      value: seconds,
      color: nodes[nodeId]?.color || '#6b7280',
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const topTasks = Object.entries(stats.byTask)
    .map(([taskId, seconds]) => ({
      id: taskId,
      name: tasks[taskId]?.title || 'Tarefa desconhecida',
      seconds,
      nodeId: tasks[taskId]?.node_id,
    }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);

  // Calculate averages
  const daysWithData = Object.keys(stats.byDay).length || 1;
  const avgSecondsPerDay = stats.totalSeconds / daysWithData;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Relatório de Tempo
        </h2>
        <Select value={period} onValueChange={(v) => setPeriod(v as 'week' | 'month' | 'all')}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Última semana</SelectItem>
            <SelectItem value="month">Último mês</SelectItem>
            <SelectItem value="all">Todo período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{formatDuration(stats.totalSeconds)}</div>
            <p className="text-xs text-muted-foreground">Total registrado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{formatDuration(Math.round(avgSecondsPerDay))}</div>
            <p className="text-xs text-muted-foreground">Média por dia</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{Object.keys(stats.byTask).length}</div>
            <p className="text-xs text-muted-foreground">Tarefas trabalhadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{Object.keys(stats.byNode).length}</div>
            <p className="text-xs text-muted-foreground">Projetos ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily" className="text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Diário</span>
          </TabsTrigger>
          <TabsTrigger value="projects" className="text-xs sm:text-sm">
            <PieChart className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Projetos</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Tarefas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Horas por Dia</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => [`${value}h`, 'Horas']}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado para exibir
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tempo por Projeto</CardTitle>
            </CardHeader>
            <CardContent>
              {nodeData.length > 0 ? (
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPie>
                      <Pie
                        data={nodeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {nodeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [formatDuration(value), 'Tempo']}
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="space-y-2 min-w-[150px]">
                    {nodeData.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate flex-1">{item.name}</span>
                        <span className="text-muted-foreground">{formatDuration(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado para exibir
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Top 5 Tarefas (mais tempo)</CardTitle>
            </CardHeader>
            <CardContent>
              {topTasks.length > 0 ? (
                <div className="space-y-3">
                  {topTasks.map((task, index) => {
                    const node = task.nodeId ? nodes[task.nodeId] : null;
                    const maxSeconds = topTasks[0].seconds;
                    const percentage = (task.seconds / maxSeconds) * 100;
                    
                    return (
                      <div key={task.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 truncate flex-1">
                            <span className="text-muted-foreground">#{index + 1}</span>
                            <span className="truncate">{task.name}</span>
                            {node && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: node.color + '20', color: node.color }}
                              >
                                {node.title}
                              </span>
                            )}
                          </div>
                          <span className="font-medium ml-2">{formatDuration(task.seconds)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado para exibir
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Insights */}
      {stats.totalSeconds > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {avgSecondsPerDay < 3600 && (
              <p>📊 Média diária abaixo de 1h. Considere usar o modo Foco para aumentar a produtividade.</p>
            )}
            {topTasks.length > 0 && topTasks[0].seconds > stats.totalSeconds * 0.5 && (
              <p>⚠️ Mais de 50% do tempo está em uma única tarefa. Considere dividi-la em subtarefas.</p>
            )}
            {nodeData.length === 1 && (
              <p>💡 Todo o tempo está em um único projeto. Revise se há outras prioridades.</p>
            )}
            {Object.keys(stats.byDay).length >= 5 && avgSecondsPerDay >= 3600 && (
              <p>✅ Ótimo ritmo! Você está mantendo consistência nos últimos dias.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
