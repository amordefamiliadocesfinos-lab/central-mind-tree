import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MobileHeader } from '@/components/ui/mobile-header';
import {
  Brain,
  Sparkles,
  Check,
  X,
  PlayCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  DollarSign,
  FolderKanban,
  User,
  Loader2,
  History,
  Settings2,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { useAICEO, AIInsight, AIPolicy, AIAction } from '@/hooks/useAICEO';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const areaIcons: Record<string, React.ReactNode> = {
  Financeiro: <DollarSign className="h-4 w-4" />,
  Projetos: <FolderKanban className="h-4 w-4" />,
  Tempo: <Clock className="h-4 w-4" />,
  Recursos: <User className="h-4 w-4" />,
};

const areaColors: Record<string, string> = {
  Financeiro: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  Projetos: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  Tempo: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  Recursos: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
};

const severityColors: Record<string, string> = {
  baixa: 'bg-muted text-muted-foreground',
  media: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  alta: 'bg-red-500/20 text-red-700 dark:text-red-400',
};

const statusColors: Record<string, string> = {
  proposto: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  aprovado: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  executado: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  rejeitado: 'bg-muted text-muted-foreground line-through',
};

function InsightCard({
  insight,
  onApprove,
  onReject,
}: {
  insight: AIInsight;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isPending = insight.status === 'proposto';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${areaColors[insight.area]}`}>
              {areaIcons[insight.area]}
            </div>
            <div>
              <CardTitle className="text-base">{insight.title}</CardTitle>
              <CardDescription className="text-xs">
                {format(new Date(insight.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-1">
            <Badge variant="outline" className={severityColors[insight.severity]}>
              {insight.severity}
            </Badge>
            <Badge variant="outline" className={statusColors[insight.status]}>
              {insight.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{insight.description}</p>
        
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            <span>Impacto: {Math.round(insight.impact * 100)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            <span>Risco: {Math.round(insight.risk * 100)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-blue-500" />
            <span>Confiança: {Math.round(insight.confidence * 100)}%</span>
          </div>
        </div>

        {isPending && (
          <>
            <Separator />
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={onApprove} className="flex-1">
                <Check className="h-4 w-4 mr-1" />
                Aprovar
              </Button>
              <Button size="sm" variant="outline" onClick={onReject} className="flex-1">
                <X className="h-4 w-4 mr-1" />
                Rejeitar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PolicyCard({
  policy,
  onUpdate,
}: {
  policy: AIPolicy;
  onUpdate: (enabled: boolean, maxRisk: number) => void;
}) {
  const [localMaxRisk, setLocalMaxRisk] = useState(policy.max_risk);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-md ${areaColors[policy.area]}`}>
              {areaIcons[policy.area]}
            </div>
            <CardTitle className="text-base">{policy.area}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Autopilot</span>
            <Switch
              checked={policy.autopilot}
              onCheckedChange={(checked) => onUpdate(checked, localMaxRisk)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Risco máximo permitido</span>
            <span className="font-medium">{Math.round(localMaxRisk * 100)}%</span>
          </div>
          <Slider
            value={[localMaxRisk * 100]}
            min={10}
            max={80}
            step={5}
            disabled={!policy.autopilot}
            onValueChange={([v]) => setLocalMaxRisk(v / 100)}
            onValueCommit={([v]) => onUpdate(policy.autopilot, v / 100)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {policy.autopilot
            ? `Ações com risco ≤ ${Math.round(localMaxRisk * 100)}% serão executadas automaticamente`
            : 'Todas as ações requerem aprovação manual'}
        </p>
      </CardContent>
    </Card>
  );
}

function ActionLogItem({ action }: { action: AIAction }) {
  const statusIcon =
    action.status === 'ok' ? (
      <Check className="h-4 w-4 text-emerald-500" />
    ) : action.status === 'erro' ? (
      <X className="h-4 w-4 text-red-500" />
    ) : (
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    );

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="mt-0.5">{statusIcon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {action.ai_insights?.title || action.action_type}
          </span>
          {action.ai_insights?.area && (
            <Badge variant="outline" className={`text-xs ${areaColors[action.ai_insights.area]}`}>
              {action.ai_insights.area}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{action.result}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {action.executed_at
            ? format(new Date(action.executed_at), "dd/MM HH:mm", { locale: ptBR })
            : format(new Date(action.created_at), "dd/MM HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}

export default function Assistente() {
  const {
    insights,
    policies,
    actions,
    loading,
    running,
    pendingCount,
    runAnalysis,
    approveInsight,
    rejectInsight,
    updateAutopilot,
    fetchInsights,
  } = useAICEO();

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [areaFilter, setAreaFilter] = useState<string>('');

  const filteredInsights = insights.filter((i) => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (areaFilter && i.area !== areaFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <MobileHeader title="Assistente IA" />

      <div className="container max-w-4xl mx-auto p-4 space-y-4">
        {/* Header with run button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">CEO IA</h1>
              <p className="text-sm text-muted-foreground">
                {pendingCount > 0
                  ? `${pendingCount} sugestões pendentes`
                  : 'Nenhuma sugestão pendente'}
              </p>
            </div>
          </div>
          <Button onClick={runAnalysis} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            Analisar
          </Button>
        </div>

        <Tabs defaultValue="insights" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="insights" className="flex items-center gap-1">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Decisões</span>
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="policies" className="flex items-center gap-1">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Políticas</span>
            </TabsTrigger>
            <TabsTrigger value="log" className="flex items-center gap-1">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Log</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={statusFilter === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('')}
              >
                Todos
              </Button>
              <Button
                variant={statusFilter === 'proposto' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('proposto')}
              >
                Pendentes
              </Button>
              <Button
                variant={statusFilter === 'executado' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('executado')}
              >
                Executados
              </Button>
              <Button
                variant={statusFilter === 'rejeitado' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('rejeitado')}
              >
                Rejeitados
              </Button>
              <Separator orientation="vertical" className="h-8" />
              <Button
                variant={areaFilter === '' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setAreaFilter('')}
              >
                Todas áreas
              </Button>
              {['Financeiro', 'Projetos', 'Tempo', 'Recursos'].map((area) => (
                <Button
                  key={area}
                  variant={areaFilter === area ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setAreaFilter(area)}
                >
                  {areaIcons[area]}
                </Button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredInsights.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Brain className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium mb-1">Nenhum insight encontrado</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Execute uma análise para gerar sugestões
                  </p>
                  <Button onClick={runAnalysis} disabled={running}>
                    {running ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Executar análise
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="space-y-3 pr-4">
                  {filteredInsights.map((insight) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      onApprove={() => approveInsight(insight.id)}
                      onReject={() => rejectInsight(insight.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="policies" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {policies.map((policy) => (
                <PolicyCard
                  key={policy.id}
                  policy={policy}
                  onUpdate={(enabled, maxRisk) => updateAutopilot(policy.area, enabled, maxRisk)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="log" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Ações</CardTitle>
                <CardDescription>Últimas ações executadas pelo assistente</CardDescription>
              </CardHeader>
              <CardContent>
                {actions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma ação executada ainda</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-1">
                      {actions.map((action) => (
                        <ActionLogItem key={action.id} action={action} />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
