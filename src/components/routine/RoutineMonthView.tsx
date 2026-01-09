import { RoutineBlock, FOCUS_TYPES, FocusType } from '@/hooks/useRoutine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, isToday, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Flag, TrendingUp } from 'lucide-react';

interface RoutineMonthViewProps {
  selectedDate: Date;
  getBlocksByDay: (date: Date) => RoutineBlock[];
  getDayKPIs: (date: Date) => any;
  onSelectDate: (date: Date) => void;
  onChangeView: (view: 'day' | 'week') => void;
}

export function RoutineMonthView({
  selectedDate,
  getBlocksByDay,
  getDayKPIs,
  onSelectDate,
  onChangeView,
}: RoutineMonthViewProps) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Get the day of week for the first day (0 = Sunday, 1 = Monday, etc.)
  const startDayOfWeek = getDay(monthStart);
  // Adjust for Monday start (0 = Monday, 6 = Sunday)
  const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  
  // Create padding for days before the first of the month
  const paddingDays = Array(adjustedStartDay).fill(null);

  // Calculate monthly stats
  const monthStats = days.reduce((acc, day) => {
    const kpis = getDayKPIs(day);
    acc.totalPlanned += kpis.plannedMinutes;
    acc.totalDone += kpis.executedMinutes;
    acc.deepWorkDone += kpis.deepWorkDone;
    acc.daysWithBlocks += kpis.totalBlocks > 0 ? 1 : 0;
    acc.consistentDays += kpis.adherence >= 70 ? 1 : 0;
    return acc;
  }, {
    totalPlanned: 0,
    totalDone: 0,
    deepWorkDone: 0,
    daysWithBlocks: 0,
    consistentDays: 0,
  });

  const adherence = monthStats.totalPlanned > 0 
    ? Math.round((monthStats.totalDone / monthStats.totalPlanned) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Month Summary */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{monthStats.daysWithBlocks}</p>
              <p className="text-xs text-muted-foreground">dias planejados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{monthStats.consistentDays}</p>
              <p className="text-xs text-muted-foreground">dias consistentes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{adherence}%</p>
              <p className="text-xs text-muted-foreground">aderência</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{Math.round(monthStats.deepWorkDone / 60)}h</p>
              <p className="text-xs text-muted-foreground">trabalho profundo</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Padding for days before first of month */}
            {paddingDays.map((_, index) => (
              <div key={`padding-${index}`} className="aspect-square" />
            ))}

            {/* Actual days */}
            {days.map((day) => {
              const blocks = getBlocksByDay(day);
              const kpis = getDayKPIs(day);
              const today = isToday(day);
              const isSelected = isSameDay(day, selectedDate);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const hasDeepWork = blocks.some(b => b.focus === 'trabalho_profundo' && b.status === 'concluido');
              const allComplete = blocks.length > 0 && blocks.every(b => b.status === 'concluido' || b.status === 'pulado');

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'aspect-square p-1 rounded-lg cursor-pointer transition-all hover:bg-muted',
                    today && 'bg-primary/10 border border-primary',
                    isSelected && 'ring-2 ring-primary',
                    isWeekend && 'opacity-50'
                  )}
                  onClick={() => {
                    onSelectDate(day);
                    onChangeView('day');
                  }}
                >
                  <div className="h-full flex flex-col">
                    {/* Day number */}
                    <p className={cn(
                      'text-sm font-medium text-center',
                      today && 'text-primary font-bold'
                    )}>
                      {format(day, 'd')}
                    </p>

                    {/* Status indicators */}
                    <div className="flex-1 flex flex-col justify-center items-center gap-0.5">
                      {blocks.length > 0 ? (
                        <>
                          {/* Color dots for focus types */}
                          <div className="flex gap-0.5 flex-wrap justify-center">
                            {blocks.slice(0, 3).map((block) => {
                              const focusInfo = FOCUS_TYPES[block.focus as FocusType];
                              return (
                                <div
                                  key={block.id}
                                  className={cn(
                                    'w-2 h-2 rounded-full',
                                    focusInfo?.color || 'bg-gray-400',
                                    block.status !== 'concluido' && 'opacity-40'
                                  )}
                                />
                              );
                            })}
                          </div>
                          
                          {/* Completion badge */}
                          {allComplete && (
                            <div className="text-green-500 text-xs">✓</div>
                          )}
                          
                          {/* Deep work flag */}
                          {hasDeepWork && (
                            <Flag className="h-3 w-3 text-red-500" />
                          )}
                        </>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-muted" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">Legenda</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(FOCUS_TYPES).map(([key, info]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={cn('w-3 h-3 rounded-full', info.color)} />
                <span className="text-xs">{info.icon} {info.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Tendência de Consistência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1">
            {days.slice(-14).map((day) => {
              const kpis = getDayKPIs(day);
              const isGood = kpis.adherence >= 70;
              const hasPlan = kpis.totalBlocks > 0;
              
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'flex-1 h-8 rounded',
                    !hasPlan && 'bg-muted',
                    hasPlan && isGood && 'bg-green-500',
                    hasPlan && !isGood && 'bg-amber-500'
                  )}
                  title={`${format(day, 'dd/MM')}: ${kpis.adherence}%`}
                />
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Últimos 14 dias
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
