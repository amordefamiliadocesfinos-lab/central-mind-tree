import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Send, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-ceo/chat`;

export function CEOChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Olá! Sou o CEO IA, seu assistente executivo. Posso ajudar com:\n\n• **Análise** de tarefas, finanças e agenda\n• **Criar, editar ou excluir** qualquer item do sistema\n• **Orientações** sobre prioridades e decisões\n• **Resumos** do estado atual dos projetos\n\nComo posso ajudar você hoje?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = useCallback(async (userMessages: Message[]) => {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: userMessages }),
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

    const updateAssistant = (content: string) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && prev.length > 1) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
        }
        return [...prev, { role: 'assistant', content }];
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
            updateAssistant(assistantContent);
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
            updateAssistant(assistantContent);
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
            <div
              key={i}
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