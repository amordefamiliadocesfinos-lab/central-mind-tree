import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { FinancialAccount, FinancialMovement, FinancialCategory } from '@/hooks/useFinancial';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, Building2, CreditCard, Wallet, Edit, Search, Calendar,
  Printer, Download, Trash2, ArrowRightLeft, Settings2, 
  MoreVertical, Filter, ChevronDown, X, Eye, EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { ContactFormDialog } from './ContactFormDialog';
import { useContacts } from '@/hooks/useContacts';

interface AccountsManagerProps {
  accounts: FinancialAccount[];
  onSave: (account: Partial<FinancialAccount> & { name: string; type: string }) => Promise<void>;
}

interface MovementWithDetails {
  id: string;
  entry_id: string;
  account_id: string | null;
  value: number;
  movement_date: string;
  notes: string | null;
  created_at: string;
  entry?: {
    id: string;
    type: string;
    description: string;
    category_id: string | null;
    contact_id: string | null;
    is_conciliated: boolean;
    category?: { id: string; name: string; color: string } | null;
    contact?: { id: string; name: string } | null;
  };
  account?: { id: string; name: string; type: string } | null;
}

const accountTypeIcons: Record<string, React.ReactNode> = {
  caixa: <Wallet className="h-4 w-4" />,
  banco: <Building2 className="h-4 w-4" />,
  cartao: <CreditCard className="h-4 w-4" />,
};

const accountTypeLabels: Record<string, string> = {
  caixa: 'Caixa',
  banco: 'Banco',
  cartao: 'Cartão',
};

export function AccountsManager({ accounts, onSave }: AccountsManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialAccount | null>(null);
  const [movements, setMovements] = useState<MovementWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('movimentacoes');
  const [showFilters, setShowFilters] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
  const [editingMovement, setEditingMovement] = useState<MovementWithDetails | null>(null);
  const [editMovementDialogOpen, setEditMovementDialogOpen] = useState(false);
  const [deleteMovementDialogOpen, setDeleteMovementDialogOpen] = useState(false);
  const [movementToDelete, setMovementToDelete] = useState<MovementWithDetails | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { createContact } = useContacts();

  // Edit movement form
  const [editMovementForm, setEditMovementForm] = useState({
    description: '',
    value: '',
    movement_date: '',
    category_id: '',
    notes: '',
  });

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [situationFilter, setSituationFilter] = useState('all');
  const [conciliationFilter, setConciliationFilter] = useState('all');
  const [categories, setCategories] = useState<{ id: string; name: string; type: string }[]>([]);

  const [form, setForm] = useState({
    name: '',
    type: 'caixa',
    initial_balance: '0',
    bank_name: '',
    agency: '',
    account_number: '',
  });

  const [transferForm, setTransferForm] = useState({
    from_account: '',
    to_account: '',
    value: '',
    notes: '',
  });

  const [adjustForm, setAdjustForm] = useState({
    account_id: '',
    new_balance: '',
    notes: '',
  });

  const [entryForm, setEntryForm] = useState({
    type: 'pagar' as 'pagar' | 'receber',
    description: '',
    value: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    competence_date: format(new Date(), 'yyyy-MM-dd'),
    category_id: '',
    account_id: '',
    contact_name: '',
    notes: '',
  });
  
  const [showFiltersSidebar, setShowFiltersSidebar] = useState(true);

  // Fetch movements
  const fetchMovements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('financial_movements')
      .select(`
        *,
        entry:financial_entries(
          id, type, description, category_id, contact_id, is_conciliated,
          category:financial_categories(id, name, color),
          contact:contacts(id, name)
        ),
        account:financial_accounts(id, name, type)
      `)
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMovements(data as MovementWithDetails[]);
    }
    setLoading(false);
  };

  // Fetch categories for filter
  const fetchCategories = async () => {
    const { data } = await supabase
      .from('financial_categories')
      .select('id, name, type')
      .eq('is_active', true);
    if (data) setCategories(data);
  };

  useEffect(() => {
    fetchMovements();
    fetchCategories();
  }, []);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    let filtered = [...movements];

    // Filter by account
    if (selectedAccount !== 'all') {
      filtered = filtered.filter(m => m.account_id === selectedAccount);
    }

    // Filter by tab (entradas/saidas)
    if (activeTab === 'entradas') {
      filtered = filtered.filter(m => m.entry?.type === 'receber');
    } else if (activeTab === 'saidas') {
      filtered = filtered.filter(m => m.entry?.type === 'pagar');
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        m.entry?.description?.toLowerCase().includes(query) ||
        m.entry?.contact?.name?.toLowerCase().includes(query) ||
        m.notes?.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(m => m.entry?.category_id === categoryFilter);
    }

    // Filter by conciliation
    if (conciliationFilter === 'conciliado') {
      filtered = filtered.filter(m => m.entry?.is_conciliated);
    } else if (conciliationFilter === 'nao_conciliado') {
      filtered = filtered.filter(m => !m.entry?.is_conciliated);
    }

    return filtered;
  }, [movements, selectedAccount, activeTab, searchQuery, categoryFilter, conciliationFilter]);

  // Toggle movement selection
  const toggleMovementSelect = (id: string) => {
    setSelectedMovements(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllMovements = () => {
    if (selectedMovements.length === filteredMovements.length) {
      setSelectedMovements([]);
    } else {
      setSelectedMovements(filteredMovements.map(m => m.id));
    }
  };

  // Calculate summaries
  const summary = useMemo(() => {
    const accountMovements = selectedAccount === 'all' 
      ? movements 
      : movements.filter(m => m.account_id === selectedAccount);

    const entradas = accountMovements
      .filter(m => m.entry?.type === 'receber')
      .reduce((sum, m) => sum + m.value, 0);

    const saidas = accountMovements
      .filter(m => m.entry?.type === 'pagar')
      .reduce((sum, m) => sum + m.value, 0);

    const selectedAccountData = accounts.find(a => a.id === selectedAccount);
    const currentBalance = selectedAccount === 'all'
      ? accounts.reduce((sum, a) => sum + a.current_balance, 0)
      : selectedAccountData?.current_balance || 0;

    // Calculate selected summary
    const selectedItems = filteredMovements.filter(m => selectedMovements.includes(m.id));
    const selectedValue = selectedItems.reduce((sum, m) => sum + m.value, 0);

    return {
      count: filteredMovements.length,
      currentBalance,
      entradas,
      saidas,
      saldo: entradas - saidas,
      selectedCount: selectedMovements.length,
      selectedValue,
    };
  }, [movements, filteredMovements, accounts, selectedAccount, selectedMovements]);

  const handleEdit = (account: FinancialAccount) => {
    setEditing(account);
    setForm({
      name: account.name,
      type: account.type,
      initial_balance: account.initial_balance.toString(),
      bank_name: account.bank_name || '',
      agency: account.agency || '',
      account_number: account.account_number || '',
    });
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setForm({
      name: '',
      type: 'caixa',
      initial_balance: '0',
      bank_name: '',
      agency: '',
      account_number: '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      id: editing?.id,
      name: form.name,
      type: form.type as 'caixa' | 'banco' | 'cartao',
      initial_balance: parseFloat(form.initial_balance) || 0,
      bank_name: form.bank_name || undefined,
      agency: form.agency || undefined,
      account_number: form.account_number || undefined,
    });
    setDialogOpen(false);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(transferForm.value);
    if (!transferForm.from_account || !transferForm.to_account || !value) {
      toast({ variant: 'destructive', title: 'Preencha todos os campos' });
      return;
    }

    // Create entries for transfer
    const { data: saidaEntry, error: saidaError } = await supabase
      .from('financial_entries')
      .insert({
        type: 'pagar',
        description: `Transferência para ${accounts.find(a => a.id === transferForm.to_account)?.name}`,
        value,
        due_date: format(new Date(), 'yyyy-MM-dd'),
        notes: transferForm.notes,
      })
      .select()
      .single();

    if (saidaError) {
      toast({ variant: 'destructive', title: 'Erro ao criar transferência' });
      return;
    }

    const { data: entradaEntry, error: entradaError } = await supabase
      .from('financial_entries')
      .insert({
        type: 'receber',
        description: `Transferência de ${accounts.find(a => a.id === transferForm.from_account)?.name}`,
        value,
        due_date: format(new Date(), 'yyyy-MM-dd'),
        notes: transferForm.notes,
      })
      .select()
      .single();

    if (entradaError) {
      toast({ variant: 'destructive', title: 'Erro ao criar transferência' });
      return;
    }

    // Create movements
    await supabase.from('financial_movements').insert([
      {
        entry_id: saidaEntry.id,
        account_id: transferForm.from_account,
        value,
        movement_date: format(new Date(), 'yyyy-MM-dd'),
      },
      {
        entry_id: entradaEntry.id,
        account_id: transferForm.to_account,
        value,
        movement_date: format(new Date(), 'yyyy-MM-dd'),
      },
    ]);

    toast({ title: 'Transferência realizada!' });
    setTransferDialogOpen(false);
    setTransferForm({ from_account: '', to_account: '', value: '', notes: '' });
    fetchMovements();
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const account = accounts.find(a => a.id === adjustForm.account_id);
    if (!account) return;

    const newBalance = parseFloat(adjustForm.new_balance);
    const difference = newBalance - account.current_balance;
    
    if (difference === 0) {
      toast({ title: 'Saldo já está correto' });
      return;
    }

    // Create adjustment entry
    const { data: entry, error: entryError } = await supabase
      .from('financial_entries')
      .insert({
        type: difference > 0 ? 'receber' : 'pagar',
        description: `Ajuste de saldo - ${account.name}`,
        value: Math.abs(difference),
        due_date: format(new Date(), 'yyyy-MM-dd'),
        notes: adjustForm.notes || 'Ajuste manual de saldo',
      })
      .select()
      .single();

    if (entryError) {
      toast({ variant: 'destructive', title: 'Erro ao ajustar saldo' });
      return;
    }

    // Create movement
    await supabase.from('financial_movements').insert({
      entry_id: entry.id,
      account_id: adjustForm.account_id,
      value: Math.abs(difference),
      movement_date: format(new Date(), 'yyyy-MM-dd'),
    });

    toast({ title: 'Saldo ajustado!' });
    setAdjustDialogOpen(false);
    setAdjustForm({ account_id: '', new_balance: '', notes: '' });
    fetchMovements();
  };

  const exportCSV = () => {
    const headers = ['Data', 'Categoria', 'Histórico', 'Cliente/Fornecedor', 'Conta', 'Valor', 'Conciliado'];
    const rows = filteredMovements.map(m => [
      format(new Date(m.movement_date), 'dd/MM/yyyy'),
      m.entry?.category?.name || '',
      m.entry?.description || '',
      m.entry?.contact?.name || '',
      m.account?.name || '',
      (m.entry?.type === 'pagar' ? '-' : '') + m.value.toFixed(2),
      m.entry?.is_conciliated ? 'Sim' : 'Não',
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extrato_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const clearFilters = () => {
    setCategoryFilter('all');
    setSituationFilter('all');
    setConciliationFilter('all');
    setSearchQuery('');
  };

  const handleOpenEntryDialog = () => {
    setEntryForm({
      type: 'pagar',
      description: '',
      value: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      competence_date: format(new Date(), 'yyyy-MM-dd'),
      category_id: '',
      account_id: accounts[0]?.id || '',
      contact_name: '',
      notes: '',
    });
    setEntryDialogOpen(true);
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(entryForm.value);
    if (!entryForm.description || !value || !entryForm.account_id) {
      toast({ variant: 'destructive', title: 'Preencha os campos obrigatórios' });
      return;
    }

    // Create entry
    const { data: entry, error: entryError } = await supabase
      .from('financial_entries')
      .insert({
        type: entryForm.type,
        description: entryForm.description,
        value,
        due_date: entryForm.date,
        payment_date: entryForm.date,
        category_id: entryForm.category_id || null,
        notes: entryForm.notes || null,
      })
      .select()
      .single();

    if (entryError) {
      toast({ variant: 'destructive', title: 'Erro ao criar lançamento' });
      return;
    }

    // Create movement (already paid/received)
    const { error: movError } = await supabase.from('financial_movements').insert({
      entry_id: entry.id,
      account_id: entryForm.account_id,
      value,
      movement_date: entryForm.date,
      notes: entryForm.contact_name ? `${entryForm.contact_name}` : null,
    });

    if (movError) {
      toast({ variant: 'destructive', title: 'Erro ao registrar movimentação' });
      return;
    }

    toast({ title: 'Lançamento criado!' });
    setEntryDialogOpen(false);
    fetchMovements();
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  // Filter categories by entry type
  const filteredCategories = categories.filter(c => 
    c.type === entryForm.type || c.type === 'ambos'
  );

  // Handle edit movement
  const handleEditMovement = (movement: MovementWithDetails) => {
    setEditingMovement(movement);
    setEditMovementForm({
      description: movement.entry?.description || '',
      value: movement.value.toString(),
      movement_date: movement.movement_date,
      category_id: movement.entry?.category_id || '',
      notes: movement.notes || '',
    });
    setEditMovementDialogOpen(true);
  };

  // Update movement
  const handleUpdateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMovement) return;

    const value = parseFloat(editMovementForm.value);
    if (!editMovementForm.description || !value) {
      toast({ variant: 'destructive', title: 'Preencha os campos obrigatórios' });
      return;
    }

    // Update the entry
    const { error: entryError } = await supabase
      .from('financial_entries')
      .update({
        description: editMovementForm.description,
        value,
        category_id: editMovementForm.category_id || null,
      })
      .eq('id', editingMovement.entry_id);

    if (entryError) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar lançamento' });
      return;
    }

    // Update the movement
    const { error: movError } = await supabase
      .from('financial_movements')
      .update({
        value,
        movement_date: editMovementForm.movement_date,
        notes: editMovementForm.notes || null,
      })
      .eq('id', editingMovement.id);

    if (movError) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar movimentação' });
      return;
    }

    toast({ title: 'Movimentação atualizada!' });
    setEditMovementDialogOpen(false);
    setEditingMovement(null);
    fetchMovements();
  };

  // Delete movement
  const handleDeleteMovement = async () => {
    if (!movementToDelete) return;

    // Delete movement first
    const { error: movError } = await supabase
      .from('financial_movements')
      .delete()
      .eq('id', movementToDelete.id);

    if (movError) {
      toast({ variant: 'destructive', title: 'Erro ao excluir movimentação' });
      return;
    }

    // Delete entry if no other movements reference it
    const { data: otherMovements } = await supabase
      .from('financial_movements')
      .select('id')
      .eq('entry_id', movementToDelete.entry_id);

    if (!otherMovements || otherMovements.length === 0) {
      await supabase
        .from('financial_entries')
        .delete()
        .eq('id', movementToDelete.entry_id);
    }

    toast({ title: 'Movimentação excluída!' });
    setDeleteMovementDialogOpen(false);
    setMovementToDelete(null);
    fetchMovements();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Caixas e Bancos</h2>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas contas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas contas</SelectItem>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleOpenEntryDialog} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" />
          Incluir lançamento
        </Button>
      </div>

      <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-[200px_1fr_260px]")}>
        {/* Left Sidebar - Filters */}
        {showFiltersSidebar && !isMobile && (
          <Card className="p-4 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-1">
                <Filter className="h-4 w-4" /> Filtrar
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowFiltersSidebar(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  Categoria <Settings2 className="h-3 w-3" />
                </Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Situação</Label>
                <Select value={situationFilter} onValueChange={setSituationFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="registrados">Registrados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Situação da conciliação</Label>
                <Select value={conciliationFilter} onValueChange={setConciliationFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="conciliado">Conciliado</SelectItem>
                    <SelectItem value="nao_conciliado">Não conciliado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Valor</Label>
                <Input placeholder="" className="h-9" />
              </div>

              <Button variant="outline" size="sm" className="w-full" onClick={clearFilters}>
                Filtrar
              </Button>
            </div>
          </Card>
        )}

        {/* Main content */}
        <div className="space-y-4">
          {/* Search and actions bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome ou histórico"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              const start = startOfMonth(new Date());
              const end = endOfMonth(new Date());
            }}>
              <Calendar className="h-4 w-4 mr-1" />
              Este mês
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-1" />
              {!isMobile && "Imprimir saldos"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" />
              {!isMobile && "Exportar extrato"}
            </Button>
            <Button variant="outline" size="icon">
              <Printer className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
            {!showFiltersSidebar && !isMobile && (
              <Button variant="outline" size="icon" onClick={() => setShowFiltersSidebar(true)}>
                <Filter className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Active filters */}
          {(situationFilter !== 'all' || conciliationFilter !== 'all' || categoryFilter !== 'all' || selectedMovements.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {situationFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Situação: {situationFilter === 'registrados' ? 'Registrados' : 'Todos'}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSituationFilter('all')} />
                </Badge>
              )}
              {conciliationFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Situação da conciliação: {conciliationFilter === 'conciliado' ? 'Conciliados' : 'Não conciliados'}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setConciliationFilter('all')} />
                </Badge>
              )}
              {categoryFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  Categoria: {categories.find(c => c.id === categoryFilter)?.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setCategoryFilter('all')} />
                </Badge>
              )}
              {selectedMovements.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  Selecionados: {selectedMovements.length} cadastros
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedMovements([])} />
                </Badge>
              )}
              <Button variant="link" size="sm" className="h-auto p-0" onClick={clearFilters}>
                Limpar
              </Button>
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
              <TabsTrigger value="entradas">Entradas</TabsTrigger>
              <TabsTrigger value="saidas">Saídas</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4 pb-20">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox 
                          checked={selectedMovements.length === filteredMovements.length && filteredMovements.length > 0}
                          onCheckedChange={toggleSelectAllMovements}
                        />
                      </TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Histórico</TableHead>
                      <TableHead>Cliente/Fornecedor</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : filteredMovements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhuma movimentação encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMovements.map((mov) => (
                        <TableRow 
                          key={mov.id}
                          className={cn(selectedMovements.includes(mov.id) && "bg-emerald-50 dark:bg-emerald-950")}
                        >
                          <TableCell>
                            <Checkbox 
                              checked={selectedMovements.includes(mov.id)}
                              onCheckedChange={() => toggleMovementSelect(mov.id)}
                            />
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(parseISO(mov.movement_date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{mov.entry?.category?.name || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{mov.entry?.description || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{mov.entry?.contact?.name || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {mov.account?.name || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className={cn(
                                "font-medium",
                                mov.entry?.type === 'pagar' ? 'text-red-500' : 'text-emerald-600'
                              )}>
                                {mov.entry?.type === 'pagar' ? '- ' : ''}
                                {formatCurrency(mov.value)}
                              </span>
                              {mov.entry?.is_conciliated && (
                                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                                  R
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditMovement(mov)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-red-500"
                                  onClick={() => {
                                    setMovementToDelete(mov);
                                    setDeleteMovementDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        {!isMobile && (
          <div className="space-y-4">
            {/* Actions */}
            <Card className="p-4 space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => setTransferDialogOpen(true)}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transferência entre contas
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => setAdjustDialogOpen(true)}
              >
                <Settings2 className="h-4 w-4" />
                Ajustar saldos
              </Button>
            </Card>

            {/* Summary */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Quantidade de registros</span>
                <span className="font-medium text-blue-600">{summary.count}</span>
              </div>
              {summary.selectedCount > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-bold text-lg text-emerald-600">
                      {formatCurrency(summary.selectedValue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Selecionados</span>
                    <span className="font-medium text-blue-600">{summary.selectedCount}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Saldo atual da conta</span>
                <span className={cn(
                  "font-bold",
                  summary.currentBalance >= 0 ? 'text-emerald-600' : 'text-red-500'
                )}>
                  {formatCurrency(summary.currentBalance)}
                </span>
              </div>
            </Card>

            {/* Info panel */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm">Informações</span>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 text-xs"
                  onClick={() => setShowInfo(!showInfo)}
                >
                  {showInfo ? 'ocultar' : 'mostrar'}
                </Button>
              </div>
              {showInfo && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Entradas</span>
                    <span className="font-medium text-emerald-600">{formatCurrency(summary.entradas)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Saídas</span>
                    <span className="font-medium text-red-500">{formatCurrency(summary.saidas)}</span>
                  </div>
                  <div className="border-t pt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Saldo do período</span>
                    <span className={cn(
                      "font-bold",
                      summary.saldo >= 0 ? 'text-emerald-600' : 'text-red-500'
                    )}>
                      {formatCurrency(summary.saldo)}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* Accounts list */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm">Contas</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNew}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div 
                    key={acc.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedAccount(acc.id === selectedAccount ? 'all' : acc.id)}
                  >
                    <div className="flex items-center gap-2">
                      {accountTypeIcons[acc.type]}
                      <span className="text-sm">{acc.name}</span>
                    </div>
                    <span className={cn(
                      "text-sm font-medium",
                      acc.current_balance >= 0 ? 'text-emerald-600' : 'text-red-500'
                    )}>
                      {formatCurrency(acc.current_balance)}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className={cn(
                    "font-bold",
                    totalBalance >= 0 ? 'text-emerald-600' : 'text-red-500'
                  )}>
                    {formatCurrency(totalBalance)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Account Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Caixa Principal"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caixa">Caixa</SelectItem>
                    <SelectItem value="banco">Banco</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Saldo Inicial</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.initial_balance}
                  onChange={(e) => setForm({ ...form, initial_balance: e.target.value })}
                  disabled={!!editing}
                />
              </div>
            </div>

            {form.type === 'banco' && (
              <>
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Input
                    value={form.bank_name}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    placeholder="Ex: Banco do Brasil"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    <Input
                      value={form.agency}
                      onChange={(e) => setForm({ ...form, agency: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conta</Label>
                    <Input
                      value={form.account_number}
                      onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transferência entre contas</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="space-y-2">
              <Label>Conta de origem *</Label>
              <Select 
                value={transferForm.from_account} 
                onValueChange={(v) => setTransferForm({ ...transferForm, from_account: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conta de destino *</Label>
              <Select 
                value={transferForm.to_account} 
                onValueChange={(v) => setTransferForm({ ...transferForm, to_account: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.id !== transferForm.from_account).map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={transferForm.value}
                onChange={(e) => setTransferForm({ ...transferForm, value: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input
                value={transferForm.notes}
                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                placeholder="Descrição da transferência"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTransferDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Transferir</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust Balance Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar saldo</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAdjustBalance} className="space-y-4">
            <div className="space-y-2">
              <Label>Conta *</Label>
              <Select 
                value={adjustForm.account_id} 
                onValueChange={(v) => {
                  const acc = accounts.find(a => a.id === v);
                  setAdjustForm({ 
                    ...adjustForm, 
                    account_id: v,
                    new_balance: acc?.current_balance.toString() || '',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} - Saldo atual: {formatCurrency(acc.current_balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Novo saldo *</Label>
              <Input
                type="number"
                step="0.01"
                value={adjustForm.new_balance}
                onChange={(e) => setAdjustForm({ ...adjustForm, new_balance: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo do ajuste</Label>
              <Input
                value={adjustForm.notes}
                onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                placeholder="Ex: Conferência de caixa"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAdjustDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Ajustar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Entry Dialog - Lançamento caixa */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Lançamento caixa</DialogTitle>
            <p className="text-sm text-muted-foreground">(*) Campos obrigatórios</p>
          </DialogHeader>

          <form onSubmit={handleCreateEntry} className="space-y-4">
            {/* Categoria */}
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select 
                value={entryForm.category_id || 'none'} 
                onValueChange={(v) => setEntryForm({ ...entryForm, category_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger className="bg-emerald-50 border-emerald-200">
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data, Valor, Tipo */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={entryForm.date}
                    onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
                    required
                    className="pr-8"
                  />
                  <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={entryForm.value}
                  onChange={(e) => setEntryForm({ ...entryForm, value: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={entryForm.type} 
                  onValueChange={(v) => setEntryForm({ ...entryForm, type: v as 'pagar' | 'receber', category_id: '' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pagar">Saída</SelectItem>
                    <SelectItem value="receber">Entrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Competência e Conta */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Competência *</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={entryForm.competence_date}
                    onChange={(e) => setEntryForm({ ...entryForm, competence_date: e.target.value })}
                    required
                    className="pr-8"
                  />
                  <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conta financeira</Label>
                <Select 
                  value={entryForm.account_id} 
                  onValueChange={(v) => setEntryForm({ ...entryForm, account_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Histórico */}
            <div className="space-y-2">
              <Label>Histórico *</Label>
              <Textarea
                value={entryForm.description}
                onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                placeholder="Descrição do lançamento"
                required
                rows={3}
              />
            </div>

            {/* Cliente/Fornecedor */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Cliente ou fornecedor 
                <span className="text-blue-500 cursor-help">ℹ</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={entryForm.contact_name}
                  onChange={(e) => setEntryForm({ ...entryForm, contact_name: e.target.value })}
                  placeholder=""
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={() => setContactDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-dashed pt-4" />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEntryDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contact Form Dialog */}
      <ContactFormDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        onSave={async (data) => {
          await createContact(data);
          setContactDialogOpen(false);
          if (data.name) {
            setEntryForm({ ...entryForm, contact_name: data.name });
          }
        }}
      />

      {/* Edit Movement Dialog */}
      <Dialog open={editMovementDialogOpen} onOpenChange={setEditMovementDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Movimentação</DialogTitle>
            <DialogDescription>Altere os dados da movimentação abaixo.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateMovement} className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={editMovementForm.description}
                onChange={(e) => setEditMovementForm({ ...editMovementForm, description: e.target.value })}
                placeholder="Descrição do lançamento"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editMovementForm.value}
                  onChange={(e) => setEditMovementForm({ ...editMovementForm, value: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={editMovementForm.movement_date}
                  onChange={(e) => setEditMovementForm({ ...editMovementForm, movement_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select 
                value={editMovementForm.category_id} 
                onValueChange={(v) => setEditMovementForm({ ...editMovementForm, category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={editMovementForm.notes}
                onChange={(e) => setEditMovementForm({ ...editMovementForm, notes: e.target.value })}
                placeholder="Observações adicionais"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditMovementDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Movement Dialog */}
      <AlertDialog open={deleteMovementDialogOpen} onOpenChange={setDeleteMovementDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta movimentação? Esta ação não pode ser desfeita.
              {movementToDelete?.entry?.description && (
                <span className="block mt-2 font-medium">
                  "{movementToDelete.entry.description}"
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMovementToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={handleDeleteMovement}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
