import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  MessageCircle,
  ShoppingCart,
  LayoutGrid,
  List,
  Triangle,
  ArrowRight,
  Filter,
  UserPlus,
  Users,
  FileText,
  Handshake,
  DollarSign,
  Flame,
  Snowflake,
  Sun,
  Clock,
  TrendingUp,
  History,
  Tag,
  ArrowUpDown,
  CalendarClock,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Thermometer,
  Phone,
  Lightbulb,
  Send,
} from 'lucide-react';
import { useContacts, Contact } from '@/hooks/useContacts';
import { useContactHistory } from '@/hooks/useContactHistory';
import { useContactsWithOrders } from '@/hooks/useContactsWithOrders';
import { useNoResponseDetection } from '@/hooks/useNoResponseDetection';
import { useContactChecklist } from '@/hooks/useContactChecklist';
import { useDailyMetrics } from '@/hooks/useDailyMetrics';
import { useLeadScore } from '@/hooks/useLeadScore';
import { useContactTags } from '@/hooks/useContactTags';
import { ContactFormDialog } from '@/components/financial/ContactFormDialog';
import { WhatsAppMessageSelector } from '@/components/crm/WhatsAppMessageSelector';
import { ContactOrderHistory } from '@/components/financial/ContactOrderHistory';
import { ContactHistoryDialog } from '@/components/ContactHistoryDialog';
import { ContactTagsManager } from '@/components/crm/ContactTagsManager';
import { ContactActivitiesPanel } from '@/components/crm/ContactActivitiesPanel';
import { LeadsNeedContactPanel } from '@/components/crm/LeadsNeedContactPanel';
import { cn } from '@/lib/utils';
import { FunnelView } from '@/components/FunnelView';
import { ContactAvatar } from '@/components/crm/ContactAvatar';
import { ContactCard } from '@/components/crm/ContactCard';
import { differenceInDays, parseISO, format, isSameDay, isBefore, startOfDay } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { openWhatsApp } from '@/lib/whatsapp';

const FUNNEL_STAGES = [
  { key: 'novo_lead', label: 'Novo Lead', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50/80 border-blue-200', headerBg: 'bg-gradient-to-r from-blue-500 to-blue-400' },
  { key: 'contato_realizado', label: 'Contato Realizado', color: 'bg-cyan-500', textColor: 'text-cyan-700', bgLight: 'bg-cyan-50/80 border-cyan-200', headerBg: 'bg-gradient-to-r from-cyan-500 to-cyan-400' },
  { key: 'proposta_enviada', label: 'Proposta Enviada', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50/80 border-amber-200', headerBg: 'bg-gradient-to-r from-amber-500 to-amber-400' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50/80 border-orange-200', headerBg: 'bg-gradient-to-r from-orange-500 to-orange-400' },
  { key: 'fechado', label: 'Fechado', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50/80 border-green-200', headerBg: 'bg-gradient-to-r from-green-500 to-green-400' },
  { key: 'perdido', label: 'Perdido', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50/80 border-red-200', headerBg: 'bg-gradient-to-r from-red-500 to-red-400' },
];

const SALES_FUNNEL_STAGES = [
  { key: 'orcamento', label: 'Orçamento', emoji: '🟡', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50/80 border-yellow-200', headerBg: 'bg-gradient-to-r from-yellow-500 to-yellow-400' },
  { key: 'em_atendimento', label: 'Em atendimento', emoji: '🔵', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50/80 border-blue-200', headerBg: 'bg-gradient-to-r from-blue-500 to-blue-400' },
  { key: 'cliente_ativo', label: 'Cliente ativo', emoji: '🟢', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50/80 border-green-200', headerBg: 'bg-gradient-to-r from-green-500 to-green-400' },
  { key: 'inativo', label: 'Inativo', emoji: '🔴', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50/80 border-red-200', headerBg: 'bg-gradient-to-r from-red-500 to-red-400' },
];

const PRIORITY_CONFIG = {
  quente: { label: 'Alta', borderColor: 'border-l-red-400' },
  morno: { label: 'Média', borderColor: 'border-l-amber-400' },
  frio: { label: 'Baixa', borderColor: 'border-l-sky-400' },
};

const URGENCY_LEVELS = {
  urgente: { label: 'Urgente', emoji: '🔴', className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700', borderColor: 'border-l-red-500', ringClass: 'ring-1 ring-red-300 dark:ring-red-700' },
  medio: { label: 'Médio', emoji: '🟡', className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700', borderColor: 'border-l-amber-400', ringClass: '' },
  baixo: { label: 'Baixo', emoji: '🔵', className: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700', borderColor: 'border-l-sky-300', ringClass: '' },
};

const TEMP_CONFIG = {
  frio: { label: 'Frio', icon: Snowflake, className: 'bg-sky-100 text-sky-700 border-sky-300', dot: 'bg-sky-500' },
  morno: { label: 'Morno', icon: Sun, className: 'bg-amber-100 text-amber-700 border-amber-300', dot: 'bg-amber-500' },
  quente: { label: 'Quente', icon: Flame, className: 'bg-red-100 text-red-700 border-red-300', dot: 'bg-red-500' },
};

const CONTACT_SUBTYPE_CONFIG: Record<string, { label: string; className: string }> = {
  revendedor: { label: 'Revendedor', className: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  cliente_final: { label: 'Cliente Final', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  atacado: { label: 'Atacado', className: 'bg-violet-100 text-violet-700 border-violet-300' },
};

const CLIENT_CLASSIFICATION_CONFIG: Record<string, { label: string; emoji: string; className: string }> = {
  vip: { label: 'VIP', emoji: '🟢', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  alto_potencial: { label: 'Alto Potencial', emoji: '🔵', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  medio: { label: 'Médio', emoji: '🟡', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  baixo_potencial: { label: 'Baixo Potencial', emoji: '⚪', className: 'bg-gray-100 text-gray-600 border-gray-300' },
};

function getUltimoContatoAlert(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    const days = differenceInDays(new Date(), parseISO(dateStr));
    if (days > 7) return { label: `${days}d`, className: 'text-red-600 bg-red-50 border-red-200', urgent: true };
    if (days > 3) return { label: `${days}d`, className: 'text-amber-600 bg-amber-50 border-amber-200', urgent: false };
    return { label: `${days}d`, className: 'text-muted-foreground bg-muted', urgent: false };
  } catch { return null; }
}

function getNextContactStatus(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr);
    const now = new Date();
    const today = startOfDay(now);
    const targetDay = startOfDay(d);
    if (isSameDay(d, now)) return { label: 'Hoje', className: 'text-amber-700 bg-amber-100 border-amber-300', isToday: true, isOverdue: false };
    if (isBefore(targetDay, today)) {
      const days = differenceInDays(today, targetDay);
      return { label: `${days}d atraso`, className: 'text-red-700 bg-red-100 border-red-300', isToday: false, isOverdue: true };
    }
    return { label: format(d, 'dd/MM'), className: 'text-blue-700 bg-blue-100 border-blue-300', isToday: false, isOverdue: false };
  } catch { return null; }
}

function formatCurrencyShort(v?: number | null) {
  if (!v) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type SortField = 'name' | 'valor_estimado' | 'ultimo_contato' | 'created_at' | 'temperatura' | 'score';
type SortDir = 'asc' | 'desc';

export default function Contatos() {
  const navigate = useNavigate();
  const { contacts, loading, createContact, updateContact, deleteContact } = useContacts();
  const { addEntry } = useContactHistory();
  const { getTagsForContact } = useContactTags();
  const { hasOrders } = useContactsWithOrders();
  const { getNoResponseInfo, refreshNoResponse } = useNoResponseDetection();
  const { getScore } = useLeadScore(contacts, getNoResponseInfo, hasOrders);
  const contactIds = useMemo(() => contacts.filter(c => c.is_active).map(c => c.id), [contacts]);
  const { checklistMap, refetchChecklists } = useContactChecklist(contactIds);
  const { dailyMetrics, refetchDaily } = useDailyMetrics();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tempFilter, setTempFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [contactDateFilter, setContactDateFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'funnel' | 'list' | 'sales_funnel'>('kanban');
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineContact, setTimelineContact] = useState<Contact | null>(null);
  const [tagsManagerOpen, setTagsManagerOpen] = useState(false);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [activitiesContact, setActivitiesContact] = useState<Contact | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Drag state
  const [draggedContact, setDraggedContact] = useState<Contact | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Helper: is next action overdue?
  const isNextActionOverdue = useCallback((contact: Contact) => {
    if (!contact.next_action_date) return false;
    try { return new Date() > parseISO(contact.next_action_date); } catch { return false; }
  }, []);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (!c.is_active) return false;
      if (statusFilter !== 'all' && c.funnel_status !== statusFilter) return false;
      if (tempFilter !== 'all' && c.temperatura_lead !== tempFilter) return false;
      if (typeFilter !== 'all') {
        if (typeFilter === 'cliente' && c.type !== 'cliente' && c.type !== 'ambos') return false;
        if (typeFilter === 'fornecedor' && c.type !== 'fornecedor' && c.type !== 'ambos') return false;
      }
      if (tagFilter !== 'all') {
        const contactTags = getTagsForContact(c.id);
        if (!contactTags.some(t => t.id === tagFilter)) return false;
      }
      if (actionFilter === 'hoje') {
        if (!c.next_action_date) return false;
        try { if (!isSameDay(parseISO(c.next_action_date), new Date())) return false; } catch { return false; }
      }
      if (actionFilter === 'atrasados') {
        if (!c.next_action_date || !isNextActionOverdue(c)) return false;
      }
      if (actionFilter === 'sem_acao') {
        if (c.next_action_text || c.next_action_date) return false;
      }
      // Próximo Contato filters
      if (classificationFilter !== 'all' && c.client_classification !== classificationFilter) return false;
      if (contactDateFilter === 'hoje_contato') {
        if (!c.next_contact_date) return false;
        try {
          const d = parseISO(c.next_contact_date);
          const today = startOfDay(new Date());
          if (!isSameDay(d, new Date()) && !isBefore(startOfDay(d), today)) return false;
        } catch { return false; }
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.name?.toLowerCase().includes(q) ||
          c.fantasy_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.whatsapp?.toLowerCase().includes(q) ||
          c.document?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.notes?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [contacts, searchQuery, statusFilter, tempFilter, typeFilter, tagFilter, actionFilter, contactDateFilter, classificationFilter, getTagsForContact, isNextActionOverdue]);

  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      let cmp = 0;
      const tempOrder: Record<string, number> = { quente: 3, morno: 2, frio: 1 };
      if (sortField === 'name') cmp = (a.name || '').localeCompare(b.name || '');
      else if (sortField === 'valor_estimado') cmp = (a.valor_estimado || 0) - (b.valor_estimado || 0);
      else if (sortField === 'ultimo_contato') cmp = (a.ultimo_contato || '').localeCompare(b.ultimo_contato || '');
      else if (sortField === 'created_at') cmp = (a.created_at || '').localeCompare(b.created_at || '');
      else if (sortField === 'temperatura') cmp = (tempOrder[a.temperatura_lead || 'morno'] || 2) - (tempOrder[b.temperatura_lead || 'morno'] || 2);
      else if (sortField === 'score') cmp = getScore(a.id).score - getScore(b.id).score;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredContacts, sortField, sortDir, getScore]);

  // Urgency scoring shared between sort and display
  const tempScore: Record<string, number> = { quente: 30, morno: 20, frio: 10 };
  const classScore: Record<string, number> = { vip: 4, alto_potencial: 3, medio: 2, baixo_potencial: 1 };
  const noResponseScoreMap: Record<string, number> = { follow_up_urgente: 80, sem_resposta: 60, lead_esfriando: 40 };

  const getUrgencyScore = useCallback((c: Contact): number => {
    let score = 0;
    const now = new Date();
    const today = startOfDay(now);
    score += tempScore[c.temperatura_lead || 'morno'] || 20;
    const actionOverdue = c.next_action_date && isBefore(startOfDay(parseISO(c.next_action_date)), today);
    const contactOverdue = c.next_contact_date && isBefore(startOfDay(parseISO(c.next_contact_date)), today);
    if (actionOverdue || contactOverdue) score += 100;
    const actionToday = c.next_action_date && isSameDay(parseISO(c.next_action_date), now);
    const contactToday = c.next_contact_date && isSameDay(parseISO(c.next_contact_date), now);
    if (actionToday || contactToday) score += 50;
    const nrInfo = getNoResponseInfo(c.id);
    if (nrInfo) score += noResponseScoreMap[nrInfo.status!] || 0;
    if (c.ultimo_contato) {
      const days = differenceInDays(now, parseISO(c.ultimo_contato));
      if (days > 7) score += 15;
      else if (days > 3) score += 5;
    }
    score += (classScore[c.client_classification || ''] || 0) * 2;
    if (c.valor_estimado && c.valor_estimado > 0) score += Math.min(c.valor_estimado / 1000, 5);
    return score;
  }, [getNoResponseInfo]);

  const getUrgencyLevel = useCallback((contact: Contact): keyof typeof URGENCY_LEVELS => {
    const score = getUrgencyScore(contact);
    // Urgente: quente + sem resposta, or very high score (overdue + hot)
    const isHot = contact.temperatura_lead === 'quente';
    const nrInfo = getNoResponseInfo(contact.id);
    if (isHot && nrInfo) return 'urgente';
    if (score >= 100) return 'urgente';
    if (score >= 40) return 'medio';
    return 'baixo';
  }, [getUrgencyScore, getNoResponseInfo]);

  // Priority sort: overdue > hot+today > hot > warm+overdue > warm > cold > rest
  const prioritySortContacts = useCallback((list: Contact[]) => {
    return [...list].sort((a, b) => {
      const ua = getUrgencyScore(a);
      const ub = getUrgencyScore(b);
      if (ua !== ub) return ub - ua;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [getUrgencyScore]);

  const groupedByStage = useMemo(() => {
    const groups: Record<string, Contact[]> = {};
    FUNNEL_STAGES.forEach(s => { groups[s.key] = []; });
    filteredContacts.forEach(c => {
      const key = c.funnel_status || 'novo_lead';
      if (groups[key]) groups[key].push(c);
      else groups['novo_lead'].push(c);
    });
    Object.keys(groups).forEach(key => {
      groups[key] = prioritySortContacts(groups[key]);
    });
    return groups;
  }, [filteredContacts, prioritySortContacts]);

  const stageSums = useMemo(() => {
    const sums: Record<string, number> = {};
    FUNNEL_STAGES.forEach(s => {
      sums[s.key] = (groupedByStage[s.key] || []).reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
    });
    return sums;
  }, [groupedByStage]);

  const groupedBySalesFunnel = useMemo(() => {
    const groups: Record<string, Contact[]> = {};
    SALES_FUNNEL_STAGES.forEach(s => { groups[s.key] = []; });
    filteredContacts.forEach(c => {
      const key = c.contact_type || 'orcamento';
      if (groups[key]) groups[key].push(c);
      else groups['orcamento'].push(c);
    });
    Object.keys(groups).forEach(key => {
      groups[key] = prioritySortContacts(groups[key]);
    });
    return groups;
  }, [filteredContacts, prioritySortContacts]);

  const salesFunnelSums = useMemo(() => {
    const sums: Record<string, number> = {};
    SALES_FUNNEL_STAGES.forEach(s => {
      sums[s.key] = (groupedBySalesFunnel[s.key] || []).reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
    });
    return sums;
  }, [groupedBySalesFunnel]);

  const metrics = useMemo(() => {
    const active = contacts.filter(c => c.is_active);
    const clientesAtivos = active.filter(c => c.contact_type === 'cliente_ativo');
    const orcamentos = active.filter(c => c.contact_type === 'orcamento');
    const followUpHoje = active.filter(c => {
      if (!c.next_contact_date) return false;
      try {
        const d = parseISO(c.next_contact_date);
        const today = startOfDay(new Date());
        return isSameDay(d, new Date()) || isBefore(startOfDay(d), today);
      } catch { return false; }
    });
    const propostas = active.filter(c => c.funnel_status === 'proposta_enviada');
    const negociacao = active.filter(c => c.funnel_status === 'negociacao');
    const fechados = active.filter(c => c.funnel_status === 'fechado');
    const openStages = ['novo_lead', 'contato_realizado', 'proposta_enviada', 'negociacao'];
    const valorAberto = active
      .filter(c => openStages.includes(c.funnel_status))
      .reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
    const totalLeads = active.filter(c => c.funnel_status !== 'perdido').length;
    const conversionRate = totalLeads > 0 ? Math.round((fechados.length / totalLeads) * 100) : 0;
    return { total: active.length, propostas: propostas.length, negociacao: negociacao.length, fechados: fechados.length, valorAberto, conversionRate, clientesAtivos: clientesAtivos.length, orcamentos: orcamentos.length, followUpHoje: followUpHoje.length };
  }, [contacts]);

  const handleSave = async (data: Partial<Contact>) => {
    if (editingContact) {
      // Detect follow-up changes
      const oldAction = editingContact.next_action_date || '';
      const newAction = (data.next_action_date as string) || '';
      const oldContact = editingContact.next_contact_date || '';
      const newContact2 = (data.next_contact_date as string) || '';

      await updateContact(editingContact.id, data);

      // Log next_action_date changes
      if (newAction && newAction !== oldAction) {
        const dateStr = (() => { try { return format(parseISO(newAction), "dd/MM 'às' HH:mm"); } catch { return ''; } })();
        const desc = oldAction
          ? `Follow-up atualizado para ${dateStr}`
          : `Follow-up agendado para ${dateStr}`;
        await addEntry(editingContact.id, 'follow_up', desc, new Date().toISOString());
      }

      // Log next_contact_date changes
      if (newContact2 && newContact2 !== oldContact) {
        const dateStr = (() => { try { return format(parseISO(newContact2), "dd/MM 'às' HH:mm"); } catch { return ''; } })();
        const desc = oldContact
          ? `Próximo contato atualizado para ${dateStr}`
          : `Próximo contato agendado para ${dateStr}`;
        await addEntry(editingContact.id, 'follow_up', desc, new Date().toISOString());
      }
    } else {
      const newContact = await createContact(data);
      if (newContact?.id) {
        await addEntry(newContact.id, 'lead_criado', 'Lead criado', new Date().toISOString());
      }
    }
    setFormOpen(false);
    setEditingContact(undefined);
  };

  const handleStatusChange = async (contact: Contact, newStatus: string) => {
    const oldStage = FUNNEL_STAGES.find(s => s.key === contact.funnel_status);
    const newStage = FUNNEL_STAGES.find(s => s.key === newStatus);
    const updates: Partial<Contact> = { funnel_status: newStatus };
    if (newStatus === 'fechado' && contact.funnel_status !== 'fechado') {
      updates.converted_at = new Date().toISOString();
      await addEntry(contact.id, 'conversion', `Negócio Fechado!`, new Date().toISOString());
      toast.success('🎉 Negócio fechado!');
    } else {
      await addEntry(contact.id, 'stage_change', `Movido de "${oldStage?.label || contact.funnel_status}" para "${newStage?.label || newStatus}"`, new Date().toISOString());
    }
    await updateContact(contact.id, updates);
  };

  const [whatsAppContact, setWhatsAppContact] = useState<Contact | null>(null);

  const handleWhatsApp = (contact: Contact) => {
    const phone = contact.whatsapp || contact.mobile || contact.phone;
    if (phone) {
      setWhatsAppContact(contact);
    }
  };

  const handleWhatsAppSend = async (message: string, templateLabel: string) => {
    if (!whatsAppContact) return;
    const phone = whatsAppContact.whatsapp || whatsAppContact.mobile || whatsAppContact.phone;
    if (phone) {
      const now = new Date().toISOString();
      await addEntry(whatsAppContact.id, 'whatsapp', `💬 Mensagem iniciada via WhatsApp (${templateLabel})`, now);
      openWhatsApp(phone, message);
      setTimeout(() => { refreshNoResponse(); refetchChecklists(); refetchDaily(); }, 500);
    }
    setWhatsAppContact(null);
  };

  const handleTempChange = async (contact: Contact, newTemp: string) => {
    if (contact.temperatura_lead === newTemp) return;
    const oldLabel = TEMP_CONFIG[contact.temperatura_lead as keyof typeof TEMP_CONFIG]?.label || contact.temperatura_lead;
    const newLabel = TEMP_CONFIG[newTemp as keyof typeof TEMP_CONFIG]?.label || newTemp;
    await addEntry(contact.id, 'stage_change', `Temperatura alterada de "${oldLabel}" para "${newLabel}"`, new Date().toISOString());
    await updateContact(contact.id, { temperatura_lead: newTemp });
    toast.success(`Temperatura alterada para ${newLabel}`);
  };

  const handleConfirmDelete = async () => {
    if (contactToDelete) {
      await deleteContact(contactToDelete.id);
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, contact: Contact) => {
    setDraggedContact(contact);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', contact.id);
  };

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageKey);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedContact && draggedContact.funnel_status !== stageKey) {
      await handleStatusChange(draggedContact, stageKey);
    }
    setDraggedContact(null);
  };

  const handleSalesFunnelDrop = async (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (draggedContact && draggedContact.contact_type !== stageKey) {
      const oldLabel = SALES_FUNNEL_STAGES.find(s => s.key === draggedContact.contact_type)?.label || draggedContact.contact_type || 'Sem tipo';
      const newLabel = SALES_FUNNEL_STAGES.find(s => s.key === stageKey)?.label || stageKey;
      await addEntry(draggedContact.id, 'stage_change', `Tipo alterado de "${oldLabel}" para "${newLabel}"`, new Date().toISOString());
      await updateContact(draggedContact.id, { contact_type: stageKey });
      toast.success(`Movido para ${newLabel}`);
    }
    setDraggedContact(null);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  const TempBadge = ({ temp }: { temp?: string }) => {
    const cfg = TEMP_CONFIG[(temp || 'morno') as keyof typeof TEMP_CONFIG] || TEMP_CONFIG.morno;
    const Icon = cfg.icon;
    return (
      <span className={cn('inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', cfg.className)}>
        <Icon className="h-2.5 w-2.5" />
        {cfg.label}
      </span>
    );
  };

  const FOLLOW_UP_LABELS: Record<string, string> = {
    mensagem: 'Mensagem', ligacao: 'Ligação', whatsapp: 'WhatsApp', reuniao: 'Reunião',
  };

  const getSmartMessage = useCallback((contact: Contact): { message: string; approach: string } => {
    const nrInfo = getNoResponseInfo(contact.id);
    const isClient = hasOrders(contact.id) || contact.contact_type === 'cliente_ativo';

    if (isClient) {
      return {
        message: `Olá${contact.name ? `, ${contact.name.split(' ')[0]}` : ''}! Tudo bem?\nEstamos com produção aberta essa semana, deseja fazer um novo pedido? 😊`,
        approach: 'Reativação de cliente ativo',
      };
    }

    if (nrInfo) {
      if (nrInfo.status === 'lead_esfriando' || nrInfo.status === 'follow_up_urgente') {
        return {
          message: `Olá${contact.name ? `, ${contact.name.split(' ')[0]}` : ''}! Tudo bem?\nQueria saber se ainda tem interesse, posso te ajudar a finalizar 😊`,
          approach: `Follow-up urgente (${nrInfo.daysSince}d sem resposta)`,
        };
      }
      if (nrInfo.status === 'sem_resposta') {
        return {
          message: `Oi${contact.name ? `, ${contact.name.split(' ')[0]}` : ''}! Tudo bem?\nSó passando para saber se conseguiu analisar o que conversamos 😊`,
          approach: `Follow-up leve (${nrInfo.daysSince}d sem resposta)`,
        };
      }
    }

    return {
      message: `Olá${contact.name ? `, ${contact.name.split(' ')[0]}` : ''}! Tudo bem?\nEstou entrando em contato para entender melhor seu pedido 😊`,
      approach: 'Primeiro contato / Lead novo',
    };
  }, [getNoResponseInfo, hasOrders]);

  const handleSmartAttend = useCallback(async (contact: Contact) => {
    const phone = contact.whatsapp || contact.mobile || contact.phone;
    if (!phone) return;

    const { message, approach } = getSmartMessage(contact);
    const now = new Date().toISOString();

    // Log to timeline
    await addEntry(contact.id, 'whatsapp', `⚡ Atendimento iniciado via ação inteligente · ${approach}`, now);

    // Update último contato
    await updateContact(contact.id, { ultimo_contato: now.split('T')[0] });

    // Open WhatsApp (helper detecta mobile/desktop)
    openWhatsApp(phone, message);

    // Refresh data
    setTimeout(() => { refreshNoResponse(); refetchChecklists(); refetchDaily(); }, 500);
    toast.success(`⚡ Atendimento inteligente: ${approach}`);
  }, [getSmartMessage, addEntry, updateContact, refreshNoResponse, refetchChecklists, refetchDaily]);

  const handleCreateOrder = useCallback((contact: Contact) => {
    const params = new URLSearchParams({
      tab: 'orders',
      newOrder: 'true',
      contactId: contact.id,
      contactName: contact.name || '',
      contactPhone: contact.phone || contact.whatsapp || contact.mobile || '',
      contactEmail: contact.email || '',
      ...(contact.notes ? { contactNotes: contact.notes } : {}),
    });
    navigate(`/operacoes?${params.toString()}`);
  }, [navigate]);

  const renderContactCard = useCallback((contact: Contact) => {
    const noResponseInfo = getNoResponseInfo(contact.id);
    const scoreInfo = getScore(contact.id);
    const phone = contact.whatsapp || contact.mobile || contact.phone;

    return (
      <ContactCard
        key={contact.id}
        contact={contact}
        urgencyLevel={getUrgencyLevel(contact)}
        noResponseInfo={noResponseInfo}
        hasOrders={hasOrders(contact.id)}
        checklistData={checklistMap[contact.id]}
        scoreInfo={scoreInfo}
        isDragged={draggedContact?.id === contact.id}
        hasPhone={!!phone}
        onEdit={() => { setEditingContact(contact); setFormOpen(true); }}
        onWhatsApp={() => handleWhatsApp(contact)}
        onViewOrders={() => { setHistoryContact(contact); setHistoryOpen(true); }}
        onViewHistory={() => { setTimelineContact(contact); setTimelineOpen(true); }}
        onViewActivities={() => { setActivitiesContact(contact); setActivitiesOpen(true); }}
        onCreateOrder={() => handleCreateOrder(contact)}
        onDelete={() => { setContactToDelete(contact); setDeleteDialogOpen(true); }}
        onTempChange={(temp) => handleTempChange(contact, temp)}
        onDragStart={(e) => handleDragStart(e, contact)}
        onFollowUp={async (type, note) => {
          const now = new Date().toISOString();
          const desc = `[${FOLLOW_UP_LABELS[type] || type}] ${note}`;
          await addEntry(contact.id, type, desc, now);
          setTimeout(() => { refreshNoResponse(); refetchChecklists(); refetchDaily(); }, 500);
        }}
        onSendSuggestion={async () => {
          if (!phone || !noResponseInfo) return;
          const now = new Date().toISOString();
          await addEntry(contact.id, 'whatsapp', `💬 Follow-up enviado automaticamente (sugerido pelo sistema · ${noResponseInfo.suggestedLabel})`, now);
          openWhatsApp(phone, noResponseInfo.suggestedMessage);
          setTimeout(() => { refreshNoResponse(); refetchChecklists(); refetchDaily(); }, 500);
        }}
        onSmartAttend={async () => handleSmartAttend(contact)}
      />
    );
  }, [getUrgencyLevel, getNoResponseInfo, getScore, hasOrders, checklistMap, draggedContact, handleWhatsApp, handleTempChange, addEntry, refreshNoResponse, refetchChecklists, refetchDaily, handleSmartAttend]);

  const { tags } = useContactTags();

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Contatos
          </h1>
          <div className="flex items-center gap-2">
            <Link to="/contatos/inbox">
              <Button variant="outline" size="sm" className="gap-1">
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Caixa de entrada</span>
                <span className="sm:hidden">Inbox</span>
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => setTagsManagerOpen(true)}>
              <Tag className="h-3.5 w-3.5 mr-1" />
              Tags
            </Button>
            <Button onClick={() => { setEditingContact(undefined); setFormOpen(true); }} size="sm" className="bg-green-600 hover:bg-green-700 shadow-sm">
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </div>
        </div>

        {/* Indicadores do CRM */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="p-2.5 text-center border-0 shadow-sm bg-card">
            <Users className="h-4 w-4 mx-auto text-muted-foreground mb-0.5" />
            <p className="text-xl font-bold leading-tight">{metrics.total}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Total de Contatos</p>
          </Card>
          <Card className="p-2.5 text-center border-0 shadow-sm bg-green-50 dark:bg-green-950/30">
            <UserPlus className="h-4 w-4 mx-auto text-green-600 mb-0.5" />
            <p className="text-xl font-bold text-green-700 dark:text-green-400 leading-tight">{metrics.clientesAtivos}</p>
            <p className="text-[10px] text-green-600 dark:text-green-500 font-medium">Clientes Ativos</p>
          </Card>
          <Card className="p-2.5 text-center border-0 shadow-sm bg-yellow-50 dark:bg-yellow-950/30">
            <FileText className="h-4 w-4 mx-auto text-yellow-600 mb-0.5" />
            <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400 leading-tight">{metrics.orcamentos}</p>
            <p className="text-[10px] text-yellow-600 dark:text-yellow-500 font-medium">Orçamentos</p>
          </Card>
          <Card className={cn(
            "p-2.5 text-center border-0 shadow-sm",
            metrics.followUpHoje > 0 ? "bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800" : "bg-muted/50"
          )}>
            <CalendarClock className={cn("h-4 w-4 mx-auto mb-0.5", metrics.followUpHoje > 0 ? "text-red-600" : "text-muted-foreground")} />
            <p className={cn("text-xl font-bold leading-tight", metrics.followUpHoje > 0 ? "text-red-700 dark:text-red-400" : "")}>{metrics.followUpHoje}</p>
            <p className={cn("text-[10px] font-medium", metrics.followUpHoje > 0 ? "text-red-600 dark:text-red-500" : "text-muted-foreground")}>Follow-up Hoje</p>
          </Card>
        </div>

        {/* Indicadores do dia */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="p-2 text-center border-0 shadow-sm bg-blue-50/60 dark:bg-blue-950/20">
            <Users className="h-3.5 w-3.5 mx-auto text-blue-600 mb-0.5" />
            <p className="text-lg font-bold text-blue-700 dark:text-blue-400 leading-tight">{dailyMetrics.contactsAttended}</p>
            <p className="text-[9px] text-blue-600 dark:text-blue-500 font-medium">Atendidos hoje</p>
          </Card>
          <Card className="p-2 text-center border-0 shadow-sm bg-green-50/60 dark:bg-green-950/20">
            <MessageCircle className="h-3.5 w-3.5 mx-auto text-green-600 mb-0.5" />
            <p className="text-lg font-bold text-green-700 dark:text-green-400 leading-tight">{dailyMetrics.messagesSent}</p>
            <p className="text-[9px] text-green-600 dark:text-green-500 font-medium">Mensagens enviadas</p>
          </Card>
          <Card className="p-2 text-center border-0 shadow-sm bg-purple-50/60 dark:bg-purple-950/20">
            <ArrowRight className="h-3.5 w-3.5 mx-auto text-purple-600 mb-0.5" />
            <p className="text-lg font-bold text-purple-700 dark:text-purple-400 leading-tight">{dailyMetrics.responsesReceived}</p>
            <p className="text-[9px] text-purple-600 dark:text-purple-500 font-medium">Respostas recebidas</p>
          </Card>
          <Card className="p-2 text-center border-0 shadow-sm bg-emerald-50/60 dark:bg-emerald-950/20">
            <ShoppingCart className="h-3.5 w-3.5 mx-auto text-emerald-600 mb-0.5" />
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 leading-tight">{dailyMetrics.ordersGenerated}</p>
            <p className="text-[9px] text-emerald-600 dark:text-emerald-500 font-medium">Pedidos gerados</p>
          </Card>
        </div>

        <LeadsNeedContactPanel
          contacts={contacts}
          onOpenContact={(contact) => {
            setEditingContact(contact);
            setFormOpen(true);
          }}
          onWhatsApp={handleWhatsApp}
          getUrgencyLevel={getUrgencyLevel}
        />

        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[140px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome, telefone, cidade, notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-muted/50"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="cliente">Clientes</SelectItem>
              <SelectItem value="fornecedor">Fornecedores</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {FUNNEL_STAGES.map(s => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={classificationFilter} onValueChange={setClassificationFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Classificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas classif.</SelectItem>
              {Object.entries(CLIENT_CLASSIFICATION_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-1.5">{cfg.emoji} {cfg.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {tags.length > 0 && (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas tags</SelectItem>
                {tags.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Temperature filter chips */}
          <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
            {[
              { value: 'all', label: 'Todos', icon: null },
              { value: 'frio', label: 'Frio', icon: Snowflake },
              { value: 'morno', label: 'Morno', icon: Sun },
              { value: 'quente', label: 'Quente', icon: Flame },
            ].map(opt => {
              const Icon = opt.icon;
              return (
                <Button
                  key={opt.value}
                  variant={tempFilter === opt.value ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    "h-7 px-2.5 text-xs rounded-md",
                    tempFilter === opt.value && "shadow-sm"
                  )}
                  onClick={() => setTempFilter(opt.value)}
                >
                  {Icon && <Icon className="h-3 w-3 mr-0.5" />}
                  {opt.label}
                </Button>
              );
            })}
          </div>

          {/* Action quick filters */}
          <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'hoje', label: '📅 Hoje' },
              { value: 'atrasados', label: '⚠ Atrasados' },
              { value: 'sem_acao', label: 'Sem ação' },
            ].map(opt => (
              <Button
                key={opt.value}
                variant={actionFilter === opt.value ? 'default' : 'ghost'}
                size="sm"
                className={cn("h-7 px-2.5 text-xs rounded-md", actionFilter === opt.value && "shadow-sm")}
                onClick={() => setActionFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {/* Próximo Contato filter */}
          <Button
            variant={contactDateFilter === 'hoje_contato' ? 'default' : 'outline'}
            size="sm"
            className={cn(
              "h-7 px-2.5 text-xs",
              contactDateFilter === 'hoje_contato' && "bg-blue-600 hover:bg-blue-700 shadow-sm"
            )}
            onClick={() => setContactDateFilter(prev => prev === 'hoje_contato' ? 'all' : 'hoje_contato')}
          >
            <Phone className="h-3 w-3 mr-1" />
            Contatos p/ Hoje
            {(() => {
              const count = contacts.filter(c => {
                if (!c.is_active || !c.next_contact_date) return false;
                try {
                  const d = parseISO(c.next_contact_date);
                  const today = startOfDay(new Date());
                  return isSameDay(d, new Date()) || isBefore(startOfDay(d), today);
                } catch { return false; }
              }).length;
              return count > 0 ? <Badge className="ml-1 h-4 px-1 text-[9px] bg-red-500 text-white border-0">{count}</Badge> : null;
            })()}
          </Button>

          {/* Sort selector */}
          <Select value={`${sortField}-${sortDir}`} onValueChange={(v) => {
            const [f, d] = v.split('-') as [SortField, SortDir];
            setSortField(f);
            setSortDir(d);
          }}>
            <SelectTrigger className="w-40 h-9">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Nome A→Z</SelectItem>
              <SelectItem value="name-desc">Nome Z→A</SelectItem>
              <SelectItem value="temperatura-desc">Temp. ↑ Quente</SelectItem>
              <SelectItem value="temperatura-asc">Temp. ↓ Frio</SelectItem>
              <SelectItem value="ultimo_contato-asc">Últ. Contato ↑ Antigo</SelectItem>
              <SelectItem value="ultimo_contato-desc">Últ. Contato ↓ Recente</SelectItem>
              <SelectItem value="valor_estimado-desc">Valor ↓ Maior</SelectItem>
              <SelectItem value="score-desc">Score ↓ Maior</SelectItem>
              <SelectItem value="created_at-desc">Mais recente</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex border rounded-lg ml-auto overflow-hidden">
            <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-none" onClick={() => setViewMode('kanban')} title="Kanban">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'sales_funnel' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-none border-x" onClick={() => setViewMode('sales_funnel')} title="Funil de Vendas">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'funnel' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-none border-r" onClick={() => setViewMode('funnel')} title="Análise Funil">
              <Triangle className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-none" onClick={() => setViewMode('list')} title="Lista">
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {FUNNEL_STAGES.map((stage) => {
              const stageContacts = groupedByStage[stage.key] || [];
              const stageSum = stageSums[stage.key];
              const isDragOver = dragOverStage === stage.key;
              return (
                <div
                  key={stage.key}
                  className="min-w-[200px]"
                  onDragOver={(e) => handleDragOver(e, stage.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage.key)}
                >
                  {/* Stage header */}
                  <div className={cn(
                    "rounded-xl p-2.5 mb-2 transition-all",
                    isDragOver ? "ring-2 ring-primary ring-offset-1 shadow-lg" : "",
                    stage.headerBg,
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white drop-shadow-sm">{stage.label}</span>
                      <Badge className="bg-white/30 text-white border-0 text-xs h-5 px-1.5 font-bold backdrop-blur-sm">
                        {stageContacts.length}
                      </Badge>
                    </div>
                    {stageSum > 0 && (
                      <p className="text-[11px] font-bold text-white/90 mt-1 drop-shadow-sm">
                        {formatCurrencyShort(stageSum)}
                      </p>
                    )}
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white/60 transition-all"
                        style={{ width: `${Math.min(100, (stageContacts.length / Math.max(filteredContacts.length, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className={cn(
                    "space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto rounded-lg transition-colors p-0.5",
                    isDragOver && "bg-primary/5"
                  )}>
                    <AnimatePresence>
                      {stageContacts.map(contact => renderContactCard(contact))}
                    </AnimatePresence>
                    {stageContacts.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8 opacity-60">
                        {isDragOver ? "Soltar aqui" : "Nenhum contato"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'sales_funnel' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SALES_FUNNEL_STAGES.map((stage) => {
              const stageContacts = groupedBySalesFunnel[stage.key] || [];
              const stageSum = salesFunnelSums[stage.key];
              const isDragOver = dragOverStage === stage.key;
              return (
                <div
                  key={stage.key}
                  className="min-w-[200px]"
                  onDragOver={(e) => handleDragOver(e, stage.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleSalesFunnelDrop(e, stage.key)}
                >
                  <div className={cn(
                    "rounded-xl p-2.5 mb-2 transition-all",
                    isDragOver ? "ring-2 ring-primary ring-offset-1 shadow-lg" : "",
                    stage.headerBg,
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white drop-shadow-sm">{stage.emoji} {stage.label}</span>
                      <Badge className="bg-white/30 text-white border-0 text-xs h-5 px-1.5 font-bold backdrop-blur-sm">
                        {stageContacts.length}
                      </Badge>
                    </div>
                    {stageSum > 0 && (
                      <p className="text-[11px] font-bold text-white/90 mt-1 drop-shadow-sm">
                        {formatCurrencyShort(stageSum)}
                      </p>
                    )}
                    <div className="mt-1.5 h-1 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white/60 transition-all"
                        style={{ width: `${Math.min(100, (stageContacts.length / Math.max(filteredContacts.length, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className={cn(
                    "space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto rounded-lg transition-colors p-0.5",
                    isDragOver && "bg-primary/5"
                  )}>
                    <AnimatePresence>
                      {stageContacts.map(contact => renderContactCard(contact))}
                    </AnimatePresence>
                    {stageContacts.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8 opacity-60">
                        {isDragOver ? "Soltar aqui" : "Nenhum contato"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'funnel' ? (
          <FunnelView contacts={contacts} />
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                    <div className="flex items-center">Nome <SortIcon field="name" /></div>
                  </TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('temperatura')}>
                    <div className="flex items-center">Temp. <SortIcon field="temperatura" /></div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('valor_estimado')}>
                    <div className="flex items-center">Valor Est. <SortIcon field="valor_estimado" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('ultimo_contato')}>
                    <div className="flex items-center">Últ. Contato <SortIcon field="ultimo_contato" /></div>
                  </TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Resposta</TableHead>
                  <TableHead>Próxima Ação</TableHead>
                  <TableHead>Próx. Contato</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center text-muted-foreground py-12">
                      Nenhum contato encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedContacts.map((contact) => {
                    const alert = getUltimoContatoAlert(contact.ultimo_contato);
                    const contactTags = getTagsForContact(contact.id);
                    return (
                      <TableRow key={contact.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ContactAvatar photoUrl={contact.photo_url} name={contact.name} size="sm" />
                            <div>
                              <span className="text-primary hover:underline cursor-pointer font-medium" onClick={() => { setEditingContact(contact); setFormOpen(true); }}>
                                {contact.name}
                              </span>
                              {contact.fantasy_name && <p className="text-xs text-muted-foreground">{contact.fantasy_name}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const ul = getUrgencyLevel(contact);
                            const ucfg = URGENCY_LEVELS[ul];
                            return (
                              <span className={cn('inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', ucfg.className)}>
                                {ucfg.emoji} {ucfg.label}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {contact.client_classification && CLIENT_CLASSIFICATION_CONFIG[contact.client_classification] ? (
                            <span className={cn('inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', CLIENT_CLASSIFICATION_CONFIG[contact.client_classification].className)}>
                              {CLIENT_CLASSIFICATION_CONFIG[contact.client_classification].emoji} {CLIENT_CLASSIFICATION_CONFIG[contact.client_classification].label}
                            </span>
                          ) : <span className="text-muted-foreground text-xs">-</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {contact.type === 'ambos' ? 'Ambos' : contact.type === 'fornecedor' ? 'Fornecedor' : 'Cliente'}
                          </Badge>
                          {hasOrders(contact.id) && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-400 dark:border-green-700">
                              <ShoppingCart className="h-2.5 w-2.5" />
                              Cliente
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select value={contact.temperatura_lead || 'morno'} onValueChange={(v) => handleTempChange(contact, v)}>
                            <SelectTrigger className="h-7 text-xs w-28 border-0 bg-transparent p-0 shadow-none">
                              <TempBadge temp={contact.temperatura_lead} />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(TEMP_CONFIG).map(([key, cfg]) => {
                                const Icon = cfg.icon;
                                return (
                                  <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-1.5">
                                      <Icon className="h-3 w-3" />
                                      {cfg.label}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={contact.funnel_status || 'novo_lead'} onValueChange={(v) => handleStatusChange(contact, v)}>
                            <SelectTrigger className="h-7 text-xs w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FUNNEL_STAGES.map(s => (
                                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrencyShort(contact.valor_estimado) || '-'}</TableCell>
                        <TableCell>
                          {alert ? (
                            <span className={cn('text-xs font-medium rounded px-1.5 py-0.5 border', alert.className)}>{alert.label}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const si = getScore(contact.id);
                            return (
                              <span className={cn('inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold', si.className)}>
                                {si.emoji} {si.score}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const nrInfo = getNoResponseInfo(contact.id);
                            if (!nrInfo) return <span className="text-muted-foreground text-xs">-</span>;
                            return (
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  'text-[10px] font-semibold rounded-full px-1.5 py-0.5 border inline-flex items-center gap-0.5',
                                  nrInfo.status === 'follow_up_urgente' && 'bg-red-100 text-red-700 border-red-300',
                                  nrInfo.status === 'sem_resposta' && 'bg-amber-100 text-amber-700 border-amber-300',
                                  nrInfo.status === 'lead_esfriando' && 'bg-sky-100 text-sky-700 border-sky-300',
                                )}>
                                  {nrInfo.emoji} {nrInfo.daysSince}d
                                </span>
                                {(contact.whatsapp || contact.mobile || contact.phone) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    title="Enviar sugestão via WhatsApp"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const phone = contact.whatsapp || contact.mobile || contact.phone;
                                      if (!phone) return;
                                      const now = new Date().toISOString();
                                      await addEntry(contact.id, 'whatsapp', `💬 Follow-up enviado automaticamente (sugerido pelo sistema · ${nrInfo.suggestedLabel})`, now);
                                      openWhatsApp(phone, nrInfo.suggestedMessage);
                                      setTimeout(() => { refreshNoResponse(); refetchChecklists(); refetchDaily(); }, 500);
                                    }}
                                  >
                                    <Send className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {contact.next_action_text || contact.next_action_date ? (
                            <div className={cn("text-xs", isNextActionOverdue(contact) && "text-red-600 font-semibold")}>
                              {isNextActionOverdue(contact) && <AlertTriangle className="h-3 w-3 inline mr-0.5 -mt-0.5" />}
                              {contact.next_action_text && <span className="block truncate max-w-[120px]">{contact.next_action_text}</span>}
                              {contact.next_action_date && (
                                <span className="text-[10px] text-muted-foreground">
                                  {(() => { try { return format(parseISO(contact.next_action_date), "dd/MM HH:mm"); } catch { return '-'; } })()}
                                </span>
                              )}
                            </div>
                          ) : <span className="text-muted-foreground text-xs">-</span>}
                        </TableCell>
                        <TableCell>
                          {contact.next_contact_date ? (() => {
                            const ncs = getNextContactStatus(contact.next_contact_date);
                            if (!ncs) return <span className="text-muted-foreground text-xs">-</span>;
                            const timeStr = (() => { try { return format(parseISO(contact.next_contact_date), "dd/MM HH:mm"); } catch { return ''; } })();
                            return (
                              <span className={cn("text-[10px] font-semibold rounded px-1.5 py-0.5 border inline-flex items-center gap-1", ncs.className)}>
                                {ncs.isOverdue && <AlertTriangle className="h-3 w-3" />}
                                <Phone className="h-3 w-3" />
                                {timeStr}
                              </span>
                            );
                          })() : <span className="text-muted-foreground text-xs">-</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 flex-wrap">
                            {contactTags.slice(0, 2).map(tag => (
                              <span key={tag.id} className="text-[9px] font-medium rounded-full px-1.5 py-0.5 text-white" style={{ backgroundColor: tag.color }}>
                                {tag.name}
                              </span>
                            ))}
                            {contactTags.length > 2 && <span className="text-[9px] text-muted-foreground">+{contactTags.length - 2}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{contact.origem_lead || '-'}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingContact(contact); setFormOpen(true); }}>
                                <Edit className="h-3.5 w-3.5 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setActivitiesContact(contact); setActivitiesOpen(true); }}>
                                <CalendarClock className="h-3.5 w-3.5 mr-2" />
                                Atividades
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setTimelineContact(contact); setTimelineOpen(true); }}>
                                <History className="h-3.5 w-3.5 mr-2" />
                                Timeline
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setHistoryContact(contact); setHistoryOpen(true); }}>
                                <ShoppingCart className="h-3.5 w-3.5 mr-2" />
                                Pedidos
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Temperatura</div>
                              {Object.entries(TEMP_CONFIG).filter(([key]) => key !== contact.temperatura_lead).map(([key, cfg]) => {
                                const Icon = cfg.icon;
                                return (
                                  <DropdownMenuItem key={key} onClick={() => handleTempChange(contact, key)}>
                                    <Icon className="h-3.5 w-3.5 mr-2" />
                                    {cfg.label}
                                  </DropdownMenuItem>
                                );
                              })}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setContactToDelete(contact); setDeleteDialogOpen(true); }} className="text-destructive">
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <ContactFormDialog open={formOpen} onOpenChange={setFormOpen} contact={editingContact} onSave={handleSave} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{contactToDelete?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ContactOrderHistory open={historyOpen} onOpenChange={setHistoryOpen} contact={historyContact} />

      <ContactHistoryDialog
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        contactId={timelineContact?.id || null}
        contactName={timelineContact?.name || ''}
      />

      <ContactTagsManager open={tagsManagerOpen} onOpenChange={setTagsManagerOpen} />

      <ContactActivitiesPanel
        open={activitiesOpen}
        onOpenChange={setActivitiesOpen}
        contact={activitiesContact}
      />

      <WhatsAppMessageSelector
        open={!!whatsAppContact}
        onOpenChange={(open) => { if (!open) setWhatsAppContact(null); }}
        contactName={whatsAppContact?.name || ''}
        funnelStatus={whatsAppContact?.funnel_status || ''}
        onSend={handleWhatsAppSend}
      />
    </div>
  );
}
