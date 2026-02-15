import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ArrowRight,
  UserPlus,
} from 'lucide-react';
import { useContacts, Contact } from '@/hooks/useContacts';
import { ContactFormDialog } from '@/components/financial/ContactFormDialog';
import { ContactOrderHistory } from '@/components/financial/ContactOrderHistory';
import { cn } from '@/lib/utils';

const FUNNEL_STAGES = [
  { key: 'novo_lead', label: 'Novo Lead', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50 border-blue-200' },
  { key: 'orcamento_enviado', label: 'Orçamento Enviado', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50 border-amber-200' },
  { key: 'em_negociacao', label: 'Em Negociação', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50 border-orange-200' },
  { key: 'cliente', label: 'Cliente', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50 border-green-200' },
  { key: 'pos_venda', label: 'Pós-venda', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50 border-purple-200' },
  { key: 'perdido', label: 'Perdido', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50 border-red-200' },
];

function getStage(key: string) {
  return FUNNEL_STAGES.find(s => s.key === key) || FUNNEL_STAGES[0];
}

export default function Contatos() {
  const { contacts, loading, createContact, updateContact, deleteContact } = useContacts();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'funnel' | 'list'>('funnel');
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (!c.is_active) return false;
      if (statusFilter !== 'all' && c.funnel_status !== statusFilter) return false;
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
  }, [contacts, searchQuery, statusFilter]);

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
    await updateContact(contact.id, { funnel_status: newStatus });
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

  const ContactCard = ({ contact }: { contact: Contact }) => {
    const stage = getStage(contact.funnel_status);
    return (
      <Card className="p-3 space-y-2 hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setEditingContact(contact); setFormOpen(true); }}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{contact.name}</p>
            {contact.fantasy_name && <p className="text-xs text-muted-foreground truncate">{contact.fantasy_name}</p>}
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
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setHistoryContact(contact); setHistoryOpen(true); }}>
                <ShoppingCart className="h-3 w-3 mr-2" />
                Histórico
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setContactToDelete(contact); setDeleteDialogOpen(true); }} className="text-destructive">
                <Trash2 className="h-3 w-3 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {contact.email && <span className="truncate">{contact.email}</span>}
        </div>
        <div className="flex items-center gap-1">
          {(contact.whatsapp || contact.mobile || contact.phone) && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" onClick={(e) => { e.stopPropagation(); handleWhatsApp(contact); }}>
              <MessageCircle className="h-3 w-3" />
            </Button>
          )}
          {contact.city && <span className="text-xs text-muted-foreground">{contact.city}/{contact.state}</span>}
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Contatos
          </h1>
          <Button onClick={() => { setEditingContact(undefined); setFormOpen(true); }} size="sm" className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contatos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {FUNNEL_STAGES.map(s => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button variant={viewMode === 'funnel' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-r-none" onClick={() => setViewMode('funnel')}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-l-none" onClick={() => setViewMode('list')}>
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
        ) : viewMode === 'funnel' ? (
          /* Funnel View */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
            {FUNNEL_STAGES.map((stage) => {
              const stageContacts = groupedByStage[stage.key] || [];
              return (
                <div key={stage.key} className="min-w-[200px]">
                  <div className={cn("rounded-lg border p-2 mb-2", stage.bgLight)}>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs font-semibold", stage.textColor)}>{stage.label}</span>
                      <Badge variant="secondary" className="text-xs h-5 px-1.5">{stageContacts.length}</Badge>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
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
        ) : (
          /* List View */
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum contato encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => {
                    const stage = getStage(contact.funnel_status);
                    return (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <span className="text-primary hover:underline cursor-pointer" onClick={() => { setEditingContact(contact); setFormOpen(true); }}>
                            {contact.name}
                          </span>
                          {contact.fantasy_name && <p className="text-xs text-muted-foreground">{contact.fantasy_name}</p>}
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
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {contact.email && <span className="text-xs">{contact.email}</span>}
                            {(contact.whatsapp || contact.mobile || contact.phone) && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" onClick={() => handleWhatsApp(contact)}>
                                <MessageCircle className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{contact.city ? `${contact.city}/${contact.state}` : '-'}</TableCell>
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
    </div>
  );
}
