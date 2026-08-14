import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ContactTimeline } from '@/components/crm/ContactTimeline';
import { ContactChatPanel } from '@/components/crm/ContactChatPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QuickConversationDialog } from '@/components/crm/QuickConversationDialog';
import { ContactAvatar } from '@/components/crm/ContactAvatar';
import { MergeDuplicatesDialog } from '@/components/crm/MergeDuplicatesDialog';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Search, Zap, MessageCircle, Phone, ExternalLink, Sparkles, Loader2, Merge, Clock, UserCheck, UserMinus, CheckCircle2, RotateCcw, ArrowRight, PanelRight, Archive, X, Tag, ShoppingCart, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContactTags } from '@/hooks/useContactTags';
import { InboxNoteBlock } from '@/components/crm/InboxNoteBlock';
import { InboxSaleDialog } from '@/components/crm/InboxSaleDialog';
import type { Contact } from '@/hooks/useContacts';
import { LeadDetailDrawer } from '@/components/crm/LeadDetailDrawer';

import { openWhatsApp } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { getCrmStageLabel, normalizeCrmStage } from '@/lib/crm/model';
import { useActiveUser } from '@/hooks/useActiveUser';
import { MetaWindowBadge } from '@/components/crm/MetaWindowBadge';
import { AttendanceActionBar } from '@/components/crm/AttendanceActionBar';
import { applyAttendanceOutcome, snoozeAttendance, ATTENDANCE_STATE_LABELS, type AttendanceOutcome } from '@/lib/crm/attendance';
import { compareInboxPriority, getInboxPriority } from '@/lib/crm/inboxPriority';
import { compareCrmPriority, getCrmPriority, type CrmPriorityInput } from '@/lib/crm/priority';

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
  status: string;
  last_inbound_at: string | null;
  return_at: string | null;
  next_action_date: string | null;
  next_contact_date: string | null;
}

type InboxFilter = 'all' | 'today' | 'needs_reply' | 'waiting_customer' | 'overdue' | 'unassigned';

function readAttendanceQueueScope(): string[] {
  try {
    const stored = JSON.parse(sessionStorage.getItem('crm-attendance-queue') || 'null');
    return stored?.source === 'today' && Array.isArray(stored.ids) ? stored.ids : [];
  } catch {
    return [];
  }
}

function toCrmPriorityInput(item: InboxItem): CrmPriorityInput {
  return {
    needs_reply: item.needs_reply,
    status: item.status,
    attendance_state: item.attendance_state,
    return_at: item.return_at,
    next_action_date: item.next_action_date,
    next_contact_date: item.next_contact_date,
    ultimo_contato: item.ultimo_contato,
    last_inbound_at: item.last_inbound_at,
    last_message_at: item.last_date,
    is_lead_or_quote: ['novo_lead', 'contato_realizado', 'proposta_enviada', 'negociacao'].includes(item.funnel_status),
  };
}

export default function ContatosInbox() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeUserId, isLinked } = useActiveUser();
  const deepLinkHandled = useRef<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');
  const [loadLimit, setLoadLimit] = useState(200);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attendanceQueueScope, setAttendanceQueueScope] = useState<string[]>(readAttendanceQueueScope);
  const [quickOpen, setQuickOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [sendConfirmation, setSendConfirmation] = useState(false);
  const [leadPanelOpen, setLeadPanelOpen] = useState(false);
  const [leadEditOpen, setLeadEditOpen] = useState(false);
  const [leadContact, setLeadContact] = useState<Contact | null>(null);
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleDecisionOpen, setSaleDecisionOpen] = useState(false);
  const [saleDecisionBusy, setSaleDecisionBusy] = useState(false);
  const { tags, assignments } = useContactTags();

  // Carrega a ficha do lead para a barra lateral (somente quando visível).
  useEffect(() => {

    if ((!leadPanelOpen && !leadEditOpen) || !selectedId) return;
    let cancelled = false;
    setLeadContact(null);
    void supabase.from('contacts').select('*').eq('id', selectedId).maybeSingle().then(({ data }) => {
      if (!cancelled) setLeadContact(data as Contact | null);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadPanelOpen, leadEditOpen, selectedId]);


  const load = useCallback(async (): Promise<InboxItem[] | null> => {
    setLoading(true);
    // A Caixa de Entrada tem uma única fonte: conversas reais do Atendimento.
    // Contatos sem conversa continuam no CRM, mas não poluem esta fila operacional.
    const { data: conversations, error } = await supabase
      .from('service_conversations')
      .select('id,contact_id,contact_name,contact_handle,contact_avatar_url,last_message_preview,last_message_at,last_inbound_at,return_at,unread_count,needs_reply,attendance_state,assigned_to,funnel_stage,status')
      .not('contact_id', 'is', null)
      .order('last_message_at', { ascending: false })
      .limit(loadLimit);

    if (error) {
      console.error('Erro ao carregar caixa de entrada:', error);
      toast.error('Não foi possível carregar as conversas.');
      setItems([]);
      setLoading(false);
      return null;
    }

    if (!conversations?.length) {
      setItems([]);
      setLoading(false);
      return [];
    }

    const ids = Array.from(new Set(conversations.map((c) => c.contact_id).filter(Boolean))) as string[];
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id,name,whatsapp,phone,photo_url,funnel_status,temperatura_lead,ultimo_contato,next_action_date,next_contact_date,is_active')
      .in('id', ids);
    const contactsById = new Map((contacts || []).map((contact) => [contact.id, contact]));

    const now = Date.now();
    const seenContacts = new Set<string>();
    const merged: InboxItem[] = [];
    for (const conversation of conversations) {
      if (!conversation.contact_id || seenContacts.has(conversation.contact_id)) continue;
      seenContacts.add(conversation.contact_id);
      const contact = contactsById.get(conversation.contact_id);
      if (contact?.is_active === false) continue;
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
        status: conversation.status || 'open',
        last_inbound_at: conversation.last_inbound_at,
        return_at: conversation.return_at,
        next_action_date: contact?.next_action_date || null,
        next_contact_date: contact?.next_contact_date || null,
      });
    }

    setItems(merged);
    setLoading(false);
    return merged;
  }, [loadLimit]);

  useEffect(() => {
    load();
  }, [load]);

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
  }, [load]);

  useEffect(() => {
    const contactId = searchParams.get('contact');
    if (!contactId || deepLinkHandled.current === contactId || !isLinked || !activeUserId) return;
    deepLinkHandled.current = contactId;

    const openAttendance = async () => {
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id,name,whatsapp,phone,mobile,photo_url,funnel_status')
        .eq('id', contactId)
        .maybeSingle();
      if (contactError || !contact) {
        toast.error('Contato não encontrado.');
        return;
      }

      const { data: existing } = await supabase
        .from('service_conversations')
        .select('id')
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const phone = contact.whatsapp || contact.mobile || contact.phone || null;
      const operationalState = {
        assigned_to: activeUserId,
        attendance_state: 'em_atendimento',
        status: 'open',
        resolved_at: null,
        unread_count: 0,
      };
      const result = existing
        ? await supabase.from('service_conversations').update(operationalState).eq('id', existing.id)
        : await supabase.from('service_conversations').insert({
            contact_id: contact.id,
            contact_name: contact.name,
            contact_handle: phone,
            contact_avatar_url: contact.photo_url,
            funnel_stage: normalizeCrmStage(contact.funnel_status),
            channel: 'whatsapp',
            needs_reply: false,
            ...operationalState,
          });

      if (result.error) {
        toast.error('Não foi possível iniciar o atendimento.');
        return;
      }
      await load();
      setSelectedId(contactId);
      setSearchParams({}, { replace: true });
    };

    void openAttendance();
  }, [activeUserId, isLinked, load, searchParams, setSearchParams]);


  const taggedContactIds = useMemo(() => {
    if (tagFilter === 'all') return null;
    return new Set(assignments.filter((a) => a.tag_id === tagFilter).map((a) => a.contact_id));
  }, [assignments, tagFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      const matchesSearch = !q ||
        i.name.toLowerCase().includes(q) ||
        (i.whatsapp || '').includes(q) ||
        (i.phone || '').includes(q) ||
        (i.last_summary || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (taggedContactIds && !taggedContactIds.has(i.id)) return false;
      // Resolvidas não fazem parte da fila operacional; retornos legítimos
      // continuam acessíveis em "Hoje" enquanto tiverem return_at.
      if (inboxFilter !== 'today' && i.status === 'resolved') return false;
      if (inboxFilter === 'today') {
        if (!i.return_at) return false;
        const due = new Date(i.return_at);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        return due <= end;
      }
      if (inboxFilter === 'needs_reply') return i.needs_reply;
      if (inboxFilter === 'waiting_customer') return i.attendance_state === 'aguardando_cliente';
      if (inboxFilter === 'overdue') return i.needs_reply && i.unread_days >= 2;
      if (inboxFilter === 'unassigned') return !i.assigned_to;
      return true;
    });
  }, [items, search, inboxFilter, taggedContactIds]);

  // A prioridade Ã© somente uma camada de apresentaÃ§Ã£o: os filtros continuam
  // definindo quem entra na fila e a regra pura explica a ordem resultante.
  const prioritized = useMemo(() => {
    const now = new Date();
    return [...filtered]
      .map((item) => ({ item, priority: getInboxPriority(item, now) }))
      .sort((a, b) => compareInboxPriority(a.item, b.item, now));
  }, [filtered]);


  const selected = items.find((i) => i.id === selectedId) || null;

  const openConversation = async (item: InboxItem) => {
    setSelectedId(item.id);
    if (item.unread_count > 0) {
      setItems(current => current.map(row => row.id === item.id ? { ...row, unread_count: 0 } : row));
      await supabase.from('service_conversations').update({ unread_count: 0 }).eq('id', item.conversation_id);
    }
  };

  const updateAttendance = async (patch: Record<string, unknown>, successMessage: string) => {
    if (!selected) return;
    const { error } = await supabase.from('service_conversations').update(patch).eq('id', selected.conversation_id);
    if (error) {
      toast.error('Não foi possível atualizar o atendimento.');
      return;
    }
    toast.success(successMessage);
    await load();
  };

  const updateSelectedPhoto = async (photoUrl: string | null) => {
    if (!selected) return;
    try {
      const [{ error: contactError }, { error: conversationError }] = await Promise.all([
        supabase.from('contacts').update({ photo_url: photoUrl, updated_at: new Date().toISOString() }).eq('id', selected.id),
        supabase.from('service_conversations').update({ contact_avatar_url: photoUrl }).eq('contact_id', selected.id),
      ]);
      if (contactError || conversationError) throw contactError || conversationError;
      setItems(current => current.map(item => item.id === selected.id ? { ...item, photo_url: photoUrl } : item));
      setLeadContact(current => current ? { ...current, photo_url: photoUrl || undefined } : current);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível atualizar a foto do lead.');
    }
  };

  const updateLeadContextually = async (contactId: string, updates: Partial<Contact>) => {
    const { error } = await supabase.from('contacts').update({
      ...updates,
      updated_at: new Date().toISOString(),
    } as any).eq('id', contactId);
    if (error) throw error;
    setLeadContact(current => current?.id === contactId ? { ...current, ...updates } : current);
    setItems(current => current.map(item => item.id === contactId ? {
      ...item,
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.whatsapp !== undefined ? { whatsapp: updates.whatsapp || null } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone || null } : {}),
    } : item));
  };

  const archiveSelectedConversation = async () => {
    if (!selected) return;
    const confirmed = window.confirm(`Arquivar a conversa de "${selected.name}"? O contato, histórico e demais vínculos serão preservados.`);
    if (!confirmed) return;
    setAttendanceBusy(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('service_conversations').update({
        status: 'resolved',
        resolved_at: now,
        attendance_state: 'concluido',
        needs_reply: false,
        unread_count: 0,
        return_at: null,
      }).eq('id', selected.conversation_id);
      if (error) throw error;
      setSelectedId(null);
      setLeadPanelOpen(false);
      setLeadEditOpen(false);
      await load();
      toast.success('Conversa arquivada. O contato e o histórico foram preservados.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível arquivar a conversa.');
    } finally { setAttendanceBusy(false); }
  };

  const attendanceQueue = useMemo(() => {
    if (attendanceQueueScope.length === 0) return [];
    const scope = new Set(attendanceQueueScope);
    const now = new Date();
    return items
      .filter((item) => scope.has(item.id) && getCrmPriority(toCrmPriorityInput(item), now).operational)
      .sort((a, b) => compareCrmPriority(toCrmPriorityInput(a), toCrmPriorityInput(b), now));
  }, [attendanceQueueScope, items]);

  const concludeAttendanceQueue = () => {
    setAttendanceQueueScope([]);
    sessionStorage.removeItem('crm-attendance-queue');
    toast.success('Fila de hoje concluída.');
  };

  const nextAttendance = async () => {
    if (!selected || attendanceQueueScope.length === 0) return;

    // A lista salva apenas delimita o escopo inicial. A decisão é feita com os
    // dados recém-carregados, para não reabrir atendimento já concluído ou adiado.
    const refreshedItems = await load();
    if (refreshedItems === null) return;
    const scope = new Set(attendanceQueueScope);
    const now = new Date();
    const next = refreshedItems
      .filter((item) => scope.has(item.id) && item.id !== selected.id && getCrmPriority(toCrmPriorityInput(item), now).operational)
      .sort((a, b) => compareCrmPriority(toCrmPriorityInput(a), toCrmPriorityInput(b), now))[0];

    if (!next) {
      concludeAttendanceQueue();
      return;
    }

    await openConversation(next);
  };

  const registerOutcome = async (outcome: AttendanceOutcome) => {
    if (!selected) return;
    setAttendanceBusy(true);
    try {
      const result = await applyAttendanceOutcome({ contactId: selected.id, conversationId: selected.conversation_id, outcome });
      toast.success(`${result.label}${result.returnAt ? ' · retorno agendado' : ''}`);
      setSendConfirmation(false);
      await nextAttendance();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível registrar o resultado do atendimento.');
    } finally { setAttendanceBusy(false); }
  };

  const snoozeSelected = async (when: number | string) => {
    if (!selected) return;
    setAttendanceBusy(true);
    try {
      await snoozeAttendance({ contactId: selected.id, conversationId: selected.conversation_id, when });
      toast.success('Atendimento adiado e próxima ação atualizada.');
      setSendConfirmation(false);
      await nextAttendance();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível adiar o atendimento.');
    } finally { setAttendanceBusy(false); }
  };

  const concludeSaleAttendance = async () => {
    if (!selected) return;
    setSaleDecisionBusy(true);
    try {
      const result = await applyAttendanceOutcome({
        contactId: selected.id,
        conversationId: selected.conversation_id,
        outcome: 'sale_closed',
        saleAlreadyRecorded: true,
      });
      toast.success(`${result.label} · pós-venda agendado.`);
      setSendConfirmation(false);
      setSaleDecisionOpen(false);
      await load();
    } catch (error) {
      console.error(error);
      toast.error('A venda foi registrada, mas não foi possível concluir o atendimento. Tente novamente ou mantenha a conversa aberta.');
    } finally {
      setSaleDecisionBusy(false);
    }
  };

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
    <div className="h-[calc(100dvh-4rem)] min-h-[560px] overflow-hidden bg-background flex flex-col">
      {/* Header */}
      <div className="z-30 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {([
              ['all', 'Todas'],
              ['today', 'Hoje'],
              ['needs_reply', 'Responder'],
              ['waiting_customer', 'Aguardando resposta'],
              ['overdue', 'Atrasadas'],
              ['unassigned', 'Sem responsável'],
            ] as Array<[InboxFilter, string]>).map(([key, label]) => (
              <Button key={key} size="sm" variant={inboxFilter === key ? 'default' : 'outline'} className="h-7 shrink-0 text-[11px]" onClick={() => setInboxFilter(key)}>
                {label}
              </Button>
            ))}
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="h-7 w-[132px] shrink-0 text-[11px]">
                <div className="flex items-center gap-1 truncate">
                  <Tag className="h-3 w-3" />
                  <SelectValue placeholder="Tag" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todas as tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id} className="text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>
      </div>

      <div className={cn('grid flex-1 min-h-0 gap-0 md:p-2', leadPanelOpen ? 'md:grid-cols-[320px_minmax(0,1fr)_300px]' : 'md:grid-cols-[340px_minmax(0,1fr)]')}>
        {/* Lista */}
        <div className={cn('min-h-0 overflow-y-auto md:border md:rounded-l-lg md:bg-card', selected && 'hidden md:block')}>
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : prioritized.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {search ? 'Nenhum resultado' : 'Nenhuma conversa registrada ainda.'}
              <br />
              <Button size="sm" variant="link" onClick={() => setQuickOpen(true)} className="mt-2">
                Registrar primeira conversa
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {prioritized.map(({ item, priority }) => (
                <button
                  key={item.id}
                  onClick={() => void openConversation(item)}
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
                      {item.attendance_state && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                          {ATTENDANCE_STATE_LABELS[item.attendance_state] || item.attendance_state}
                        </Badge>
                      )}
                      {priority.reason && (
                        <Badge variant={priority.reason === 'Precisa responder' ? 'destructive' : 'secondary'} className="text-[9px] h-4 px-1.5">
                          {priority.reason}
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
                      <MetaWindowBadge lastInboundAt={item.last_inbound_at} compact />
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
        <div className={cn('min-h-0 overflow-hidden md:border-y md:border-r md:bg-card flex flex-col', !selected && 'hidden md:flex')}>
          {!selected ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Selecione um contato para ver a conversa
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Header do contato */}
              <div className="border-b px-3 py-2 flex items-center gap-3 shrink-0 bg-card z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <ContactAvatar name={selected.name} photoUrl={selected.photo_url} size="md" editable onPhotoChange={updateSelectedPhoto} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{selected.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {selected.whatsapp || selected.phone || 'Sem telefone'} · {getCrmStageLabel(selected.funnel_status)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <MetaWindowBadge lastInboundAt={selected.last_inbound_at} className="h-8 px-2 text-[10px]" />
                  {!selected.assigned_to && (
                    <Button size="sm" variant="outline" className="h-8 gap-1" disabled={!isLinked} onClick={() => void updateAttendance({ assigned_to: activeUserId, attendance_state: 'em_atendimento', status: 'open', resolved_at: null }, 'Atendimento assumido.')}>
                      <UserCheck className="h-3.5 w-3.5" /> Assumir
                    </Button>
                  )}
                  {selected.assigned_to && selected.status !== 'resolved' && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void updateAttendance({ assigned_to: null, attendance_state: null }, 'Atendimento liberado para a equipe.')} title="Liberar atendimento">
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                  {selected.status === 'resolved' ? (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void updateAttendance({ status: 'open', resolved_at: null, attendance_state: 'em_atendimento', assigned_to: activeUserId }, 'Atendimento reaberto.')} title="Reabrir atendimento">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void updateAttendance({ status: 'resolved', resolved_at: new Date().toISOString(), attendance_state: 'concluido', needs_reply: false, unread_count: 0 }, 'Atendimento concluído.')} title="Concluir atendimento">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleSummarize(selected.id)}
                    title="Gerar resumo do contato com IA"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSaleOpen(true)} title="Registrar venda deste contato">
                    <ShoppingCart className="h-4 w-4 text-emerald-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={attendanceBusy} onClick={() => void archiveSelectedConversation()} title="Arquivar conversa">
                    <Archive className="h-4 w-4 text-muted-foreground" />
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
                  <Button
                    size="icon"
                    variant={leadPanelOpen ? 'secondary' : 'ghost'}
                    className="h-8 w-8"
                    onClick={() => setLeadPanelOpen((v) => !v)}
                    title={leadPanelOpen ? 'Ocultar detalhes do lead' : 'Mostrar detalhes do lead'}
                  >
                    <PanelRight className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setLeadEditOpen(true)}
                    title="Editar dados do contato sem sair da conversa"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Link to={`/contatos?contact=${selected.id}`}>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Abrir ficha completa">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>

                </div>
              </div>

              {/* Conversa (padrão) + Histórico */}
              <Tabs defaultValue="conversa" className="flex min-h-0 flex-1 flex-col" key={selected.id}>
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
                <TabsContent value="conversa" className="p-3 pt-2 mt-0 min-h-0 flex-1 overflow-hidden flex flex-col">
                  <ContactChatPanel
                    contactId={selected.id}
                    contactName={selected.name}
                    contactHandle={selected.whatsapp || selected.phone}
                    contactAvatar={selected.photo_url}
                    funnelStage={selected.funnel_status}
                    heightClassName="min-h-0 flex-1"
                    onMessageSent={() => setSendConfirmation(true)}
                  />
                  {sendConfirmation && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <span>Mensagem enviada · aguardando resposta · retorno automático em 2 dias.</span>
                      <Button size="sm" variant="ghost" className="h-7 shrink-0 text-[11px]" onClick={() => setSendConfirmation(false)}>Manter</Button>
                    </div>
                  )}
                  <div className="mt-2 space-y-2">
                    <AttendanceActionBar busy={attendanceBusy} onOutcome={registerOutcome} onSnooze={snoozeSelected} />
                    {attendanceQueue.length > 0 && (
                      <div className="flex items-center justify-between rounded-md border px-2 py-1.5 text-[11px]">
                        <span>Fila Hoje · {Math.max(1, attendanceQueue.indexOf(selected.id) + 1)} de {attendanceQueue.length}</span>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" onClick={nextAttendance}>
                          Próximo atendimento <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="historico" className="p-3 pt-2 mt-0 min-h-0 flex-1 overflow-y-auto">
                  <ContactTimeline contactId={selected.id} />
                </TabsContent>
              </Tabs>

            </div>
          )}
        </div>
        {leadPanelOpen && selected && (
          <aside className="hidden md:flex min-h-0 flex-col overflow-hidden border-y border-r rounded-r-lg bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">Detalhes do lead</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLeadPanelOpen(false)} title="Ocultar detalhes"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <ContactAvatar name={selected.name} photoUrl={selected.photo_url} size="lg" editable onPhotoChange={updateSelectedPhoto} />
                <div><div className="font-medium">{selected.name}</div><div className="text-xs text-muted-foreground">{selected.whatsapp || selected.phone || 'Sem telefone'}</div></div>
              </div>
              <div className="grid gap-2 text-xs">
                <div className="rounded-md border p-2"><span className="text-muted-foreground">Etapa comercial</span><div className="mt-0.5 font-medium">{getCrmStageLabel(selected.funnel_status)}</div></div>
                <div className="rounded-md border p-2"><span className="text-muted-foreground">Estado do atendimento</span><div className="mt-0.5 font-medium">{selected.attendance_state ? ATTENDANCE_STATE_LABELS[selected.attendance_state] || selected.attendance_state : 'Sem estado'}</div></div>
                <div className="rounded-md border p-2"><span className="text-muted-foreground">Última interação</span><div className="mt-0.5 font-medium">{formatLastDate(selected.last_date)}</div></div>
              </div>
              <InboxNoteBlock contactId={selected.id} conversationId={selected.conversation_id} onSaved={load} onRegisterSale={() => setSaleOpen(true)} />
              {leadContact && <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">{leadContact.notes || 'Nenhuma observação cadastrada.'}</p>}

              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setLeadEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Editar dados
              </Button>
              <Link to={`/contatos?contact=${selected.id}`} className="block"><Button variant="outline" size="sm" className="w-full gap-2"><ExternalLink className="h-3.5 w-3.5" /> Abrir cadastro completo</Button></Link>
            </div>
          </aside>
        )}
      </div>

      {/* Quick conversation */}

      {selected && (
        <InboxSaleDialog
          open={saleOpen}
          onOpenChange={setSaleOpen}
          contactId={selected.id}
          contactName={selected.name}
          contactHandle={selected.whatsapp || selected.phone}
          onCreated={load}
          onSaleCreated={() => setSaleDecisionOpen(true)}
        />
      )}
      <AlertDialog open={saleDecisionOpen} onOpenChange={setSaleDecisionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Venda registrada com sucesso</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja concluir este atendimento comercial e agendar o pós-venda, ou manter a conversa aberta?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={saleDecisionBusy}>Manter conversa aberta</AlertDialogCancel>
            <AlertDialogAction disabled={saleDecisionBusy} onClick={(event) => {
              event.preventDefault();
              void concludeSaleAttendance();
            }}>
              {saleDecisionBusy ? 'Agendando pós-venda...' : 'Concluir atendimento e agendar pós-venda'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <LeadDetailDrawer
        contact={leadContact}
        open={leadEditOpen}
        onOpenChange={setLeadEditOpen}
        onSave={updateLeadContextually}
        onOpenFull={() => window.open(`/contatos?contact=${selected?.id}`, '_blank', 'noopener,noreferrer')}
      />
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
