import { useState, useMemo } from 'react';
import { DigitalVariation, DIGITAL_STATUS, PLATFORMS } from '@/hooks/useDigital';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScheduleCalendarProps {
  variations: DigitalVariation[];
  onSelectVariation: (variation: DigitalVariation) => void;
}

export function ScheduleCalendar({ variations, onSelectVariation }: ScheduleCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const scheduledVariations = useMemo(() => {
    return variations.filter(v => v.scheduled_date);
  }, [variations]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getVariationsForDay = (day: Date) => {
    return scheduledVariations.filter(v => {
      if (!v.scheduled_date) return false;
      return isSameDay(parseISO(v.scheduled_date), day);
    });
  };

  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="font-semibold text-lg capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Week Day Headers */}
        {weekDays.map(day => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}

        {/* Days */}
        {days.map((day, idx) => {
          const dayVariations = getVariationsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={idx}
              className={cn(
                'min-h-[60px] p-1 border rounded-md',
                isCurrentMonth ? 'bg-background' : 'bg-muted/30',
                isToday && 'ring-2 ring-primary'
              )}
            >
              <div className={cn(
                'text-xs font-medium mb-1',
                !isCurrentMonth && 'text-muted-foreground'
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayVariations.slice(0, 2).map(v => {
                  const platform = PLATFORMS[v.platform];
                  const status = DIGITAL_STATUS[v.status];
                  return (
                    <div
                      key={v.id}
                      className={cn(
                        'text-xs px-1 py-0.5 rounded truncate cursor-pointer',
                        'hover:opacity-80 transition-opacity',
                        status.color,
                        'text-white'
                      )}
                      onClick={() => onSelectVariation(v)}
                      title={`${platform?.label} - ${v.scheduled_time?.slice(0, 5) || ''}`}
                    >
                      {platform?.icon}
                    </div>
                  );
                })}
                {dayVariations.length > 2 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{dayVariations.length - 2}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming List */}
      <Card>
        <CardContent className="p-3">
          <h4 className="text-sm font-medium mb-2">Próximos Agendamentos</h4>
          {scheduledVariations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Nenhum agendamento
            </p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-auto">
              {scheduledVariations
                .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
                .slice(0, 5)
                .map(v => {
                  const platform = PLATFORMS[v.platform];
                  const status = DIGITAL_STATUS[v.status];
                  return (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted"
                      onClick={() => onSelectVariation(v)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{platform?.icon}</span>
                        <span className="text-sm">{platform?.label}</span>
                        <Badge
                          variant="secondary"
                          className={cn('text-xs', status.color, 'text-white')}
                        >
                          {status.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground tabular-nums">
                        {v.scheduled_date && format(parseISO(v.scheduled_date), 'dd/MM')}
                        {v.scheduled_time && ` ${v.scheduled_time.slice(0, 5)}`}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
