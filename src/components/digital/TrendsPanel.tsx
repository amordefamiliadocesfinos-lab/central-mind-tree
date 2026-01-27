import { useState, useEffect } from 'react';
import { useDigitalTrends, TrendsData } from '@/hooks/useDigitalTrends';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  TrendingUp, 
  Lightbulb, 
  Users, 
  Loader2, 
  Sparkles,
  Clock,
  Trash2,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export function TrendsPanel() {
  const { 
    loading, 
    trends, 
    currentResult, 
    searchTrends, 
    fetchTrends, 
    deleteTrend,
    setCurrentResult,
  } = useDigitalTrends();

  const [query, setQuery] = useState('');
  const [niche, setNiche] = useState('');

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Digite o que deseja pesquisar');
      return;
    }
    await searchTrends(query, niche);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const loadHistoricResult = (result: TrendsData) => {
    setCurrentResult(result);
  };

  const getEngagementColor = (potential: string) => {
    switch (potential?.toLowerCase()) {
      case 'alto': return 'bg-green-500';
      case 'médio': return 'bg-yellow-500';
      case 'baixo': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Pesquisa de Tendências com IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">O que você quer pesquisar?</label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: tendências de vídeos curtos para moda"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nicho (opcional)</label>
              <Input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Ex: moda feminina, gastronomia, fitness"
              />
            </div>
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={loading}
            className="w-full md:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisando tendências...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Pesquisar Tendências
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {currentResult && (
        <Tabs defaultValue="trends" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Tendências
            </TabsTrigger>
            <TabsTrigger value="competitors" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Concorrência
            </TabsTrigger>
            <TabsTrigger value="ideas" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Ideias
            </TabsTrigger>
          </TabsList>

          {/* Summary */}
          {currentResult.summary && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <p className="text-sm">{currentResult.summary}</p>
              </CardContent>
            </Card>
          )}

          <TabsContent value="trends" className="space-y-4">
            {currentResult.trends?.map((trend, idx) => (
              <Card key={idx}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{trend.title}</h3>
                        <Badge className={getEngagementColor(trend.engagement_potential)}>
                          {trend.engagement_potential}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{trend.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {trend.platforms?.map((platform) => (
                          <Badge key={platform} variant="outline" className="text-xs">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-start gap-2 mt-2 p-2 bg-muted rounded">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <p className="text-sm">{trend.action_suggestion}</p>
                      </div>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handleCopy(trend.action_suggestion)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="competitors" className="space-y-4">
            {currentResult.competitors_insights?.map((insight, idx) => (
              <Card key={idx}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold">{insight.strategy}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        <strong>Por que funciona:</strong> {insight.why_works}
                      </p>
                      <div className="flex items-start gap-2 mt-2 p-2 bg-green-500/10 rounded">
                        <Lightbulb className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <p className="text-sm">{insight.how_to_adapt}</p>
                      </div>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handleCopy(insight.how_to_adapt)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="ideas" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentResult.content_ideas?.map((idea, idx) => (
                <Card key={idx} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <Badge variant="secondary">{idea.format}</Badge>
                    <h3 className="font-semibold">{idea.topic}</h3>
                    <p className="text-sm text-muted-foreground italic">"{idea.hook}"</p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => handleCopy(`${idea.format}: ${idea.topic}\nGancho: ${idea.hook}`)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Ideia
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Raw response fallback */}
      {currentResult?.raw_response && !currentResult.trends && (
        <Card>
          <CardContent className="p-4">
            <pre className="whitespace-pre-wrap text-sm">{currentResult.raw_response}</pre>
          </CardContent>
        </Card>
      )}

      {/* History Section */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Histórico de Pesquisas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {trends.map((trend) => (
                  <div 
                    key={trend.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer"
                    onClick={() => loadHistoricResult(trend.results)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{trend.query}</p>
                      <p className="text-xs text-muted-foreground">
                        {trend.niche && `${trend.niche} • `}
                        {format(new Date(trend.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTrend(trend.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
