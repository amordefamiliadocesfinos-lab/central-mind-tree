import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useContacts, Contact } from '@/hooks/useContacts';
import { useContactHistory } from '@/hooks/useContactHistory';
import { ContactFormDialog } from '@/components/financial/ContactFormDialog';
import { ContactOrderHistory } from '@/components/financial/ContactOrderHistory';
import { ContactHistoryDialog } from '@/components/ContactHistoryDialog';
import { cn } from '@/lib/utils';
import { FunnelView } from '@/components/FunnelView';
import { differenceInDays, parseISO } from 'date-fns';
import { toast } from 'sonner';

const FUNNEL_STAGES = [
  { key: 'novo_lead', label: 'Novo Lead', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50 border-blue-200' },
  { key: 'orcamento_enviado', label: 'Orçamento Enviado', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50 border-amber-200' },
  { key: 'em_negociacao', label: 'Em Negociação', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50 border-orange-200' },
  { key: 'cliente', label: 'Cliente', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50 border-green-200' },
  { key: 'pos_venda', label: 'Pós-venda', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50 border-purple-200' },
  { key: 'perdido', label: 'Perdido', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50 border-red-200' },
];

const TEMP_CONFIG = {
  frio: { label: 'Frio', icon: Snowflake, className: 'bg-sky-100 text-sky-700 border-sky-300' },
  morno: { label: 'Morno', icon: Sun, className: 'bg-amber-100 text-amber-700 border-amber-300' },
  quente: { label: 'Quente', icon: Flame, className: 'bg-red-100 text-red-700 border-red-300' },
};

function getStage(key: string) {
  return FUNNEL_STAGES.find(s => s.key === key) || FUNNEL_STAGES[0];
}

function getUltimoContatoAlert(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    const days = differenceInDays(new Date(), parseISO(dateStr));
    if (days > 7) return { label: `${days}d`, className: 'text-red-600 bg-red-50' };
    if (days > 3) return { label: `${days}d`, className: 'text-amber-600 bg-amber-50' };
    return { label: `${days}d`, className: 'text-muted-foreground' };
  } catch { return null; }
}

function formatCurrencyShort(v?: number | null) {
  if (!v) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function Contatos() {
  const { contacts, loading, createContact, updateContact, deleteContact } = useContacts();
  const { addEntry } = useContactHistory();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tempFilter, setTempFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'funnel' | 'list'>('kanban');
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineContact, setTimelineContact] = useState<Contact | null>(null);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (!c.is_active) return false;
      if (statusFilter !== 'all' && c.funnel_status !== statusFilter) return false;
      if (tempFilter !== 'all' && c.temperatura_lead !== tempFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.name?.toLowerCase().includes(q) ||
          c.fantasy_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.whatsapp?.toLowerCase().includes(q) ||
          c.document?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [contacts, searchQuery, statusFilter, tempFilter]);

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

  // Dashboard metrics
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
    return {
      total: active.length,
      orcamento: orcamento.length,
      negociacao: negociacao.length,
      clientes: clientes.length,
      valorAberto,
      conversionRate,
    };
  }, [contacts]);

  // Sum per stage
  const stageSums = useMemo(() => {
    const sums: Record<string, number> = {};
    FUNNEL_STAGES.forEach(s => {
      sums[s.key] = (groupedByStage[s.key] || []).reduce((sum, c) => sum + (c.valor_estimado || 0), 0);
    });
    return sums;
  }, [groupedByStage]);

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
    
    // If moving to "cliente", register conversion
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

  const handleConfirmDelete = async () => {
    if (contactToDelete) {
      await deleteContact(contactToDelete.id);
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    }
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

    return (
      <Card className="p-3 space-y-1.5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setEditingContact(contact); setFormOpen(true); }}>
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{contact.name}</p>
            {contact.origem_lead && <p className="text-[10px] text-muted-foreground truncate">via {contact.origem_lead}</p>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {FUNNEL_STAGES.filter(s => s.key !== contact.funnel_status).map(s => (
                <DropdownMenuItem key={s.key} onClick={(e) => { e.stopPropagation(); handleStatusChange(contact, s.key); }}>
                  <ArrowRight className="h-3 w-3 mr-2" />
                  Mover para {s.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setTimelineContact(contact); setTimelineOpen(true); }}>
                <History className="h-3 w-3 mr-2" />
                Timeline
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setHistoryContact(contact); setHistoryOpen(true); }}>
                <ShoppingCart className="h-3 w-3 mr-2" />
                Pedidos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setContactToDelete(contact); setDeleteDialogOpen(true); }} className="text-destructive">
                <Trash2 className="h-3 w-3 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <TempBadge temp={contact.temperatura_lead} />
          {valor && (
            <span className="text-xs font-semibold text-green-700 bg-green-50 rounded-full px-1.5 py-0.5 border border-green-200">
              {valor}
            </span>
          )}
          {alert && (
            <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-0.5', alert.className)}>
              <Clock className="h-2.5 w-2.5" />
              {alert.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {(contact.whatsapp || contact.mobile || contact.phone) && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" onClick={(e) => { e.stopPropagation(); handleWhatsApp(contact); }}>
              <MessageCircle className="h-3 w-3" />
            </Button>
          )}
          {contact.email && <span className="text-[10px] text-muted-foreground truncate">{contact.email}</span>}
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Contatos
          </h1>
          <Button onClick={() => { setEditingContact(undefined); setFormOpen(true); }} size="sm" className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        </div>

        {/* Mini Dashboard */}
        <div className="grid grid-cols-5 gap-2">
          <div className="rounded-lg border bg-card p-2 text-center">
            <Users className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-lg font-bold">{metrics.total}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          <div className="rounded-lg border bg-amber-50 border-amber-200 p-2 text-center">
            <FileText className="h-4 w-4 mx-auto text-amber-600" />
            <p className="text-lg font-bold text-amber-700">{metrics.orcamento}</p>
            <p className="text-[10px] text-amber-600">Orçamento</p>
          </div>
          <div className="rounded-lg border bg-orange-50 border-orange-200 p-2 text-center">
            <Handshake className="h-4 w-4 mx-auto text-orange-600" />
            <p className="text-lg font-bold text-orange-700">{metrics.negociacao}</p>
            <p className="text-[10px] text-orange-600">Negociação</p>
          </div>
          <div className="rounded-lg border bg-green-50 border-green-200 p-2 text-center">
            <DollarSign className="h-4 w-4 mx-auto text-green-600" />
            <p className="text-lg font-bold text-green-700">{formatCurrencyShort(metrics.valorAberto) || 'R$ 0'}</p>
            <p className="text-[10px] text-green-600">Em aberto</p>
          </div>
          <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-2 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-emerald-600" />
            <p className="text-lg font-bold text-emerald-700">{metrics.conversionRate}%</p>
            <p className="text-[10px] text-emerald-600">Conversão</p>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[140px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contatos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
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

          {/* Temperature filter chips */}
          <div className="flex gap-1">
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
                  variant={tempFilter === opt.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 px-2.5 text-xs rounded-full"
                  onClick={() => setTempFilter(opt.value)}
                >
                  {Icon && <Icon className="h-3 w-3 mr-0.5" />}
                  {opt.label}
                </Button>
              );
            })}
          </div>

          <div className="flex border rounded-md ml-auto">
            <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-r-none" onClick={() => setViewMode('kanban')} title="Kanban">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'funnel' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-none border-x" onClick={() => setViewMode('funnel')} title="Funil">
              <Triangle className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-l-none" onClick={() => setViewMode('list')} title="Lista">
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
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
            {FUNNEL_STAGES.map((stage) => {
              const stageContacts = groupedByStage[stage.key] || [];
              const stageSum = stageSums[stage.key];
              return (
                <div key={stage.key} className="min-w-[200px]">
                  <div className={cn("rounded-lg border p-2 mb-2", stage.bgLight)}>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs font-semibold", stage.textColor)}>{stage.label}</span>
                      <Badge variant="secondary" className="text-xs h-5 px-1.5">{stageContacts.length}</Badge>
                    </div>
                    {stageSum > 0 && (
                      <p className={cn("text-xs font-bold mt-1", stage.textColor)}>
                        {formatCurrencyShort(stageSum)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                    {stageContacts.map(contact => (
                      <ContactCard key={contact.id} contact={contact} />
                    ))}
                    {stageContacts.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum contato</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'funnel' ? (
          <FunnelView contacts={contacts} />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Temp.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor Est.</TableHead>
                  <TableHead>Últ. Contato</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum contato encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => {
                    const alert = getUltimoContatoAlert(contact.ultimo_contato);
                    return (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <span className="text-primary hover:underline cursor-pointer" onClick={() => { setEditingContact(contact); setFormOpen(true); }}>
                            {contact.name}
                          </span>
                          {contact.fantasy_name && <p className="text-xs text-muted-foreground">{contact.fantasy_name}</p>}
                        </TableCell>
                        <TableCell><TempBadge temp={contact.temperatura_lead} /></TableCell>
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
                            <span className={cn('text-xs font-medium rounded px-1.5 py-0.5', alert.className)}>{alert.label}</span>
                          ) : '-'}
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
                                <Edit className="h-3 w-3 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setHistoryContact(contact); setHistoryOpen(true); }}>
                                <ShoppingCart className="h-3 w-3 mr-2" />
                                Histórico
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setContactToDelete(contact); setDeleteDialogOpen(true); }} className="text-destructive">
                                <Trash2 className="h-3 w-3 mr-2" />
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
    </div>
  );
}
