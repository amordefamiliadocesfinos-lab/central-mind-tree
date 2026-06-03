import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Sparkles, MessageCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Message {
  id: string;
  conversation_id: string;
  sender: 'customer' | 'agent' | 'ai_suggestion';
  content: string;
  is_ai_suggested: boolean;
  created_at: string;
}

interface ContactChatPanelProps {
  contactId: string;
  contactName?: string | null;
  contactHandle?: string | null;
  contactAvatar?: string | null;
}

export function ContactChatPanel({ contactId, contactName, contactHandle, contactAvatar }: ContactChatPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Localiza ou cria a conversa para este contato
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: existing } = await supabase
        .from('service_conversations')
        .select('id')
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (existing?.id) {
        setConversationId(existing.id);
      } else {
        const { data: created, error } = await supabase
          .from('service_conversations')
          .insert({
            contact_id: contactId,
            contact_name: contactName || null,
            contact_handle: contactHandle || null,
            contact_avatar_url: contactAvatar || null,
            status: 'open',
            funnel_stage: 'lead',
          })
          .select('id')
          .single();
        if (error) {
          toast.error('Erro ao iniciar conversa');
          setLoading(false);
          return;
        }
        if (!cancelled) setConversationId(created.id);
      }
    })();
    return () => { cancelled = true; };
  }, [contactId, contactName, contactHandle, contactAvatar]);

  // Carrega mensagens e realtime
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('service_messages')
        .select('id, conversation_id, sender, content, is_ai_suggested, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (!cancelled) {
        setMessages((data || []) as Message[]);
        setLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };
    load();

    const ch = supabase
      .channel(`contact-chat-${conversationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'service_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, load)
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [conversationId]);

  const handleSend = async (sender: 'agent' | 'customer' = 'agent') => {
    if (!conversationId || !text.trim()) return;
    setSending(true);
    const content = text.trim();
    const { error } = await supabase.from('service_messages').insert({
      conversation_id: conversationId,
      content,
      sender,
      is_ai_suggested: false,
    });
    if (error) { toast.error('Erro ao enviar'); setSending(false); return; }
    await supabase.from('service_conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: content.slice(0, 100),
    }).eq('id', conversationId);
    setText('');
    setSending(false);
  };

  const handleSuggest = async () => {
    if (!conversationId) return;
    setSuggesting(true);
    try {
      const recent = messages.slice(-10).map(m => ({
        role: m.sender === 'customer' ? 'customer' : 'agent',
        content: m.content,
      }));
      const { data, error } = await supabase.functions.invoke('digital-trends', {
        body: {
          type: 'service_response',
          query: {
            conversation_history: recent,
            platform: 'crm',
            funnel_stage: 'lead',
            contact_name: contactName || 'Cliente',
          },
        },
      });
      if (error) throw error;
      if (data?.success && data?.data?.response) {
        setText(data.data.response);
        toast.success('Sugestão pronta — revise e envie');
      }
    } catch {
      toast.error('Erro ao gerar sugestão');
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="flex flex-col h-[60vh] min-h-[400px]">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2">
            <MessageCircle className="h-8 w-8 opacity-30" />
            <p>Nenhuma mensagem ainda</p>
            <p className="text-[10px] opacity-70">Envie a primeira mensagem ou registre uma recebida</p>
          </div>
        ) : (
          messages.map((m) => {
            const isAgent = m.sender === 'agent';
            const isAi = m.sender === 'ai_suggestion';
            return (
              <div key={m.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    isAgent
                      ? 'bg-primary text-primary-foreground'
                      : isAi
                      ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700'
                      : 'bg-muted'
                  }`}
                >
                  {isAi && <div className="text-[10px] font-semibold mb-1 opacity-70">💡 Sugestão da IA</div>}
                  <div>{m.content}</div>
                  <div className={`text-[10px] mt-1 opacity-60`}>
                    {format(parseISO(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t pt-2 mt-2 space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite uma mensagem..."
          rows={2}
          className="resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSend('agent');
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" onClick={handleSuggest} disabled={suggesting || !conversationId}>
            {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            <span className="ml-1 text-xs">Sugerir IA</span>
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => handleSend('customer')} disabled={sending || !text.trim()} title="Registrar mensagem recebida">
              <span className="text-xs">Recebida</span>
            </Button>
            <Button size="sm" onClick={() => handleSend('agent')} disabled={sending || !text.trim()}>
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              <span className="ml-1 text-xs">Enviar</span>
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Estas mensagens aparecem no Atendimento e no histórico do contato.
        </p>
      </div>
    </div>
  );
}
