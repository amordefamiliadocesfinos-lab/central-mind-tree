import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSeasonalDays } from '@/hooks/useSeasonalDays';
import { useDigital } from '@/hooks/useDigital';
import { supabase } from '@/integrations/supabase/client';
import { formatDisplayDate, getNowSaoPaulo, getTodayISO } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { Calendar, Megaphone, FileText, X, Sparkles, ArrowLeft, Flame } from 'lucide-react';

type OppKind = 'create_campaign' | 'create_content' | 'plan_more_content';

interface Opportunity {
  id: string;
  kind: OppKind;
  title: string;
  description: string;
  date: string;
  daysUntil: number;
  score: number;
  seasonalDayId: string;
  seasonalDayName: string;
  campaignCount: number;
  contentCount: number;
  publishedCount: number;
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

function calculateScore(
  daysUntil: number,
  campaignCount: number,
  contentCount: number,
  publishedCount: number,
  kind: OppKind
): number {
  // 1. Proximidade da data (0-35 pts)
  let proximityScore = 15;
  if (daysUntil <= 15) proximityScore = 35;
  else if (daysUntil <= 30) proximityScore = 25;

  // 2. Existência de campanha (0-30 pts)
  // Sem campanha = urgência máxima em criar uma
  let campaignScore = campaignCount === 0 ? 30 : 0;

  // 3. Quantidade de conteúdos planejados (0-20 pts)
  // Quanto menos conteúdo, maior a oportunidade de planejar mais
  let plannedScore = 0;
  if (contentCount < MIN_CONTENT_THRESHOLD) {
    plannedScore = (MIN_CONTENT_THRESHOLD - contentCount) * 7;
  }
  if (plannedScore > 20) plannedScore = 20;

  // 4. Quantidade de conteúdos publicados (0-15 pts)
  // Quanto menos publicado, maior a oportunidade de agir
  let publishedScore = 0;
  if (publishedCount === 0) publishedScore = 15;
  else if (publishedCount === 1) publishedScore = 8;
  else if (publishedCount === 2) publishedScore = 3;

  const total = proximityScore + campaignScore + plannedScore + publishedScore;
  return Math.min(100, Math.max(0, total));
}

function scoreMeta(score: number) {
  if (score >= 90) {
    return {
      emoji: '🔥',
      icon: Flame,
      label: 'Crítico',
      badgeClass: 'bg-red-500/10 text-red-600 border-red-500/30',
      barColor: 'bg-red-500',
      textColor: 'text-red-600',
      cardBorder: 'border-red-500/30',
    };
  }
  if (score >= 60) {
    return {
      emoji: '🟡',
      icon: null as any,
      label: 'Importante',
      badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
      barColor: 'bg-amber-500',
      textColor: 'text-amber-600',
      cardBorder: 'border-amber-500/30',
    };
  }
  return {
    emoji: '⚪',
    icon: null as any,
    label: 'Baixa',
    badgeClass: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
    barColor: 'bg-slate-400',
    textColor: 'text-slate-500',
    cardBorder: 'border-slate-500/20',
  };
}

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
      const publishedCount = contents.filter((c: any) => {
        const variations = c.digital_variations || [];
        return variations.some((v: any) => v.status === 'publicado');
      }).length;
      const days = differenceInCalendarDays(parseISO(occ.date), today);

      if (campaigns.length === 0) {
        const score = calculateScore(days, 0, contents.length, publishedCount, 'create_campaign');
        result.push({
          id: `camp_${sd.id}_${occ.date}`,
          kind: 'create_campaign',
          title: `Criar campanha para ${sd.name}`,
          description: `📅 ${sd.name} em ${days} dia${days === 1 ? '' : 's'}. Nenhuma campanha encontrada.`,
          date: occ.date,
          daysUntil: days,
          score,
          seasonalDayId: sd.id,
          seasonalDayName: sd.name,
          campaignCount: 0,
          contentCount: contents.length,
          publishedCount,
        });
      } else if (contents.length === 0) {
        const score = calculateScore(days, campaigns.length, 0, publishedCount, 'create_content');
        result.push({
          id: `cont_${sd.id}_${occ.date}`,
          kind: 'create_content',
          title: `Criar conteúdo para ${sd.name}`,
          description: `📅 ${sd.name}. Campanha criada, mas nenhum conteúdo planejado.`,
          date: occ.date,
          daysUntil: days,
          score,
          seasonalDayId: sd.id,
          seasonalDayName: sd.name,
          campaignCount: campaigns.length,
          contentCount: 0,
          publishedCount,
        });
      } else if (contents.length < MIN_CONTENT_THRESHOLD) {
        const score = calculateScore(days, campaigns.length, contents.length, publishedCount, 'plan_more_content');
        result.push({
          id: `more_${sd.id}_${occ.date}`,
          kind: 'plan_more_content',
          title: `Planejar mais conteúdos para ${sd.name}`,
          description: `📅 ${sd.name}. Apenas ${contents.length} conteúdo${contents.length === 1 ? '' : 's'} cadastrado${contents.length === 1 ? '' : 's'}.`,
          date: occ.date,
          daysUntil: days,
          score,
          seasonalDayId: sd.id,
          seasonalDayName: sd.name,
          campaignCount: campaigns.length,
          contentCount: contents.length,
          publishedCount,
        });
      }
    }

    // Ordenar por score DESC (maior oportunidade primeiro)
    return result
      .filter((o) => !ignored.has(o.id))
      .sort((a, b) => b.score - a.score);
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
      critico: opportunities.filter((o) => o.score >= 90).length,
      importante: opportunities.filter((o) => o.score >= 60 && o.score < 90).length,
      baixa: opportunities.filter((o) => o.score < 60).length,
    };
  }, [opportunities]);

  const averageScore = useMemo(() => {
    if (opportunities.length === 0) return 0;
    return Math.round(opportunities.reduce((sum, o) => sum + o.score, 0) / opportunities.length);
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
        {/* Score médio */}
        {opportunities.length > 0 && (
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Score médio das oportunidades</span>
                <span className={`text-lg font-bold ${scoreMeta(averageScore).textColor}`}>
                  {averageScore}/100
                </span>
              </div>
              <Progress value={averageScore} className="h-2" />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Card className="border-red-500/20">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
                🔥 {counts.critico}
              </div>
              <div className="text-xs text-muted-foreground">Crítico (90-100)</div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-amber-600 flex items-center justify-center gap-1">
                🟡 {counts.importante}
              </div>
              <div className="text-xs text-muted-foreground">Importante (60-89)</div>
            </CardContent>
          </Card>
          <Card className="border-slate-500/20">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-slate-500 flex items-center justify-center gap-1">
                ⚪ {counts.baixa}
              </div>
              <div className="text-xs text-muted-foreground">Baixa (0-59)</div>
            </CardContent>
          </Card>
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
          const meta = scoreMeta(opp.score);
          return (
            <Card key={opp.id} className={`overflow-hidden ${meta.cardBorder}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${meta.badgeClass}`}>
                        {meta.emoji} {meta.label} · {opp.score}/100
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDisplayDate(opp.date)} · em {opp.daysUntil} dia{opp.daysUntil === 1 ? '' : 's'}
                      </span>
                    </div>
                    <CardTitle className="text-base">{opp.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{opp.description}</p>

                    {/* Score bar */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Score de oportunidade</span>
                        <span className={`font-semibold ${meta.textColor}`}>{opp.score}/100</span>
                      </div>
                      <Progress value={opp.score} className={`h-1.5 ${meta.barColor}`} />
                    </div>

                    {/* Detalhes dos critérios */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {opp.campaignCount === 0 ? (
                        <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-600">
                          Sem campanha
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          {opp.campaignCount} campanha{opp.campaignCount === 1 ? '' : 's'}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {opp.contentCount} conteúdo{opp.contentCount === 1 ? '' : 's'} planejado{opp.contentCount === 1 ? '' : 's'}
                      </Badge>
                      {opp.publishedCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                          {opp.publishedCount} publicado{opp.publishedCount === 1 ? '' : 's'}
                        </Badge>
                      )}
                    </div>
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
