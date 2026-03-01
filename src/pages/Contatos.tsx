import { useState, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { useContacts, Contact } from '@/hooks/useContacts';
import { useContactHistory } from '@/hooks/useContactHistory';
import { useContactTags } from '@/hooks/useContactTags';
import { ContactFormDialog } from '@/components/financial/ContactFormDialog';
import { ContactOrderHistory } from '@/components/financial/ContactOrderHistory';
import { ContactHistoryDialog } from '@/components/ContactHistoryDialog';
import { ContactTagsManager } from '@/components/crm/ContactTagsManager';
import { ContactActivitiesPanel } from '@/components/crm/ContactActivitiesPanel';
import { cn } from '@/lib/utils';
import { FunnelView } from '@/components/FunnelView';
import { differenceInDays, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const FUNNEL_STAGES = [
  { key: 'novo_lead', label: 'Novo Lead', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50/80 border-blue-200', headerBg: 'bg-gradient-to-r from-blue-500 to-blue-400' },
  { key: 'orcamento_enviado', label: 'Orçamento Enviado', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50/80 border-amber-200', headerBg: 'bg-gradient-to-r from-amber-500 to-amber-400' },
  { key: 'em_negociacao', label: 'Em Negociação', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50/80 border-orange-200', headerBg: 'bg-gradient-to-r from-orange-500 to-orange-400' },
  { key: 'cliente', label: 'Cliente', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50/80 border-green-200', headerBg: 'bg-gradient-to-r from-green-500 to-green-400' },
  { key: 'pos_venda', label: 'Pós-venda', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50/80 border-purple-200', headerBg: 'bg-gradient-to-r from-purple-500 to-purple-400' },
  { key: 'perdido', label: 'Perdido', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50/80 border-red-200', headerBg: 'bg-gradient-to-r from-red-500 to-red-400' },
];

const TEMP_CONFIG = {
  frio: { label: 'Frio', icon: Snowflake, className: 'bg-sky-100 text-sky-700 border-sky-300', dot: 'bg-sky-500' },
  morno: { label: 'Morno', icon: Sun, className: 'bg-amber-100 text-amber-700 border-amber-300', dot: 'bg-amber-500' },
  quente: { label: 'Quente', icon: Flame, className: 'bg-red-100 text-red-700 border-red-300', dot: 'bg-red-500' },
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

function formatCurrencyShort(v?: number | null) {
  if (!v) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type SortField = 'name' | 'valor_estimado' | 'ultimo_contato' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function Contatos() {
  const { contacts, loading, createContact, updateContact, deleteContact } = useContacts();
  const { addEntry } = useContactHistory();
  const { getTagsForContact } = useContactTags();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tempFilter, setTempFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'funnel' | 'list'>('kanban');
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
  }, [contacts, searchQuery, statusFilter, tempFilter, typeFilter, tagFilter, getTagsForContact]);

  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = (a.name || '').localeCompare(b.name || '');
      else if (sortField === 'valor_estimado') cmp = (a.valor_estimado || 0) - (b.valor_estimado || 0);
      else if (sortField === 'ultimo_contato') cmp = (a.ultimo_contato || '').localeCompare(b.ultimo_contato || '');
      else if (sortField === 'created_at') cmp = (a.created_at || '').localeCompare(b.created_at || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredContacts, sortField, sortDir]);

  const groupedByStage = useMemo(() => {
    const groups: Record<string, Contact[]> = {};
    FUNNEL_STAGES.forEach(s => { groups[s.key] = []; });
    filteredContacts.forEach(c => {
      const key = c.funnel_status || 'novo_lead';
      if (groups[key]) groups[key].push(c);
      else groups['novo_lead'].push(c);
    });
    return groups;
  }, [filteredContacts]);

  const stageSums = useMemo(() => {
    const sums: Record<string, number> = {};
    FUNNEL_STAGES.forEach(s => {
      sums[s.key] = (groupedByStage[s.key] || []).reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
    });
    return sums;
  }, [groupedByStage]);

  const metrics = useMemo(() => {
    const active = contacts.filter(c => c.is_active);
    const orcamento = active.filter(c => c.funnel_status === 'orcamento_enviado');
    const negociacao = active.filter(c => c.funnel_status === 'em_negociacao');
    const clientes = active.filter(c => c.funnel_status === 'cliente' || c.funnel_status === 'pos_venda');
    const openStages = ['novo_lead', 'orcamento_enviado', 'em_negociacao'];
    const valorAberto = active
      .filter(c => openStages.includes(c.funnel_status))
      .reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
    const totalLeads = active.filter(c => c.funnel_status !== 'perdido').length;
    const conversionRate = totalLeads > 0 ? Math.round((clientes.length / totalLeads) * 100) : 0;
    return { total: active.length, orcamento: orcamento.length, negociacao: negociacao.length, clientes: clientes.length, valorAberto, conversionRate };
  }, [contacts]);

  const handleSave = async (data: Partial<Contact>) => {
    if (editingContact) {
      await updateContact(editingContact.id, data);
    } else {
      await createContact(data);
    }
    setFormOpen(false);
    setEditingContact(undefined);
  };

  const handleStatusChange = async (contact: Contact, newStatus: string) => {
    const oldStage = FUNNEL_STAGES.find(s => s.key === contact.funnel_status);
    const newStage = FUNNEL_STAGES.find(s => s.key === newStatus);
    const updates: Partial<Contact> = { funnel_status: newStatus };
    if (newStatus === 'cliente' && contact.funnel_status !== 'cliente') {
      updates.converted_at = new Date().toISOString();
      await addEntry(contact.id, 'conversion', `Convertido para Cliente`);
      toast.success('🎉 Conversão registrada!');
    } else {
      await addEntry(contact.id, 'stage_change', `Movido de "${oldStage?.label || contact.funnel_status}" para "${newStage?.label || newStatus}"`, oldStage?.label, newStage?.label);
    }
    await updateContact(contact.id, updates);
  };

  const handleWhatsApp = (contact: Contact) => {
    const phone = contact.whatsapp || contact.mobile || contact.phone;
    if (phone) {
      const clean = phone.replace(/\D/g, '');
      const full = clean.startsWith('55') ? clean : `55${clean}`;
      window.open(`https://wa.me/${full}`, '_blank');
    }
  };

  const handleTempChange = async (contact: Contact, newTemp: string) => {
    if (contact.temperatura_lead === newTemp) return;
    const oldLabel = TEMP_CONFIG[contact.temperatura_lead as keyof typeof TEMP_CONFIG]?.label || contact.temperatura_lead;
    const newLabel = TEMP_CONFIG[newTemp as keyof typeof TEMP_CONFIG]?.label || newTemp;
    await addEntry(contact.id, 'stage_change', `Temperatura alterada de "${oldLabel}" para "${newLabel}"`, oldLabel, newLabel);
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

  const ContactCard = ({ contact }: { contact: Contact }) => {
    const alert = getUltimoContatoAlert(contact.ultimo_contato);
    const valor = formatCurrencyShort(contact.valor_estimado);
    const contactTags = getTagsForContact(contact.id);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
      >
        <Card
          className={cn(
            "p-3 space-y-2 hover:shadow-lg transition-all cursor-grab active:cursor-grabbing border-l-[3px]",
            draggedContact?.id === contact.id && "opacity-50 scale-95",
            alert?.urgent ? "border-l-red-500" : "border-l-transparent"
          )}
          draggable
          onDragStart={(e) => handleDragStart(e, contact)}
          onClick={() => { setEditingContact(contact); setFormOpen(true); }}
        >
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate leading-tight">{contact.name}</p>
              {contact.fantasy_name && <p className="text-[10px] text-muted-foreground truncate">{contact.fantasy_name}</p>}
              {contact.origem_lead && <p className="text-[10px] text-muted-foreground/70 truncate">via {contact.origem_lead}</p>}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setActivitiesContact(contact); setActivitiesOpen(true); }}>
                  <CalendarClock className="h-3.5 w-3.5 mr-2" />
                  Atividades
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setTimelineContact(contact); setTimelineOpen(true); }}>
                  <History className="h-3.5 w-3.5 mr-2" />
                  Timeline
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setHistoryContact(contact); setHistoryOpen(true); }}>
                  <ShoppingCart className="h-3.5 w-3.5 mr-2" />
                  Pedidos
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Temperatura</div>
                {Object.entries(TEMP_CONFIG).filter(([key]) => key !== contact.temperatura_lead).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <DropdownMenuItem key={key} onClick={(e) => { e.stopPropagation(); handleTempChange(contact, key); }}>
                      <Icon className="h-3 w-3 mr-2" />
                      {cfg.label}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mover para</div>
                {FUNNEL_STAGES.filter(s => s.key !== contact.funnel_status).map(s => (
                  <DropdownMenuItem key={s.key} onClick={(e) => { e.stopPropagation(); handleStatusChange(contact, s.key); }}>
                    <ArrowRight className="h-3 w-3 mr-2" />
                    {s.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setContactToDelete(contact); setDeleteDialogOpen(true); }} className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <TempBadge temp={contact.temperatura_lead} />
            {valor && (
              <span className="text-[10px] font-bold text-green-700 bg-green-50 rounded-full px-1.5 py-0.5 border border-green-200">
                {valor}
              </span>
            )}
            {alert && (
              <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-0.5 border', alert.className)}>
                <Clock className="h-2.5 w-2.5" />
                {alert.label}
              </span>
            )}
          </div>

          {/* Tags */}
          {contactTags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {contactTags.slice(0, 3).map(tag => (
                <span
                  key={tag.id}
                  className="text-[9px] font-medium rounded-full px-1.5 py-0.5 text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
              {contactTags.length > 3 && (
                <span className="text-[9px] text-muted-foreground">+{contactTags.length - 3}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 pt-0.5">
            {(contact.whatsapp || contact.mobile || contact.phone) && (
              <Button variant="ghost" size="icon" className="h-5 w-5 text-green-600 hover:text-green-700" onClick={(e) => { e.stopPropagation(); handleWhatsApp(contact); }}>
                <MessageCircle className="h-3 w-3" />
              </Button>
            )}
            {contact.email && <span className="text-[10px] text-muted-foreground truncate">{contact.email}</span>}
          </div>
        </Card>
      </motion.div>
    );
  };

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

        {/* Mini Dashboard */}
        <div className="grid grid-cols-5 gap-2">
          <Card className="p-2.5 text-center border-0 shadow-sm bg-card">
            <Users className="h-4 w-4 mx-auto text-muted-foreground mb-0.5" />
            <p className="text-xl font-bold leading-tight">{metrics.total}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Total</p>
          </Card>
          <Card className="p-2.5 text-center border-0 shadow-sm bg-amber-50 dark:bg-amber-950/30">
            <FileText className="h-4 w-4 mx-auto text-amber-600 mb-0.5" />
            <p className="text-xl font-bold text-amber-700 leading-tight">{metrics.orcamento}</p>
            <p className="text-[10px] text-amber-600 font-medium">Orçamento</p>
          </Card>
          <Card className="p-2.5 text-center border-0 shadow-sm bg-orange-50 dark:bg-orange-950/30">
            <Handshake className="h-4 w-4 mx-auto text-orange-600 mb-0.5" />
            <p className="text-xl font-bold text-orange-700 leading-tight">{metrics.negociacao}</p>
            <p className="text-[10px] text-orange-600 font-medium">Negociação</p>
          </Card>
          <Card className="p-2.5 text-center border-0 shadow-sm bg-green-50 dark:bg-green-950/30">
            <DollarSign className="h-4 w-4 mx-auto text-green-600 mb-0.5" />
            <p className="text-xl font-bold text-green-700 leading-tight">{formatCurrencyShort(metrics.valorAberto) || 'R$ 0'}</p>
            <p className="text-[10px] text-green-600 font-medium">Em aberto</p>
          </Card>
          <Card className="p-2.5 text-center border-0 shadow-sm bg-emerald-50 dark:bg-emerald-950/30">
            <TrendingUp className="h-4 w-4 mx-auto text-emerald-600 mb-0.5" />
            <p className="text-xl font-bold text-emerald-700 leading-tight">{metrics.conversionRate}%</p>
            <p className="text-[10px] text-emerald-600 font-medium">Conversão</p>
          </Card>
        </div>

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

          <div className="flex border rounded-lg ml-auto overflow-hidden">
            <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-none" onClick={() => setViewMode('kanban')} title="Kanban">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'funnel' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-none border-x" onClick={() => setViewMode('funnel')} title="Funil">
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
                      {stageContacts.map(contact => (
                        <ContactCard key={contact.id} contact={contact} />
                      ))}
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Temp.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('valor_estimado')}>
                    <div className="flex items-center">Valor Est. <SortIcon field="valor_estimado" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('ultimo_contato')}>
                    <div className="flex items-center">Últ. Contato <SortIcon field="ultimo_contato" /></div>
                  </TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
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
                          <span className="text-primary hover:underline cursor-pointer font-medium" onClick={() => { setEditingContact(contact); setFormOpen(true); }}>
                            {contact.name}
                          </span>
                          {contact.fantasy_name && <p className="text-xs text-muted-foreground">{contact.fantasy_name}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {contact.type === 'ambos' ? 'Ambos' : contact.type === 'fornecedor' ? 'Fornecedor' : 'Cliente'}
                          </Badge>
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
    </div>
  );
}
