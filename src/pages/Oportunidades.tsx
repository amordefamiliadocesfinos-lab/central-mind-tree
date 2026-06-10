import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSeasonalDays } from '@/hooks/useSeasonalDays';
import { useDigital } from '@/hooks/useDigital';
import { supabase } from '@/integrations/supabase/client';
import { formatDisplayDate, getNowSaoPaulo, getTodayISO } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { Calendar, Megaphone, FileText, X, Sparkles, ArrowLeft } from 'lucide-react';

type Priority = 'alta' | 'media' | 'baixa';
type OppKind = 'create_campaign' | 'create_content' | 'plan_more_content';

interface Opportunity {
  id: string;
  kind: OppKind;
  title: string;
  description: string;
  date: string;
  daysUntil: number;
  priority: Priority;
  seasonalDayId: string;
  seasonalDayName: string;
}

const MIN_CONTENT_THRESHOLD = 3;
const WINDOW_DAYS = 60;
const IGNORE_KEY = 'oportunidades_ignored_v1';

function loadIgnored(): Set<string> {
  try {
    const raw = localStorage.getItem(IGNORE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveIgnored(set: Set<string>) {
  localStorage.setItem(IGNORE_KEY, JSON.stringify([...set]));
}

function priorityFromDays(days: number): Priority {
  if (days <= 15) return 'alta';
  if (days <= 30) return 'media';
  return 'baixa';
}

const PRIORITY_META: Record<Priority, { label: string; dot: string; badge: string }> = {
  alta: { label: 'Alta', dot: 'bg-red-500', badge: 'bg-red-500/10 text-red-600 border-red-500/30' },
  media: { label: 'Média', dot: 'bg-yellow-500', badge: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  baixa: { label: 'Baixa', dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
};

export default function Oportunidades() {
  const navigate = useNavigate();
  const { getOccurrencesForYear, loading: loadingSeasonal } = useSeasonalDays();
  const { ideas, loading: loadingIdeas, refetch } = useDigital();
  const [ignored, setIgnored] = useState<Set<string>>(() => loadIgnored());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Central de Oportunidades';
  }, []);

  const opportunities = useMemo<Opportunity[]>(() => {
    if (loadingSeasonal || loadingIdeas) return [];
    const today = getNowSaoPaulo();
    const todayStr = getTodayISO();
    const year = today.getFullYear();
    const occurrencesThisYear = getOccurrencesForYear(year);
    const occurrencesNext = getOccurrencesForYear(year + 1);
    const all = [...occurrencesThisYear, ...occurrencesNext].filter((o) => !o.isPrepDay);

    // Dedupe by seasonal_day + date (range may produce duplicates)
    const seen = new Set<string>();
    const upcoming = all.filter((o) => {
      const key = `${o.seasonalDay.id}_${o.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      if (o.date < todayStr) return false;
      const days = differenceInCalendarDays(parseISO(o.date), today);
      return days >= 0 && days <= WINDOW_DAYS;
    });

    const result: Opportunity[] = [];
    for (const occ of upcoming) {
      const sd = occ.seasonalDay;
      const linkedIdeas = ideas.filter((i: any) => i.seasonal_day_id === sd.id);
      const campaigns = linkedIdeas.filter((i) => i.idea_type === 'campanha');
      const contents = linkedIdeas.filter((i) => i.idea_type === 'conteudo');
      const days = differenceInCalendarDays(parseISO(occ.date), today);
      const priority = priorityFromDays(days);

      if (campaigns.length === 0) {
        result.push({
          id: `camp_${sd.id}_${occ.date}`,
          kind: 'create_campaign',
          title: `Criar campanha para ${sd.name}`,
          description: `📅 ${sd.name} em ${days} dia${days === 1 ? '' : 's'}. Nenhuma campanha encontrada.`,
          date: occ.date,
          daysUntil: days,
          priority,
          seasonalDayId: sd.id,
          seasonalDayName: sd.name,
        });
      } else if (contents.length === 0) {
        result.push({
          id: `cont_${sd.id}_${occ.date}`,
          kind: 'create_content',
          title: `Criar conteúdo para ${sd.name}`,
          description: `📅 ${sd.name}. Campanha criada, mas nenhum conteúdo planejado.`,
          date: occ.date,
          daysUntil: days,
          priority,
          seasonalDayId: sd.id,
          seasonalDayName: sd.name,
        });
      } else if (contents.length < MIN_CONTENT_THRESHOLD) {
        result.push({
          id: `more_${sd.id}_${occ.date}`,
          kind: 'plan_more_content',
          title: `Planejar mais conteúdos para ${sd.name}`,
          description: `📅 ${sd.name}. Apenas ${contents.length} conteúdo${contents.length === 1 ? '' : 's'} cadastrado${contents.length === 1 ? '' : 's'}.`,
          date: occ.date,
          daysUntil: days,
          priority,
          seasonalDayId: sd.id,
          seasonalDayName: sd.name,
        });
      }
    }

    return result
      .filter((o) => !ignored.has(o.id))
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [ideas, getOccurrencesForYear, loadingIdeas, loadingSeasonal, ignored]);

  const handleIgnore = (id: string) => {
    const next = new Set(ignored);
    next.add(id);
    setIgnored(next);
    saveIgnored(next);
    toast.success('Oportunidade ignorada');
  };

  const createIdeaLinked = async (
    opp: Opportunity,
    type: 'campanha' | 'conteudo'
  ) => {
    setBusyId(opp.id);
    try {
      const title =
        type === 'campanha'
          ? `Campanha ${opp.seasonalDayName}`
          : `Conteúdo ${opp.seasonalDayName}`;
      const { data, error } = await supabase
        .from('digital_ideas')
        .insert({
          title,
          status: 'estrutural',
          idea_type: type,
          node_id: 'd7c76db8-b7e0-4ce1-87ca-21275c346326',
          seasonal_day_id: opp.seasonalDayId,
          seasonal_date: opp.date,
        } as any)
        .select()
        .single();

      if (error) {
        console.error(error);
        toast.error('Erro ao criar');
        return;
      }
      toast.success(type === 'campanha' ? 'Campanha criada!' : 'Conteúdo criado!');
      await refetch();
      navigate(`/digital?ideaId=${(data as any).id}`);
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    return {
      alta: opportunities.filter((o) => o.priority === 'alta').length,
      media: opportunities.filter((o) => o.priority === 'media').length,
      baixa: opportunities.filter((o) => o.priority === 'baixa').length,
    };
  }, [opportunities]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Central de Oportunidades
            </h1>
            <p className="text-xs text-muted-foreground">
              Sugestões automáticas com base no calendário sazonal e no módulo Digital
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{counts.alta}</div>
            <div className="text-xs text-muted-foreground">Alta prioridade</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{counts.media}</div>
            <div className="text-xs text-muted-foreground">Média</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{counts.baixa}</div>
            <div className="text-xs text-muted-foreground">Baixa</div>
          </CardContent></Card>
        </div>

        {(loadingIdeas || loadingSeasonal) && (
          <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">Carregando…</CardContent></Card>
        )}

        {!loadingIdeas && !loadingSeasonal && opportunities.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center">
              <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Tudo sob controle!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Nenhuma oportunidade pendente nos próximos {WINDOW_DAYS} dias.
              </p>
              {ignored.size > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-3"
                  onClick={() => { setIgnored(new Set()); saveIgnored(new Set()); }}
                >
                  Restaurar {ignored.size} oportunidade(s) ignorada(s)
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {opportunities.map((opp) => {
          const meta = PRIORITY_META[opp.priority];
          return (
            <Card key={opp.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                      <Badge variant="outline" className={`text-[10px] ${meta.badge}`}>
                        {meta.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDisplayDate(opp.date)} · em {opp.daysUntil} dia{opp.daysUntil === 1 ? '' : 's'}
                      </span>
                    </div>
                    <CardTitle className="text-base">{opp.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{opp.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex flex-wrap gap-2">
                {opp.kind === 'create_campaign' && (
                  <Button
                    size="sm"
                    disabled={busyId === opp.id}
                    onClick={() => createIdeaLinked(opp, 'campanha')}
                  >
                    <Megaphone className="h-4 w-4 mr-1" /> Criar Campanha
                  </Button>
                )}
                {(opp.kind === 'create_content' || opp.kind === 'plan_more_content') && (
                  <Button
                    size="sm"
                    disabled={busyId === opp.id}
                    onClick={() => createIdeaLinked(opp, 'conteudo')}
                  >
                    <FileText className="h-4 w-4 mr-1" /> Criar Conteúdo
                  </Button>
                )}
                {opp.kind === 'plan_more_content' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === opp.id}
                    onClick={() => createIdeaLinked(opp, 'campanha')}
                  >
                    <Megaphone className="h-4 w-4 mr-1" /> Nova Campanha
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => handleIgnore(opp.id)}
                >
                  <X className="h-4 w-4 mr-1" /> Ignorar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
