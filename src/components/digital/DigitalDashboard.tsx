import { useMemo } from 'react';
import { Lightbulb, Layers, CalendarClock, CheckCircle2, Clock, Send, Image as ImageIcon } from 'lucide-react';
import { parseISO, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { DIGITAL_STATUS, type DigitalIdea } from '@/hooks/useDigital';
import { cn } from '@/lib/utils';

interface DigitalDashboardProps {
  ideas: DigitalIdea[];
}

interface Stat {
  key: string;
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}

export function DigitalDashboard({ ideas }: DigitalDashboardProps) {
  const data = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let totalVariations = 0;
    let publishedVariations = 0;
    let scheduledWeek = 0;
    let scheduledMonth = 0;
    let mediaCount = 0;
    const statusCounts: Record<string, number> = {};

    ideas.forEach((idea) => {
      statusCounts[idea.status] = (statusCounts[idea.status] || 0) + 1;
      (idea.variations || []).forEach((v) => {
        totalVariations += 1;
        if (v.status === 'concluido') publishedVariations += 1;
        mediaCount += (v.media_urls?.length || 0);
        const dates: string[] = [];
        if (v.scheduled_date) dates.push(v.scheduled_date);
        (v.additional_dates || []).forEach((ad: any) => ad?.date && dates.push(ad.date));
        dates.forEach((d) => {
          try {
            const dt = parseISO(d);
            if (isWithinInterval(dt, { start: weekStart, end: weekEnd })) scheduledWeek += 1;
            if (isWithinInterval(dt, { start: monthStart, end: monthEnd })) scheduledMonth += 1;
          } catch {
            // ignore
          }
        });
      });
    });

    return {
      totalIdeas: ideas.length,
      totalVariations,
      publishedVariations,
      scheduledWeek,
      scheduledMonth,
      mediaCount,
      inProduction: statusCounts['andamento'] || 0,
      completionRate: totalVariations
        ? Math.round((publishedVariations / totalVariations) * 100)
        : 0,
    };
  }, [ideas]);

  const stats: Stat[] = [
    { key: 'ideas', label: 'Ideias', value: data.totalIdeas, icon: Lightbulb, tone: 'text-amber-500' },
    { key: 'vars', label: 'Variações', value: data.totalVariations, icon: Layers, tone: 'text-primary' },
    { key: 'week', label: 'Semana', value: data.scheduledWeek, icon: CalendarClock, tone: 'text-blue-500' },
    { key: 'month', label: 'Mês', value: data.scheduledMonth, icon: CalendarClock, tone: 'text-indigo-500' },
    { key: 'prod', label: 'Andamento', value: data.inProduction, icon: Clock, tone: 'text-orange-500' },
    { key: 'pub', label: 'Concluídas', value: data.publishedVariations, icon: Send, tone: 'text-emerald-500' },
    { key: 'rate', label: 'Conclusão', value: `${data.completionRate}%`, icon: CheckCircle2, tone: 'text-emerald-600' },
    { key: 'media', label: 'Mídias', value: data.mediaCount, icon: ImageIcon, tone: 'text-purple-500' },
  ];

  return (
    <div className="px-4 pb-2">
      <div
        className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1"
        role="list"
        aria-label="Resumo Digital"
      >
        {stats.map(({ key, label, value, icon: Icon, tone }) => (
          <div
            key={key}
            role="listitem"
            className={cn(
              'shrink-0 flex items-center gap-2 rounded-lg border bg-card/60 backdrop-blur',
              'px-2.5 py-1.5 min-w-[88px]'
            )}
          >
            <Icon className={cn('h-3.5 w-3.5 shrink-0', tone)} />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tabular-nums">{value}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
