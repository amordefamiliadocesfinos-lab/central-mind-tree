import { useMemo } from 'react';
import { DigitalVariation } from '@/hooks/useDigital';
import { Platform } from '@/hooks/usePlatforms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, Eye, MousePointer, Users } from 'lucide-react';

interface MetricsChartProps {
  variations: (DigitalVariation & { ideaTitle: string })[];
  platforms?: Platform[];
}

export function MetricsChart({ variations, platforms = [] }: MetricsChartProps) {
  // Filter variations with metrics and scheduled dates
  const variationsWithMetrics = useMemo(() => {
    return variations
      .filter(v => v.scheduled_date && (v.metric_reach || v.metric_engagement || v.metric_clicks))
      .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''));
  }, [variations]);

  // Aggregate by date
  const chartData = useMemo(() => {
    const dataByDate: Record<string, { date: string; reach: number; engagement: number; clicks: number; count: number }> = {};

    variationsWithMetrics.forEach(v => {
      const date = v.scheduled_date!;
      if (!dataByDate[date]) {
        dataByDate[date] = { date, reach: 0, engagement: 0, clicks: 0, count: 0 };
      }
      dataByDate[date].reach += v.metric_reach || 0;
      dataByDate[date].engagement += v.metric_engagement || 0;
      dataByDate[date].clicks += v.metric_clicks || 0;
      dataByDate[date].count += 1;
    });

    return Object.values(dataByDate).map(d => ({
      ...d,
      dateFormatted: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
    }));
  }, [variationsWithMetrics]);

  // Calculate totals
  const totals = useMemo(() => ({
    reach: variationsWithMetrics.reduce((acc, v) => acc + (v.metric_reach || 0), 0),
    engagement: variationsWithMetrics.reduce((acc, v) => acc + (v.metric_engagement || 0), 0),
    clicks: variationsWithMetrics.reduce((acc, v) => acc + (v.metric_clicks || 0), 0),
    posts: variationsWithMetrics.length,
  }), [variationsWithMetrics]);

  // Calculate averages
  const averages = useMemo(() => {
    const count = variationsWithMetrics.length || 1;
    return {
      reach: Math.round(totals.reach / count),
      engagement: Math.round(totals.engagement / count),
      clicks: Math.round(totals.clicks / count),
      engagementRate: totals.reach > 0 ? ((totals.engagement / totals.reach) * 100).toFixed(2) : '0',
      ctr: totals.reach > 0 ? ((totals.clicks / totals.reach) * 100).toFixed(2) : '0',
    };
  }, [totals, variationsWithMetrics.length]);

  if (variationsWithMetrics.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhuma métrica registrada ainda.</p>
          <p className="text-xs mt-1">Adicione métricas às variações publicadas para ver gráficos.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-xs">Alcance Total</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{totals.reach.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">Média: {averages.reach.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">Engajamento</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{totals.engagement.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">Taxa: {averages.engagementRate}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MousePointer className="h-4 w-4" />
              <span className="text-xs">Cliques</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{totals.clicks.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">CTR: {averages.ctr}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Posts</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{totals.posts}</p>
            <p className="text-xs text-muted-foreground">Com métricas</p>
          </CardContent>
        </Card>
      </div>

      {/* Line Chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Evolução de Alcance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="dateFormatted" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="reach"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                    name="Alcance"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Engajamento por Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="dateFormatted" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="engagement" fill="hsl(var(--primary))" name="Engajamento" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
