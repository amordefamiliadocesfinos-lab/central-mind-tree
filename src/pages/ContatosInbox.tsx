import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ContactTimeline } from '@/components/crm/ContactTimeline';
import { ContactChatPanel } from '@/components/crm/ContactChatPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QuickConversationDialog } from '@/components/crm/QuickConversationDialog';
import { ContactAvatar } from '@/components/crm/ContactAvatar';
import { MergeDuplicatesDialog } from '@/components/crm/MergeDuplicatesDialog';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Search, Zap, MessageCircle, Phone, ExternalLink, Sparkles, Loader2, Merge, Clock } from 'lucide-react';
import { openWhatsApp } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { getCrmStageLabel, normalizeCrmStage } from '@/lib/crm/model';

interface InboxItem {
  id: string;
  conversation_id: string;
  name: string;
  whatsapp: string | null;
  phone: string | null;
  photo_url: string | null;
  funnel_status: string;
  temperatura_lead: string | null;
  ultimo_contato: string | null;
  last_summary: string | null;
  last_date: string | null;
  unread_days: number;
  unread_count: number;
  needs_reply: boolean;
  attendance_state: string | null;
  assigned_to: string | null;
}

type InboxFilter = 'all' | 'needs_reply' | 'waiting_customer' | 'overdue' | 'unassigned';

export default function ContatosInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');
  const [loadLimit, setLoadLimit] = useState(200);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    // A Caixa de Entrada tem uma única fonte: conversas reais do Atendimento.
    // Contatos sem conversa continuam no CRM, mas não poluem esta fila operacional.
    const { data: conversations, error } = await supabase
      .from('service_conversations')
      .select('id,contact_id,contact_name,contact_handle,contact_avatar_url,last_message_preview,last_message_at,unread_count,needs_reply,attendance_state,assigned_to,funnel_stage,status')
      .not('contact_id', 'is', null)
      .order('last_message_at', { ascending: false })
      .limit(loadLimit);

    if (error) {
      console.error('Erro ao carregar caixa de entrada:', error);
      toast.error('Não foi possível carregar as conversas.');
      setItems([]);
      setLoading(false);
      return;
    }

    if (!conversations?.length) {
      setItems([]);
      setLoading(false);
      return;
    }

    const ids = Array.from(new Set(conversations.map((c) => c.contact_id).filter(Boolean))) as string[];
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id,name,whatsapp,phone,photo_url,funnel_status,temperatura_lead,ultimo_contato')
      .in('id', ids);
    const contactsById = new Map((contacts || []).map((contact) => [contact.id, contact]));

    const now = Date.now();
    const seenContacts = new Set<string>();
    const merged: InboxItem[] = [];
    for (const conversation of conversations) {
      if (!conversation.contact_id || seenContacts.has(conversation.contact_id)) continue;
      seenContacts.add(conversation.contact_id);
      const contact = contactsById.get(conversation.contact_id);
      const lastDate = conversation.last_message_at || null;
      const unreadDays = lastDate
        ? Math.floor((now - new Date(lastDate).getTime()) / 86400000)
        : 999;
      merged.push({
        id: conversation.contact_id,
        conversation_id: conversation.id,
        name: contact?.name || conversation.contact_name || 'Sem nome',
        whatsapp: contact?.whatsapp || conversation.contact_handle,
        phone: contact?.phone || null,
        photo_url: contact?.photo_url || conversation.contact_avatar_url,
        funnel_status: normalizeCrmStage(contact?.funnel_status || conversation.funnel_stage),
        temperatura_lead: contact?.temperatura_lead || null,
        ultimo_contato: contact?.ultimo_contato || null,
        last_summary: conversation.last_message_preview || null,
        last_date: lastDate,
        unread_days: unreadDays,
        unread_count: conversation.unread_count,
        needs_reply: conversation.needs_reply,
        attendance_state: conversation.attendance_state,
        assigned_to: conversation.assigned_to,
      });
    }

    setItems(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [loadLimit]);

  // Realtime: nova mensagem atualiza preview/ordenação sem recarregar a página
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        load();
      }, 600);
    };
    const channel = supabase
      .channel('crm-inbox-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_messages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_conversations' }, refresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      const matchesSearch = !q ||
        i.name.toLowerCase().includes(q) ||
        (i.whatsapp || '').includes(q) ||
        (i.phone || '').includes(q) ||
        (i.last_summary || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (inboxFilter === 'needs_reply') return i.needs_reply;
      if (inboxFilter === 'waiting_customer') return i.attendance_state === 'aguardando_cliente';
      if (inboxFilter === 'overdue') return i.needs_reply && i.unread_days >= 2;
      if (inboxFilter === 'unassigned') return !i.assigned_to;
      return true;
    });
  }, [items, search, inboxFilter]);

  const selected = items.find((i) => i.id === selectedId) || null;

  const handleSummarize = async (contactId: string) => {
    setSummaryLoading(true);
    setSummary('');
    setSummaryOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke('contact-summary', {
        body: { contact_id: contactId },
      });
      if (error) throw error;
      const result = data as { error?: string; summary?: string } | null;
      if (result?.error) {
        toast.error(result.error);
        setSummaryOpen(false);
        return;
      }
      setSummary(result?.summary || 'Sem resumo gerado.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar resumo. Verifique seus créditos de IA.');
      setSummaryOpen(false);
    } finally {
      setSummaryLoading(false);
    }
  };

  const formatLastDate = (d: string | null) => {
    if (!d) return 'Sem interações';
    try {
      return formatDistanceToNow(parseISO(d), { addSuffix: true, locale: ptBR });
    } catch {
      return d;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 p-3">
          <Link to="/contatos">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-base font-semibold flex-1">Caixa de Entrada</h1>
          <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)} className="gap-1.5 h-8" title="Mesclar contatos duplicados">
            <Merge className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Duplicados</span>
          </Button>
          <Button size="sm" onClick={() => setQuickOpen(true)} className="gap-1.5 h-8">
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Registrar conversa</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contato ou conversa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {([
              ['all', 'Todas'],
              ['needs_reply', 'Responder'],
              ['waiting_customer', 'Aguardando cliente'],
              ['overdue', 'Atrasadas'],
              ['unassigned', 'Sem responsável'],
            ] as Array<[InboxFilter, string]>).map(([key, label]) => (
              <Button key={key} size="sm" variant={inboxFilter === key ? 'default' : 'outline'} className="h-7 shrink-0 text-[11px]" onClick={() => setInboxFilter(key)}>
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[380px_1fr] gap-0 md:gap-4 md:p-4">
        {/* Lista */}
        <div className={cn('md:border md:rounded-lg md:bg-card', selected && 'hidden md:block')}>
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {search ? 'Nenhum resultado' : 'Nenhuma conversa registrada ainda.'}
              <br />
              <Button size="sm" variant="link" onClick={() => setQuickOpen(true)} className="mt-2">
                Registrar primeira conversa
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'w-full text-left p-3 hover:bg-muted/50 transition-colors flex gap-3 items-start',
                    selectedId === item.id && 'bg-muted',
                  )}
                >
                  <ContactAvatar name={item.name} photoUrl={item.photo_url} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-sm truncate">{item.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatLastDate(item.last_date)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {item.last_summary || 'Sem interações'}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                        {getCrmStageLabel(item.funnel_status)}
                      </Badge>
                      {item.needs_reply && (
                        <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                          Responder
                        </Badge>
                      )}
                      {item.unread_count > 0 && (
                        <Badge className="text-[9px] h-4 min-w-4 px-1.5">
                          {item.unread_count}
                        </Badge>
                      )}
                      {item.last_date && item.unread_days > 7 && (
                        <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                          {item.unread_days}d sem contato
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {items.length >= loadLimit && (
                <div className="p-3 text-center">
                  <Button variant="outline" size="sm" onClick={() => setLoadLimit(limit => limit + 200)}>Carregar mais conversas</Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Painel detalhe */}
        <div className={cn('md:border md:rounded-lg md:bg-card', !selected && 'hidden md:block')}>
          {!selected ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Selecione um contato para ver a conversa
            </div>
          ) : (
            <div>
              {/* Header do contato */}
              <div className="border-b p-3 flex items-center gap-3 sticky top-[105px] bg-card z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <ContactAvatar name={selected.name} photoUrl={selected.photo_url} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{selected.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {selected.whatsapp || selected.phone || 'Sem telefone'} · {getCrmStageLabel(selected.funnel_status)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleSummarize(selected.id)}
                    title="Gerar resumo do contato com IA"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={!selected.whatsapp && !selected.phone}
                    onClick={() => openWhatsApp(selected.whatsapp || selected.phone || '')}
                    title="Abrir WhatsApp"
                  >
                    <Phone className="h-4 w-4 text-green-600" />
                  </Button>
                  <Link to={`/contatos?contact=${selected.id}`}>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Abrir ficha completa">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Conversa (padrão) + Histórico */}
              <Tabs defaultValue="conversa" className="w-full" key={selected.id}>
                <div className="px-3 pt-2">
                  <TabsList className="h-8">
                    <TabsTrigger value="conversa" className="text-xs h-6 gap-1">
                      <MessageCircle className="h-3 w-3" /> Conversa
                    </TabsTrigger>
                    <TabsTrigger value="historico" className="text-xs h-6 gap-1">
                      <Clock className="h-3 w-3" /> Histórico
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="conversa" className="p-3 pt-2 mt-0">
                  <ContactChatPanel
                    contactId={selected.id}
                    contactName={selected.name}
                    contactHandle={selected.whatsapp || selected.phone}
                    contactAvatar={selected.photo_url}
                    funnelStage={selected.funnel_status}
                    heightClassName="h-[calc(100dvh-320px)] min-h-[340px]"
                  />
                </TabsContent>
                <TabsContent value="historico" className="p-3 pt-2 mt-0">
                  <ContactTimeline contactId={selected.id} />
                </TabsContent>
              </Tabs>

            </div>
          )}
        </div>
      </div>

      {/* Quick conversation */}
      <MergeDuplicatesDialog open={mergeOpen} onOpenChange={setMergeOpen} onMerged={load} />
      <QuickConversationDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        initialContactId={selected?.id}
        onSaved={() => load()}
      />

      {/* Summary modal */}
      {summaryOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !summaryLoading && setSummaryOpen(false)}
        >
          <Card
            className="max-w-lg w-full max-h-[80vh] overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Resumo IA do contato</h2>
            </div>
            {summaryLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Analisando histórico e gerando briefing...
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button size="sm" variant="outline" onClick={() => setSummaryOpen(false)} disabled={summaryLoading}>
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
