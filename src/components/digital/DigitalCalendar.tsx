import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PlatformIcon } from './PlatformsManager';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DigitalVariation, DIGITAL_STATUS } from '@/hooks/useDigital';

interface DigitalCalendarProps {
  variations: DigitalVariation[];
  onSelectVariation: (variation: DigitalVariation) => void;
  platforms: Array<{ id: string; name: string; icon: string }>;
  ideas?: Array<{ id: string; title: string }>;
}

// Gera sigla legível a partir do nome da plataforma
function getPlatformAbbreviation(name: string): string {
  const abbreviations: Record<string, string> = {
    'instagram': 'IG',
    'instagram feed': 'IG',
    'instagram stories': 'IGS',
    'instagram reels': 'IGR',
    'facebook': 'FB',
    'facebook feed': 'FB',
    'facebook stories': 'FBS',
    'tiktok': 'TT',
    'youtube': 'YT',
    'youtube shorts': 'YTS',
    'twitter': 'TW',
    'x': 'X',
    'linkedin': 'LI',
    'pinterest': 'PIN',
    'whatsapp': 'WA',
    'telegram': 'TG',
    'olx': 'OLX',
    'mercado livre': 'ML',
    'shopee': 'SHP',
    'amazon': 'AMZ',
    'nuvemshop': 'NUV',
    'magalu': 'MAG',
    'americanas': 'AME',
    'etsy': 'ETSY',
    'aliexpress': 'ALI',
  };
  
  const lowerName = name.toLowerCase();
  if (abbreviations[lowerName]) {
    return abbreviations[lowerName];
  }
  
  // Gera sigla automática: primeiras 3 letras ou iniciais de palavras
  const words = name.split(/\s+/);
  if (words.length > 1) {
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
  }
  return name.slice(0, 3).toUpperCase();
}

export function DigitalCalendar({ variations, onSelectVariation, platforms, ideas = [] }: DigitalCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const scheduledVariations = useMemo(() => {
    return variations.filter(v => v.scheduled_date || (v.additional_dates && v.additional_dates.length > 0));
  }, [variations]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getVariationsForDay = (day: Date) => {
    const result: Array<DigitalVariation & { _displayTime?: string }> = [];
    const seen = new Set<string>();
    
    scheduledVariations.forEach(v => {
      if (v.scheduled_date && isSameDay(parseISO(v.scheduled_date), day)) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          result.push({ ...v, _displayTime: v.scheduled_time?.slice(0, 5) || '' });
        }
      }
      (v.additional_dates || []).forEach(ad => {
        if (ad.date && isSameDay(parseISO(ad.date), day) && !seen.has(v.id + ad.date)) {
          seen.add(v.id + ad.date);
          result.push({ ...v, _displayTime: ad.time?.slice(0, 5) || '' });
        }
      });
    });
    
    return result;
  };

  const getPlatformInfo = (platformId: string) => {
    return platforms.find(p => p.id === platformId) || { id: platformId, name: platformId, icon: '📱' };
  };

  const getIdeaTitle = (ideaId: string) => {
    const idea = ideas.find(i => i.id === ideaId);
    return idea?.title || 'Conteúdo';
  };

  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Group by date for the list view
  const upcomingByDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return scheduledVariations
      .filter(v => v.scheduled_date && parseISO(v.scheduled_date) >= today)
      .sort((a, b) => {
        const dateCompare = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
      })
      .slice(0, 10);
  }, [scheduledVariations]);

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
                'min-h-[70px] p-1 border rounded-md transition-colors',
                isCurrentMonth ? 'bg-background' : 'bg-muted/30',
                isToday && 'ring-2 ring-primary',
                dayVariations.length > 0 && 'hover:bg-muted/50 cursor-pointer'
              )}
              onClick={() => {
                if (dayVariations.length === 1) {
                  onSelectVariation(dayVariations[0]);
                }
              }}
            >
              <div className={cn(
                'text-xs font-medium mb-1',
                !isCurrentMonth && 'text-muted-foreground'
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayVariations.slice(0, 3).map(v => {
                  const platform = getPlatformInfo(v.platform);
                  const status = DIGITAL_STATUS[v.status] || DIGITAL_STATUS.pendente;
                  const abbr = getPlatformAbbreviation(platform.name);
                  const time = (v as any)._displayTime || v.scheduled_time?.slice(0, 5) || '';
                  const ideaTitle = getIdeaTitle(v.idea_id);
                  const displayTitle = v.title || ideaTitle;
                  
                  return (
                    <div
                      key={v.id}
                      className={cn(
                        'text-[10px] px-1 py-0.5 rounded cursor-pointer',
                        'hover:opacity-80 transition-opacity',
                        status.color,
                        'text-white'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVariation(v);
                      }}
                      title={`${platform.name} - ${time} - ${displayTitle}`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="font-bold shrink-0">{abbr}</span>
                        <span className="shrink-0">{time}</span>
                      </div>
                      <div className="truncate text-[9px] opacity-90 hidden sm:block">
                        {displayTitle}
                      </div>
                    </div>
                  );
                })}
                {dayVariations.length > 3 && (
                  <div className="text-[10px] text-muted-foreground text-center">
                    +{dayVariations.length - 3}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap gap-2 justify-center">
        {Object.entries(DIGITAL_STATUS).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            <div className={cn('w-2.5 h-2.5 rounded-full', config.color)} />
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Upcoming List */}
      <Card>
        <CardContent className="p-3">
          <h4 className="text-sm font-medium mb-3">Próximos Agendamentos</h4>
          {upcomingByDate.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum conteúdo agendado
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {upcomingByDate.map(v => {
                const platform = getPlatformInfo(v.platform);
                const status = DIGITAL_STATUS[v.status] || DIGITAL_STATUS.pendente;
                const abbr = getPlatformAbbreviation(platform.name);
                const ideaTitle = getIdeaTitle(v.idea_id);
                const displayTitle = v.title || ideaTitle;
                
                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => onSelectVariation(v)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0"><PlatformIcon icon={platform.icon} size="md" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold bg-muted px-1.5 py-0.5 rounded shrink-0">{abbr}</span>
                          <span className="text-sm font-medium truncate">{displayTitle}</span>
                        </div>
                        <span className="text-xs text-muted-foreground block truncate">{platform.name}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn('text-xs shrink-0', status.color, 'text-white')}
                      >
                        {status.label}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground tabular-nums shrink-0 ml-2">
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
