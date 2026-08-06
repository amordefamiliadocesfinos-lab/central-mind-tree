import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Send, Sparkles, MessageCircle, AArrowDown, AArrowUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { normalizeCrmStage } from '@/lib/crm/model';

interface Message {
  id: string;
  conversation_id: string;
  sender: 'customer' | 'agent' | 'ai_suggestion';
  content: string;
  is_ai_suggested: boolean;
  created_at: string;
  source: 'mobile' | 'crm' | 'provider' | 'legacy' | null;
  delivery_status: string | null;
  message_type: string;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_caption: string | null;
}

interface ContactChatPanelProps {
  contactId: string;
  contactName?: string | null;
  contactHandle?: string | null;
  contactAvatar?: string | null;
  funnelStage?: string | null;
  /** Classe de altura do painel. Padrão: h-[60vh] min-h-[400px] */
  heightClassName?: string;
  onMessageSent?: (content: string) => void | Promise<void>;
}

const CHAT_FONT_KEY = 'crm-chat-font-size';
const MIN_FONT = 12;
const MAX_FONT = 22;

export function ContactChatPanel({ contactId, contactName, contactHandle, contactAvatar, funnelStage, heightClassName, onMessageSent }: ContactChatPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = Number(localStorage.getItem(CHAT_FONT_KEY));
    return stored >= MIN_FONT && stored <= MAX_FONT ? stored : 14;
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  const changeFont = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(MAX_FONT, Math.max(MIN_FONT, prev + delta));
      localStorage.setItem(CHAT_FONT_KEY, String(next));
      return next;
    });
  };

  // Localiza ou cria a conversa para este contato
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: existing } = await supabase
        .from('service_conversations')
        .select('id,funnel_stage')
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (existing?.id) {
        setConversationId(existing.id);
        const canonicalStage = normalizeCrmStage(funnelStage);
        if (existing.funnel_stage !== canonicalStage) {
          await supabase
            .from('service_conversations')
            .update({ funnel_stage: canonicalStage })
            .eq('id', existing.id);
        }
      } else {
        const { data: created, error } = await supabase
          .from('service_conversations')
          .insert({
            contact_id: contactId,
            contact_name: contactName || null,
            contact_handle: contactHandle || null,
            contact_avatar_url: contactAvatar || null,
            status: 'open',
            funnel_stage: normalizeCrmStage(funnelStage),
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
  }, [contactId, contactName, contactHandle, contactAvatar, funnelStage]);

  // Carrega mensagens e realtime
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('service_messages')
        .select('id, conversation_id, sender, content, is_ai_suggested, created_at, source, delivery_status, message_type, media_url, media_mime_type, media_filename, media_caption')
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

  const handleSend = async () => {
    if (!conversationId || !text.trim()) return;
    setSending(true);
    const content = text.trim();
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { conversation_id: conversationId, message: content },
      });
      const errMsg =
        (data as { error?: string } | null)?.error ??
        (error ? 'Não foi possível enviar a mensagem pelo WhatsApp' : null);
      if (errMsg) {
        toast.error(errMsg);
        return;
      }
      setText('');
      await onMessageSent?.(content);
    } catch {
      toast.error('Não foi possível enviar a mensagem pelo WhatsApp');
    } finally {
      setSending(false);
    }
  };

  // Garante que mensagens enviadas pelo WhatsApp do celular também retornem ao histórico.
  useEffect(() => {
    if (sessionStorage.getItem('whatsapp-sent-by-me-enabled') === 'true') return;
    supabase.functions.invoke('whatsapp-configure', { body: { action: 'enable_sent_by_me' } })
      .then(({ data, error }) => {
        if (!error && data?.ok) sessionStorage.setItem('whatsapp-sent-by-me-enabled', 'true');
      })
      .catch((error) => console.error('Falha ao configurar histórico do WhatsApp:', error));
  }, []);


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
            funnel_stage: normalizeCrmStage(funnelStage),
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
    <div className={`flex flex-col ${heightClassName ?? 'h-[60vh] min-h-[400px]'}`}>
      <div className="flex items-center justify-end gap-1 pb-1">
        <span className="text-[10px] text-muted-foreground mr-1">Tamanho do texto</span>
        <Button
          size="icon"
          variant="outline"
          className="h-6 w-6"
          onClick={() => changeFont(-1)}
          disabled={fontSize <= MIN_FONT}
          aria-label="Diminuir tamanho do texto das mensagens"
        >
          <AArrowDown className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-6 w-6"
          onClick={() => changeFont(1)}
          disabled={fontSize >= MAX_FONT}
          aria-label="Aumentar tamanho do texto das mensagens"
        >
          <AArrowUp className="h-3 w-3" />
        </Button>
      </div>
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
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.45 }}
                  className={`max-w-[80%] rounded-lg px-3 py-2 whitespace-pre-wrap ${
                    isAgent
                      ? 'bg-primary text-primary-foreground'
                      : isAi
                      ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700'
                      : 'bg-muted'
                  }`}
                >

                  {isAi && <div className="text-[10px] font-semibold mb-1 opacity-70">💡 Sugestão da IA</div>}
                  {m.media_url && m.message_type === 'image' && (
                    <a href={m.media_url} target="_blank" rel="noreferrer" className="block mb-1">
                      <img src={m.media_url} alt={m.media_caption || 'Imagem recebida'} className="max-h-72 rounded-md object-contain" loading="lazy" />
                    </a>
                  )}
                  {m.media_url && m.message_type === 'audio' && (
                    <audio controls preload="metadata" className="mb-1 max-w-full" src={m.media_url}>
                      Seu navegador não conseguiu reproduzir este áudio.
                    </audio>
                  )}
                  {m.media_url && m.message_type === 'video' && (
                    <video controls preload="metadata" className="mb-1 max-h-72 max-w-full rounded-md" src={m.media_url} />
                  )}
                  {m.media_url && !['image', 'audio', 'video'].includes(m.message_type) && (
                    <a href={m.media_url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-1 underline underline-offset-2">
                      <FileText className="h-4 w-4" /> {m.media_filename || 'Abrir anexo'}
                    </a>
                  )}
                  {(!m.media_url || Boolean(m.media_caption)) && <div>{m.media_caption || m.content}</div>}
                  {isAgent && (
                    <div className="text-[9px] mt-1 opacity-70">
                      {m.source === 'mobile'
                        ? 'Enviado pelo celular'
                        : m.source === 'crm'
                        ? 'Enviado pelo CRM'
                        : 'Enviado pelo WhatsApp'}
                      {m.delivery_status === 'failed' ? ' · Falhou' : m.delivery_status === 'pending' ? ' · Enviando' : ''}
                    </div>
                  )}
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

      <div className="border-t pt-2 mt-2 space-y-2 bg-background/95">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite uma mensagem…"
          rows={2}
          className="resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" onClick={handleSuggest} disabled={suggesting || !conversationId}>
            {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            <span className="ml-1 text-xs">Sugerir IA</span>
          </Button>
          <Button size="sm" onClick={handleSend} disabled={sending || !text.trim() || !conversationId}>
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            <span className="ml-1 text-xs">Enviar</span>
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Enter envia · Shift+Enter quebra linha · enviado pelo WhatsApp e registrado no Atendimento.
        </p>

      </div>
    </div>
  );
}
