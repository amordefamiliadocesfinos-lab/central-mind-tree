import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ContactTimeline } from '@/components/crm/ContactTimeline';
import { QuickConversationDialog } from '@/components/crm/QuickConversationDialog';
import { ContactAvatar } from '@/components/crm/ContactAvatar';
import { MergeDuplicatesDialog } from '@/components/crm/MergeDuplicatesDialog';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Search, Zap, MessageCircle, Phone, ExternalLink, Sparkles, Loader2, Merge, Inbox } from 'lucide-react';
import { openWhatsApp } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface InboxItem {
  id: string;
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
}

const FUNNEL_LABEL: Record<string, string> = {
  novo_lead: 'Novo Lead',
  em_contato: 'Em Contato',
  qualificado: 'Qualificado',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  convertido: 'Convertido',
  perdido: 'Perdido',
};

export default function ContatosInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [openConvs, setOpenConvs] = useState<Array<{
    id: string; contact_id: string | null; contact_name: string | null;
    contact_avatar_url: string | null; last_message_preview: string | null;
    last_message_at: string; unread_count: number; platform_id: string | null;
    contact?: { name: string; photo_url: string | null; client_classification: string | null } | null;
  }>>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    // Pega contatos ativos + última interação de cada um
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id,name,whatsapp,phone,photo_url,funnel_status,temperatura_lead,ultimo_contato')
      .eq('is_active', true)
      .order('ultimo_contato', { ascending: false, nullsFirst: false })
      .limit(200);

    if (!contacts?.length) {
      setItems([]);
      setLoading(false);
      return;
    }

    const ids = contacts.map((c) => c.id);
    const { data: history } = await supabase
      .from('contact_history')
      .select('contact_id,description,interaction_date,created_at')
      .in('contact_id', ids)
      .order('interaction_date', { ascending: false });

    const byContact = new Map<string, { description: string; date: string }>();
    for (const h of history || []) {
      if (!byContact.has(h.contact_id)) {
        byContact.set(h.contact_id, {
          description: h.description,
          date: h.interaction_date || h.created_at,
        });
      }
    }

    const now = Date.now();
    const merged: InboxItem[] = contacts.map((c) => {
      const last = byContact.get(c.id);
      const lastDate = last?.date || null;
      const unreadDays = lastDate
        ? Math.floor((now - new Date(lastDate).getTime()) / 86400000)
        : 999;
      return {
        ...c,
        last_summary: last?.description || null,
        last_date: lastDate,
        unread_days: unreadDays,
      };
    });

    // Ordena: quem tem conversa mais recente primeiro; quem nunca conversou no fim
    merged.sort((a, b) => {
      if (!a.last_date && !b.last_date) return 0;
      if (!a.last_date) return 1;
      if (!b.last_date) return -1;
      return new Date(b.last_date).getTime() - new Date(a.last_date).getTime();
    });

    setItems(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.whatsapp || '').includes(q) ||
        (i.phone || '').includes(q) ||
        (i.last_summary || '').toLowerCase().includes(q),
    );
  }, [items, search]);

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
      if ((data as any)?.error) {
        toast.error((data as any).error);
        setSummaryOpen(false);
        return;
      }
      setSummary((data as any)?.summary || 'Sem resumo gerado.');
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
                        {FUNNEL_LABEL[item.funnel_status] || item.funnel_status}
                      </Badge>
                      {item.last_date && item.unread_days > 7 && (
                        <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                          {item.unread_days}d sem contato
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
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
                    {selected.whatsapp || selected.phone || 'Sem telefone'} · {FUNNEL_LABEL[selected.funnel_status] || selected.funnel_status}
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

              {/* Timeline */}
              <div className="p-3">
                <ContactTimeline contactId={selected.id} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick conversation */}
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
