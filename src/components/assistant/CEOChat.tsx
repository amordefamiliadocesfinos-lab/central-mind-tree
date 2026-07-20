import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Send, Loader2, Bot, User, Sparkles, Trash2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  requiresGovernanceNotice?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-ceo/chat`;

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "👋 Olá! Sou a IA Orquestradora do Painel Central. Antes de qualquer ação, identifico seu objetivo, conecto os especialistas relevantes e apresento um plano seguro. Nesta fase, eu não executo automações, criações, edições ou exclusões diretamente pelo chat.",
};

const ACTION_INTENT_PATTERN =
  /\b(criar|cadastrar|adicionar|editar|alterar|atualizar|excluir|deletar|remover|apagar|concluir|finalizar|dar\s+baixa|quitar|executar|executado|executada|excluído|excluída|criado|criada|alterado|alterada)\b/i;

// Mensagens geradas pelo Motor de Coordenação começam com estes marcadores
// e representam execução/estado real — não devem exibir o aviso de "planejamento".
const MOTOR_RESPONSE_PREFIXES = ["✅", "🟢", "🔴", "🔎", "🔒", "📋", "📭", "⚠️"];

function detectActionIntent(content: string) {
  const trimmed = content.trimStart();
  if (MOTOR_RESPONSE_PREFIXES.some((p) => trimmed.startsWith(p)) || trimmed.startsWith("Operação cancelada."))
    return false;
  if (MOTOR_RESPONSE_PREFIXES.some((p) => trimmed.startsWith(p))) return false;
  return ACTION_INTENT_PATTERN.test(content);
}

function normalizeHistoryMessage(message: { role: string; content: string }): Message {
  const role = message.role === "user" ? "user" : "assistant";
  return {
    role,
    content: message.content,
    requiresGovernanceNotice: role === "assistant" && detectActionIntent(message.content),
  };
}

export function CEOChat() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data, error } = await supabase
          .from("ai_chat_messages")
          .select("role, content, created_at")
          .order("created_at", { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          setMessages(data.map(normalizeHistoryMessage));
        }
      } catch (err) {
        console.error("Error loading chat history:", err);
      } finally {
        setIsLoadingHistory(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };

    loadHistory();
  }, []);

  const saveMessage = async (role: "user" | "assistant", content: string) => {
    try {
      await supabase.from("ai_chat_messages").insert({ role, content });
    } catch (err) {
      console.error("Error saving message:", err);
    }
  };

  const clearHistory = async () => {
    try {
      await supabase.from("ai_chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      setMessages([WELCOME_MESSAGE]);
      inputRef.current?.focus();
      toast.success("Histórico limpo");
    } catch (err) {
      console.error("Error clearing history:", err);
      toast.error("Erro ao limpar histórico");
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = useCallback(async (userMessages: Message[]) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error("Sessão não autenticada. Faça login para conversar com a IA Orquestradora.");
    }
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messages: userMessages.map((m) => ({ role: m.role, content: m.content })) }),
    });

    if (!resp.ok) {
      if (resp.status === 429) throw new Error("Limite de requisições atingido. Tente novamente.");
      if (resp.status === 402) throw new Error("Créditos insuficientes.");
      throw new Error("Erro ao conectar com a IA Orquestradora");
    }

    if (!resp.body) throw new Error("Sem resposta do servidor");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    const updateAssistant = (content: string) => {
      setMessages((prev) => {
        const nextMessage: Message = {
          role: "assistant",
          content,
          requiresGovernanceNotice: detectActionIntent(content),
        };
        const last = prev[prev.length - 1];

        if (last?.role === "assistant" && prev.length > 1) {
          return prev.map((m, i) => (i === prev.length - 1 ? nextMessage : m));
        }

        return [...prev, nextMessage];
      });
    };

    const consumeDataLine = (jsonStr: string) => {
      if (jsonStr === "[DONE]") return;

      const parsed = JSON.parse(jsonStr);
      const content = parsed.choices?.[0]?.delta?.content as string | undefined;

      if (content) {
        assistantContent += content;
        updateAssistant(assistantContent);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        try {
          consumeDataLine(line.slice(6).trim());
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (const raw of textBuffer.split("\n")) {
        if (!raw || raw.startsWith(":") || !raw.startsWith("data: ")) continue;

        try {
          consumeDataLine(raw.slice(6).trim());
        } catch {
          // Ignore incomplete trailing chunks.
        }
      }
    }

    return assistantContent;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    await saveMessage("user", userMessage.content);

    try {
      const assistantContent = await streamChat(newMessages);

      if (assistantContent) {
        await saveMessage("assistant", assistantContent);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorContent = `❌ ${error instanceof Error ? error.message : "Erro ao processar sua mensagem"}`;
      setMessages((prev) => [...prev, { role: "assistant", content: errorContent }]);
      await saveMessage("assistant", errorContent);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const quickActions = [
    { label: "📊 Resumo geral", prompt: "Me dê um resumo geral do estado atual: tarefas, finanças e pendências." },
    { label: "⚠️ Prioridades", prompt: "Quais são as prioridades mais urgentes agora?" },
    { label: "💰 Fluxo de caixa", prompt: "Como está o fluxo de caixa? Há contas atrasadas?" },
    { label: "📋 Tarefas críticas", prompt: "Quais tarefas estão atrasadas ou precisam de atenção?" },
  ];

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <Card className="flex flex-col h-[calc(100vh-320px)] min-h-[400px]">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="text-sm font-medium text-muted-foreground">Conversa</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearHistory}
          disabled={messages.length <= 1 || isLoading}
          className="h-8 px-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i}>
                <div className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md",
                    )}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ol:my-1 prose-ul:my-1 [&_sub]:opacity-30 [&_sub]:text-[10px]">
                      <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>

                  {msg.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
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
        )}
      </ScrollArea>

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

      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem para a IA Orquestradora..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </Card>
  );
}
