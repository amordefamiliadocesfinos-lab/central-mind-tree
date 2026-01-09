import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Send, Loader2, Bot, User, Sparkles, Play, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  pendingActions?: PendingAction[];
  actionsExecuted?: boolean;
}

interface PendingAction {
  type: string;
  title?: string;
  description?: string;
  area?: string;
  payload?: Record<string, unknown>;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-ceo/chat`;
const EXECUTE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-ceo/execute`;

// Parse actions from AI response
function parseActionsFromResponse(content: string): PendingAction[] {
  const actions: PendingAction[] = [];
  
  // Pattern: numbered list with action keywords
  const patterns = [
    // Criar nó/tarefa/pedido etc
    /(?:criar|adicionar|novo)\s+(?:o\s+)?(?:nó|node)\s+["']?([^"'\n]+)["']?/gi,
    /(?:criar|adicionar|nova)\s+(?:a\s+)?(?:tarefa|task)\s+["']?([^"'\n]+)["']?(?:\s+(?:com|na|no|em)\s+(?:descrição|nó)\s+["']?([^"'\n]+)["']?)?/gi,
  ];

  // Check for create node pattern
  const nodeMatch = content.match(/criar\s+(?:o\s+)?nó\s+["']?([^"'\n]+?)["']?/i);
  if (nodeMatch) {
    actions.push({
      type: 'node_create',
      title: nodeMatch[1].trim(),
      area: 'Projetos',
      payload: { title: nodeMatch[1].trim(), color: 'bg-gray-100' }
    });
  }

  // Check for create task pattern with description and node reference
  const taskMatches = content.matchAll(/criar\s+(?:a\s+)?tarefa\s+["']?([^"'\n]+?)["']?(?:\s+com\s+(?:a\s+)?descrição\s+["']?([^"'\n]+?)["']?)?(?:\s+(?:vinculada|associada|no|na)\s+(?:ao\s+)?(?:nó|projeto)\s+["']?([^"'\n]+?)["']?)?/gi);
  for (const match of taskMatches) {
    const taskTitle = match[1]?.trim();
    const description = match[2]?.trim();
    const nodeName = match[3]?.trim();
    
    if (taskTitle) {
      actions.push({
        type: 'task_create',
        title: taskTitle,
        description: description,
        area: 'Projetos',
        payload: { 
          title: taskTitle, 
          description: description,
          status: 'pendente',
          _nodeName: nodeName // Reference to find node_id later
        }
      });
    }
  }

  return actions;
}

export function CEOChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Olá! Sou o CEO IA, seu assistente executivo. Posso ajudar com:\n\n• **Análise** de tarefas, finanças e agenda\n• **Criar, editar ou excluir** qualquer item do sistema\n• **Orientações** sobre prioridades e decisões\n• **Resumos** do estado atual dos projetos\n\n💡 **Dica**: Quando eu propor ações, clique em "Já pode executar" para executar diretamente!\n\nComo posso ajudar você hoje?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const executeActions = async (messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message.pendingActions?.length) return;

    setIsExecuting(true);
    const results: string[] = [];

    try {
      // First, get all nodes to resolve node names to IDs
      const { data: nodes } = await supabase.from('nodes').select('id, title');
      const nodeMap = new Map(nodes?.map(n => [n.title.toLowerCase(), n.id]) || []);

      for (const action of message.pendingActions) {
        try {
          // Resolve node reference if needed
          let payload = { ...action.payload };
          if (action.type === 'task_create' && payload._nodeName) {
            const nodeName = payload._nodeName as string;
            let nodeId = nodeMap.get(nodeName.toLowerCase());
            
            // If node doesn't exist, create it first
            if (!nodeId) {
              const { data: newNode, error: nodeError } = await supabase
                .from('nodes')
                .insert({ title: nodeName, color: 'bg-gray-100' })
                .select()
                .single();
              
              if (!nodeError && newNode) {
                nodeId = newNode.id;
                nodeMap.set(nodeName.toLowerCase(), nodeId);
                results.push(`✅ Nó "${nodeName}" criado`);
              }
            }
            
            payload.node_id = nodeId;
            delete payload._nodeName;
          }

          const response = await fetch(EXECUTE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              action: {
                type: action.type,
                title: action.title,
                description: action.description,
                area: action.area,
                payload
              }
            }),
          });

          const data = await response.json();
          if (data.success) {
            results.push(`✅ ${data.result}`);
          } else {
            results.push(`❌ Falha: ${action.title || action.type}`);
          }
        } catch (err) {
          console.error('Action execution error:', err);
          results.push(`❌ Erro: ${action.title || action.type}`);
        }
      }

      // Mark actions as executed
      setMessages(prev => prev.map((m, i) => 
        i === messageIndex ? { ...m, actionsExecuted: true } : m
      ));

      // Add result message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `🎯 **Ações executadas:**\n\n${results.join('\n')}`
      }]);

      toast.success('Ações executadas com sucesso!');
    } catch (error) {
      console.error('Execution error:', error);
      toast.error('Erro ao executar ações');
    } finally {
      setIsExecuting(false);
    }
  };

  const streamChat = useCallback(async (userMessages: Message[]) => {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: userMessages.map(m => ({ role: m.role, content: m.content })) }),
    });

    if (!resp.ok) {
      if (resp.status === 429) throw new Error('Limite de requisições atingido. Tente novamente.');
      if (resp.status === 402) throw new Error('Créditos insuficientes.');
      throw new Error('Erro ao conectar com o CEO IA');
    }

    if (!resp.body) throw new Error('Sem resposta do servidor');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let assistantContent = '';

    const updateAssistant = (content: string, pendingActions?: PendingAction[]) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && prev.length > 1) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content, pendingActions } : m));
        }
        return [...prev, { role: 'assistant', content, pendingActions }];
      });
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            // Parse actions from content
            const actions = parseActionsFromResponse(assistantContent);
            updateAssistant(assistantContent, actions.length > 0 ? actions : undefined);
          }
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Flush remaining
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw || raw.startsWith(':') || !raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantContent += content;
            const actions = parseActionsFromResponse(assistantContent);
            updateAssistant(assistantContent, actions.length > 0 ? actions : undefined);
          }
        } catch {}
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      await streamChat(newMessages);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ ${error instanceof Error ? error.message : 'Erro ao processar sua mensagem'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const quickActions = [
    { label: '📊 Resumo geral', prompt: 'Me dê um resumo geral do estado atual: tarefas, finanças e pendências.' },
    { label: '⚠️ Prioridades', prompt: 'Quais são as prioridades mais urgentes agora?' },
    { label: '💰 Fluxo de caixa', prompt: 'Como está o fluxo de caixa? Há contas atrasadas?' },
    { label: '📋 Tarefas críticas', prompt: 'Quais tarefas estão atrasadas ou precisam de atenção?' },
  ];

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <Card className="flex flex-col h-[calc(100vh-320px)] min-h-[400px]">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i}>
              <div
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted rounded-bl-md'
                  )}
                >
                  <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                    {msg.content.split(/(\*\*.*?\*\*)/).map((part, j) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j}>{part.slice(2, -2)}</strong>;
                      }
                      return <span key={j}>{part}</span>;
                    })}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
              
              {/* Execute button for messages with pending actions */}
              {msg.role === 'assistant' && msg.pendingActions && msg.pendingActions.length > 0 && (
                <div className="ml-11 mt-2">
                  {msg.actionsExecuted ? (
                    <Button variant="outline" size="sm" disabled className="gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Ações executadas
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => executeActions(i)}
                      disabled={isExecuting}
                      className="gap-2"
                    >
                      {isExecuting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Já pode executar
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick actions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleQuickAction(action.prompt)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem para o CEO IA..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </Card>
  );
}
