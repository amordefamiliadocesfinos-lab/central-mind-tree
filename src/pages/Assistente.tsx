import { useState, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MobileHeader } from '@/components/ui/mobile-header';
import { Input } from '@/components/ui/input';
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
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { useAICEO, AIInsight, AIPolicy, AIAction } from '@/hooks/useAICEO';
import { CEOChat } from '@/components/assistant/CEOChat';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
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

// Mapa de tipos de ação para descrição amigável
const actionTypeLabels: Record<string, { label: string; icon: string; color: string }> = {
  task_create: { label: 'Criar Tarefa', icon: '➕', color: 'bg-emerald-500/20 text-emerald-700' },
  task_update: { label: 'Editar Tarefa', icon: '✏️', color: 'bg-blue-500/20 text-blue-700' },
  task_delete: { label: 'Excluir Tarefa', icon: '🗑️', color: 'bg-red-500/20 text-red-700' },
  node_create: { label: 'Criar Nó', icon: '➕', color: 'bg-emerald-500/20 text-emerald-700' },
  node_update: { label: 'Editar Nó', icon: '✏️', color: 'bg-blue-500/20 text-blue-700' },
  node_delete: { label: 'Excluir Nó', icon: '🗑️', color: 'bg-red-500/20 text-red-700' },
  order_create: { label: 'Criar Pedido', icon: '➕', color: 'bg-emerald-500/20 text-emerald-700' },
  order_update: { label: 'Editar Pedido', icon: '✏️', color: 'bg-blue-500/20 text-blue-700' },
  order_delete: { label: 'Excluir Pedido', icon: '🗑️', color: 'bg-red-500/20 text-red-700' },
  financial_create: { label: 'Criar Lançamento', icon: '➕', color: 'bg-emerald-500/20 text-emerald-700' },
  financial_update: { label: 'Editar Lançamento', icon: '✏️', color: 'bg-blue-500/20 text-blue-700' },
  financial_delete: { label: 'Excluir Lançamento', icon: '🗑️', color: 'bg-red-500/20 text-red-700' },
  financial_pay: { label: 'Dar Baixa', icon: '💰', color: 'bg-amber-500/20 text-amber-700' },
  contact_create: { label: 'Criar Contato', icon: '➕', color: 'bg-emerald-500/20 text-emerald-700' },
  contact_update: { label: 'Editar Contato', icon: '✏️', color: 'bg-blue-500/20 text-blue-700' },
  contact_delete: { label: 'Excluir Contato', icon: '🗑️', color: 'bg-red-500/20 text-red-700' },
  product_create: { label: 'Criar Produto', icon: '➕', color: 'bg-emerald-500/20 text-emerald-700' },
  product_update: { label: 'Editar Produto', icon: '✏️', color: 'bg-blue-500/20 text-blue-700' },
  product_delete: { label: 'Excluir Produto', icon: '🗑️', color: 'bg-red-500/20 text-red-700' },
  routine_create: { label: 'Criar Bloco', icon: '📅', color: 'bg-purple-500/20 text-purple-700' },
  routine_update: { label: 'Editar Bloco', icon: '✏️', color: 'bg-blue-500/20 text-blue-700' },
  routine_delete: { label: 'Excluir Bloco', icon: '🗑️', color: 'bg-red-500/20 text-red-700' },
  post_create: { label: 'Criar Post', icon: '📝', color: 'bg-emerald-500/20 text-emerald-700' },
  post_update: { label: 'Editar Post', icon: '✏️', color: 'bg-blue-500/20 text-blue-700' },
  post_delete: { label: 'Excluir Post', icon: '🗑️', color: 'bg-red-500/20 text-red-700' },
  notification: { label: 'Notificação', icon: '🔔', color: 'bg-muted text-muted-foreground' },
};

interface InsightChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

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
  const decision = insight.decision as { type: string; payload?: Record<string, unknown> } | null;
  const actionInfo = decision?.type ? actionTypeLabels[decision.type] : null;
  
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<InsightChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyLoaded = useRef(false);

  // Load chat history when opening
  useEffect(() => {
    if (chatOpen && !historyLoaded.current) {
      loadChatHistory();
    }
  }, [chatOpen]);

  useEffect(() => {
    if (chatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatOpen]);

  const loadChatHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('ai_insight_messages')
        .select('id, role, content')
        .eq('insight_id', insight.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        setChatMessages(data.map(m => ({ 
          id: m.id, 
          role: m.role as 'user' | 'assistant', 
          content: m.content 
        })));
      }
      historyLoaded.current = true;
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    try {
      await supabase
        .from('ai_insight_messages')
        .insert({ insight_id: insight.id, role, content });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const clearChatHistory = async () => {
    try {
      await supabase
        .from('ai_insight_messages')
        .delete()
        .eq('insight_id', insight.id);
      setChatMessages([]);
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    saveMessage('user', userMessage);
    setIsLoading(true);

    try {
      const contextMessage = `
[CONTEXTO DO INSIGHT]
Título: ${insight.title}
Área: ${insight.area}
Severidade: ${insight.severity}
Descrição: ${insight.description}
${actionInfo ? `Ação proposta: ${actionInfo.label}` : ''}
${decision?.payload ? `Payload: ${JSON.stringify(decision.payload)}` : ''}
Impacto: ${Math.round(insight.impact * 100)}%
Risco: ${Math.round(insight.risk * 100)}%
Confiança: ${Math.round(insight.confidence * 100)}%

[PERGUNTA DO USUÁRIO]
${userMessage}

Responda de forma direta e concisa. Se o usuário pedir para aprovar, rejeitar, modificar ou executar a ação, confirme a instrução para que ele possa clicar no botão correspondente.`;

      const response = await supabase.functions.invoke('ai-ceo/chat', {
        body: { message: contextMessage }
      });

      if (response.error) throw response.error;
      
      const reader = response.data.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            assistantMessage += data;
            setChatMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
              return updated;
            });
          }
        }
      }

      // Save assistant message after streaming is complete
      if (assistantMessage) {
        saveMessage('assistant', assistantMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = 'Desculpe, ocorreu um erro ao processar sua mensagem.';
      setChatMessages(prev => [...prev, { role: 'assistant', content: errorMessage }]);
      saveMessage('assistant', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="overflow-hidden border-l-4" style={{ 
      borderLeftColor: isPending ? 'hsl(var(--primary))' : 'transparent' 
    }}>
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
          <div className="flex gap-1 flex-wrap justify-end">
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
        
        {/* Ação proposta */}
        {actionInfo && decision && (
          <div className={`p-3 rounded-lg ${actionInfo.color} border`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{actionInfo.icon}</span>
              <span className="font-medium text-sm">{actionInfo.label}</span>
            </div>
            {decision.payload && (
              <div className="text-xs space-y-1 opacity-80">
                {Object.entries(decision.payload).slice(0, 4).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="font-medium">{key}:</span>
                    <span className="truncate">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
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
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Esta ação requer sua aprovação para ser executada</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={onApprove} className="flex-1">
                <Check className="h-4 w-4 mr-1" />
                Aprovar e Executar
              </Button>
              <Button size="sm" variant="outline" onClick={onReject} className="flex-1">
                <X className="h-4 w-4 mr-1" />
                Rejeitar
              </Button>
            </div>
            
            {/* Chat de diálogo inline */}
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setChatOpen(!chatOpen);
                  if (!chatOpen) {
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Discutir com CEO IA</span>
                {chatMessages.length > 0 && !chatOpen && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {chatMessages.length}
                  </Badge>
                )}
                {chatOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              
              {chatOpen && (
                <div className="mt-2 border rounded-lg bg-muted/30 overflow-hidden">
                  {/* Mensagens do chat */}
                  {loadingHistory ? (
                    <div className="p-4 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">Carregando histórico...</span>
                    </div>
                  ) : chatMessages.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto p-3 space-y-2">
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={msg.id || idx}
                          className={`text-sm p-2 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground ml-8'
                              : 'bg-background border mr-8'
                          }`}
                        >
                          {msg.content || (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  ) : (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      Faça perguntas sobre esta decisão antes de aprovar ou rejeitar
                    </div>
                  )}
                  
                  {/* Input do chat */}
                  <div className="p-2 border-t bg-background flex gap-2">
                    <Input
                      ref={inputRef}
                      placeholder="Pergunte sobre esta decisão..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading}
                      className="flex-1 text-sm"
                    />
                    <Button
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                    {chatMessages.length > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={clearChatHistory}
                        className="text-muted-foreground hover:text-destructive"
                        title="Limpar histórico"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
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
                  ? `${pendingCount} ações aguardando aprovação`
                  : 'Autonomia total com sua aprovação'}
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

        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chat" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
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

          <TabsContent value="chat" className="mt-4">
            <CEOChat />
          </TabsContent>

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
