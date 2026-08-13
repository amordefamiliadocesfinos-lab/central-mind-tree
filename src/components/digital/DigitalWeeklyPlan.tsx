import { useMemo } from 'react';
import { endOfWeek, format, isWithinInterval, parseISO, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Check, Clock3, ExternalLink, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DIGITAL_STATUS, DigitalVariation } from '@/hooks/useDigital';

interface CampaignContext {
  idea_id: string;
  title: string;
  owner_name?: string | null;
}

interface WeekOccurrence {
  id: string;
  variation: DigitalVariation;
  date: string;
  time: string | null;
  isPosted: boolean;
  isAdditional: boolean;
}

interface DigitalWeeklyPlanProps {
  variations: DigitalVariation[];
  platforms: Array<{ id: string; name: string }>;
  ideas: Array<{ id: string; title: string }>;
  campaigns: CampaignContext[];
  onOpenVariation: (variation: DigitalVariation) => void;
}

const isValidDate = (value: string | null | undefined) => {
  if (!value) return false;
  return !Number.isNaN(parseISO(value).getTime());
};

export function DigitalWeeklyPlan({
  variations,
  platforms,
  ideas,
  campaigns,
  onOpenVariation,
}: DigitalWeeklyPlanProps) {
  const { weekStart, weekEnd, today, occurrencesByDay } = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    const interval = { start, end };
    const next: WeekOccurrence[] = [];

    variations.forEach((variation) => {
      if (isValidDate(variation.scheduled_date)) {
        const date = variation.scheduled_date!;
        if (isWithinInterval(parseISO(date), interval)) {
          next.push({
            id: `${variation.id}-principal`,
            variation,
            date,
            time: variation.scheduled_time || null,
            isPosted: Boolean(variation.is_posted),
            isAdditional: false,
          });
        }
      }

      (variation.additional_dates || []).forEach((additional, index) => {
        if (!isValidDate(additional.date)) return;
        if (isWithinInterval(parseISO(additional.date), interval)) {
          next.push({
            id: `${variation.id}-adicional-${index}`,
            variation,
            date: additional.date,
            time: additional.time || null,
            isPosted: Boolean(additional.posted),
            isAdditional: true,
          });
        }
      });
    });

    next.sort((a, b) => {
      const dateComparison = a.date.localeCompare(b.date);
      if (dateComparison !== 0) return dateComparison;
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

    const grouped = next.reduce<Record<string, WeekOccurrence[]>>((acc, occurrence) => {
      (acc[occurrence.date] ||= []).push(occurrence);
      return acc;
    }, {});

    return {
      weekStart: format(start, 'yyyy-MM-dd'),
      weekEnd: format(end, 'yyyy-MM-dd'),
      today: format(now, 'yyyy-MM-dd'),
      occurrencesByDay: grouped,
    };
  }, [variations]);

  const days = Object.keys(occurrencesByDay).sort();
  const getPlatformName = (platformId: string) => platforms.find((platform) => platform.id === platformId)?.name || platformId || 'Canal não definido';
  const getIdeaTitle = (ideaId: string) => ideas.find((idea) => idea.id === ideaId)?.title || 'Conteúdo';
  const getCampaign = (ideaId: string) => campaigns.find((campaign) => campaign.idea_id === ideaId);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">Visão Semanal Operacional</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(parseISO(weekStart), "dd 'de' MMM", { locale: ptBR })} a {format(parseISO(weekEnd), "dd 'de' MMM", { locale: ptBR })}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {days.length === 0 ? (
          <div className="rounded-lg border border-dashed py-7 px-4 text-center text-sm text-muted-foreground">
            Nenhuma publicação programada nesta semana.
          </div>
        ) : (
          days.map((date) => (
            <section key={date} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold capitalize">
                  {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </h3>
                {date === today && <Badge variant="secondary" className="text-[10px]">Hoje</Badge>}
              </div>
              <div className="space-y-2">
                {occurrencesByDay[date].map((occurrence) => {
                  const { variation } = occurrence;
                  const campaign = getCampaign(variation.idea_id);
                  const status = DIGITAL_STATUS[variation.status] || DIGITAL_STATUS.pendente;
                  const isLate = occurrence.date < today && !occurrence.isPosted;
                  const contentTitle = variation.title || getIdeaTitle(variation.idea_id);

                  return (
                    <div key={occurrence.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="inline-flex items-center gap-1 font-medium text-foreground">
                            <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                            {occurrence.time?.slice(0, 5) || 'Sem horário'}
                          </span>
                          <Badge variant="outline" className="text-[10px]">{getPlatformName(variation.platform)}</Badge>
                          {occurrence.isAdditional && <Badge variant="secondary" className="text-[10px]">Data adicional</Badge>}
                          {date === today && <Badge variant="secondary" className="text-[10px]">Hoje</Badge>}
                          {isLate && <Badge variant="destructive" className="text-[10px]">Atrasado</Badge>}
                        </div>
                        <p className="text-sm font-medium leading-snug">{contentTitle}</p>
                        {(campaign || occurrence.isPosted || variation.status) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {campaign && (
                              <span className="inline-flex items-center gap-1">
                                <Megaphone className="h-3 w-3" /> Campanha: {campaign.title}
                              </span>
                            )}
                            {campaign?.owner_name && <span>Responsável: {campaign.owner_name}</span>}
                            <span className="inline-flex items-center gap-1">
                              {occurrence.isPosted && <Check className="h-3 w-3 text-emerald-600" />}
                              {occurrence.isPosted ? 'Publicado' : 'Não publicado'} · {status.label}
                            </span>
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => onOpenVariation(variation)}>
                        Abrir <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}
