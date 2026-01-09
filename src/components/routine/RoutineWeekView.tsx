import { RoutineBlock, FOCUS_TYPES, FocusType } from '@/hooks/useRoutine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { format, isToday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Target, TrendingUp, CheckCircle2, Plus } from 'lucide-react';

interface RoutineWeekViewProps {
  days: Date[];
  getBlocksByDay: (date: Date) => RoutineBlock[];
  getDayKPIs: (date: Date) => any;
  weekSummary: {
    byFocus: Record<FocusType, { planned: number; done: number }>;
    totalPlanned: number;
    totalDone: number;
    adherence: number;
    consistentDays: number;
    totalDays: number;
  };
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onAutoPlanWeek: () => void;
  capacityTargets: { deep_work_min: number; atendimento_min: number };
}

export function RoutineWeekView({
  days,
  getBlocksByDay,
  getDayKPIs,
  weekSummary,
  selectedDate,
  onSelectDate,
  onAutoPlanWeek,
  capacityTargets,
}: RoutineWeekViewProps) {
  const weekDays = days.filter(d => d.getDay() !== 0 && d.getDay() !== 6); // Mon-Fri

  return (
    <div className="space-y-4">
      {/* Week Summary */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Resumo da Semana
            </CardTitle>
            <Button size="sm" onClick={onAutoPlanWeek}>
              <Plus className="h-3 w-3 mr-1" /> Gerar Semana
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center mb-4">
            <div>
              <p className="text-2xl font-bold">{weekSummary.totalDone}</p>
              <p className="text-xs text-muted-foreground">/{weekSummary.totalPlanned} min</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{weekSummary.adherence}%</p>
              <p className="text-xs text-muted-foreground">aderência</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{weekSummary.consistentDays}</p>
              <p className="text-xs text-muted-foreground">/{weekSummary.totalDays} dias ok</p>
            </div>
            <div className="flex items-center justify-center">
              {weekSummary.adherence >= 70 ? (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingUp className="h-8 w-8 text-amber-500" />
              )}
            </div>
          </div>

          {/* Focus Summary */}
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(weekSummary.byFocus).map(([focus, data]) => {
              const focusInfo = FOCUS_TYPES[focus as FocusType];
              if (!focusInfo || data.planned === 0) return null;
              const pct = data.planned > 0 ? Math.round((data.done / data.planned) * 100) : 0;
              
              return (
                <div key={focus} className="text-center p-2 rounded-lg bg-background/50">
                  <span className="text-lg">{focusInfo.icon}</span>
                  <p className="text-xs font-medium mt-1">{focusInfo.label}</p>
                  <p className="text-sm font-bold">{data.done}/{data.planned}min</p>
                  <Progress value={pct} className="h-1 mt-1" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Days Grid */}
      <div className="grid grid-cols-5 gap-2">
        {weekDays.map((day) => {
          const blocks = getBlocksByDay(day);
          const kpis = getDayKPIs(day);
          const isSelected = isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <Card
              key={day.toISOString()}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                isSelected && 'ring-2 ring-primary',
                today && 'border-primary'
              )}
              onClick={() => onSelectDate(day)}
            >
              <CardContent className="p-3">
                <div className="text-center mb-2">
                  <p className={cn(
                    'text-xs font-medium uppercase',
                    today && 'text-primary'
                  )}>
                    {format(day, 'EEE', { locale: ptBR })}
                  </p>
                  <p className={cn(
                    'text-lg font-bold',
                    today && 'text-primary'
                  )}>
                    {format(day, 'd')}
                  </p>
                </div>

                {blocks.length > 0 ? (
                  <>
                    <div className="space-y-1 mb-2">
                      {blocks.slice(0, 4).map((block) => {
                        const focusInfo = FOCUS_TYPES[block.focus as FocusType];
                        return (
                          <div
                            key={block.id}
                            className={cn(
                              'h-1.5 rounded-full',
                              focusInfo?.color || 'bg-gray-400',
                              block.status === 'concluido' && 'opacity-100',
                              block.status === 'pulado' && 'opacity-30',
                              block.status === 'pendente' && 'opacity-50'
                            )}
                          />
                        );
                      })}
                      {blocks.length > 4 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{blocks.length - 4}
                        </p>
                      )}
                    </div>

                    <div className="text-center">
                      <Badge 
                        variant={kpis.adherence >= 70 ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {kpis.completed}/{kpis.totalBlocks}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Sem blocos
                  </p>
                )}

                {/* Capacity indicators */}
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <div className="text-center">
                    <p className={cn(
                      'text-xs font-bold',
                      kpis.deepWorkDone >= capacityTargets.deep_work_min / 5 
                        ? 'text-green-600' 
                        : 'text-muted-foreground'
                    )}>
                      🔥 {kpis.deepWorkDone}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      'text-xs font-bold',
                      kpis.atendimentoDone >= capacityTargets.atendimento_min / 5
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                    )}>
                      📞 {kpis.atendimentoDone}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Capacity vs Target */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4" />
            Metas Semanais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>🔥 Trabalho Profundo</span>
                <span className="font-bold">
                  {weekSummary.byFocus.trabalho_profundo?.done || 0} / {capacityTargets.deep_work_min * 5}min
                </span>
              </div>
              <Progress 
                value={((weekSummary.byFocus.trabalho_profundo?.done || 0) / (capacityTargets.deep_work_min * 5)) * 100} 
                className="h-2" 
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>📞 Atendimento</span>
                <span className="font-bold">
                  {weekSummary.byFocus.atendimento?.done || 0} / {capacityTargets.atendimento_min * 5}min
                </span>
              </div>
              <Progress 
                value={((weekSummary.byFocus.atendimento?.done || 0) / (capacityTargets.atendimento_min * 5)) * 100} 
                className="h-2" 
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
