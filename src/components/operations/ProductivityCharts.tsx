import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { ProductionLog, PROCESS_LABELS } from '@/hooks/useProductionLogs';

interface ProductivityChartsProps {
  logs: ProductionLog[];
  selectedDate: string;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(142 76% 36%)',
  'hsl(221 83% 53%)',
  'hsl(280 65% 60%)',
];

export function ProductivityCharts({ logs, selectedDate }: ProductivityChartsProps) {
  // Data by employee
  const employeeData = useMemo(() => {
    const grouped: Record<string, number> = {};
    logs.forEach(log => {
      grouped[log.employee_name] = (grouped[log.employee_name] || 0) + log.quantity;
    });
    return Object.entries(grouped)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [logs]);

  // Data by process
  const processData = useMemo(() => {
    const grouped: Record<string, number> = {};
    logs.forEach(log => {
      const processLabel = PROCESS_LABELS[log.process] || log.process;
      grouped[processLabel] = (grouped[processLabel] || 0) + log.quantity;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [logs]);

  if (logs.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Bar Chart - By Employee */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Produção por Funcionário</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  width={80}
                  tickFormatter={(value) => value.length > 10 ? `${value.slice(0, 10)}...` : value}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value} un`, 'Quantidade']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar 
                  dataKey="quantity" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pie Chart - By Process */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Produção por Processo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={processData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {processData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value} un`, 'Quantidade']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
