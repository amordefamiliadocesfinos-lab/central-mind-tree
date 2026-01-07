import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, MoreHorizontal, Download, DollarSign, CheckCircle, Trash2, Edit, Filter } from 'lucide-react';
import { FinancialEntry, EntryStatus, getEntryStatus, FinancialCategory, FinancialAccount } from '@/hooks/useFinancial';
import { FinancialEntryForm } from './FinancialEntryForm';
import { PaymentDialog } from './PaymentDialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface FinancialEntriesListProps {
  entries: FinancialEntry[];
  type: 'pagar' | 'receber';
  categories: FinancialCategory[];
  accounts: FinancialAccount[];
  loading: boolean;
  onCreateEntry: (data: any) => Promise<any>;
  onUpdateEntry: (id: string, data: any) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onRegisterPayment: (id: string, value: number, accountId?: string, notes?: string) => Promise<void>;
  onConciliate: (id: string) => Promise<void>;
  onExport: () => void;
  statusFilter: EntryStatus | 'all';
  onStatusFilterChange: (status: EntryStatus | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const statusLabels: Record<EntryStatus, string> = {
  atrasada: 'Atrasada',
  parcial: 'Parcial',
  pago: 'Pago',
  em_aberto: 'Em Aberto',
};

const statusColors: Record<EntryStatus, string> = {
  atrasada: 'bg-red-500/10 text-red-500 border-red-500/20',
  parcial: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  pago: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  em_aberto: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

export function FinancialEntriesList({
  entries,
  type,
  categories,
  accounts,
  loading,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
  onRegisterPayment,
  onConciliate,
  onExport,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
}: FinancialEntriesListProps) {
  const isMobile = useIsMobile();
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | undefined>();
  const [paymentEntry, setPaymentEntry] = useState<FinancialEntry | undefined>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const title = type === 'pagar' ? 'Contas a Pagar' : 'Contas a Receber';
  const typeEntries = entries.filter(e => e.type === type);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === typeEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(typeEntries.map(e => e.id));
    }
  };

  const handleBatchPayment = async () => {
    const selected = typeEntries.filter(e => selectedIds.includes(e.id) && getEntryStatus(e) !== 'pago');
    for (const entry of selected) {
      await onRegisterPayment(entry.id, entry.value - entry.value_paid);
    }
    setSelectedIds([]);
  };

  const handleEdit = (entry: FinancialEntry) => {
    setEditingEntry(entry);
    setFormOpen(true);
  };

  const handleSave = async (data: any) => {
    if (editingEntry) {
      await onUpdateEntry(editingEntry.id, data);
    } else {
      await onCreateEntry(data);
    }
    setEditingEntry(undefined);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{title}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onExport}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button size="sm" onClick={() => { setEditingEntry(undefined); setFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Novo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as EntryStatus | 'all')}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="em_aberto">Em Aberto</SelectItem>
                <SelectItem value="atrasada">Atrasadas</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="pago">Pagas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Batch actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
              <span className="text-sm">{selectedIds.length} selecionado(s)</span>
              <Button size="sm" variant="secondary" onClick={handleBatchPayment}>
                <DollarSign className="mr-2 h-4 w-4" />
                Baixar Selecionados
              </Button>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando...</div>
          ) : typeEntries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum lançamento encontrado
            </div>
          ) : isMobile ? (
            <div className="space-y-2">
              {typeEntries.map((entry) => {
                const status = getEntryStatus(entry);
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedIds.includes(entry.id)}
                          onCheckedChange={() => toggleSelect(entry.id)}
                        />
                        <div>
                          <p className="font-medium">{entry.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(entry.due_date), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold">{formatCurrency(entry.value)}</p>
                        {entry.value_paid > 0 && entry.value_paid < entry.value && (
                          <p className="text-xs text-muted-foreground">
                            Pago: {formatCurrency(entry.value_paid)}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {status !== 'pago' && (
                          <Button size="icon" variant="ghost" onClick={() => setPaymentEntry(entry)}>
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(entry)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => onDeleteEntry(entry.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.length === typeEntries.length && typeEntries.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeEntries.map((entry) => {
                    const status = getEntryStatus(entry);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(entry.id)}
                            onCheckedChange={() => toggleSelect(entry.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{entry.description}</p>
                            {entry.document_number && (
                              <p className="text-xs text-muted-foreground">Doc: {entry.document_number}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(entry.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{entry.category?.name || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(entry.value)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(entry.value_paid)}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {status !== 'pago' && (
                                <DropdownMenuItem onClick={() => setPaymentEntry(entry)}>
                                  <DollarSign className="mr-2 h-4 w-4" />
                                  Baixar
                                </DropdownMenuItem>
                              )}
                              {status === 'pago' && !entry.is_conciliated && (
                                <DropdownMenuItem onClick={() => onConciliate(entry.id)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Conciliar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleEdit(entry)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDeleteEntry(entry.id)} className="text-red-500">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FinancialEntryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editingEntry}
        type={type}
        categories={categories}
        accounts={accounts}
        onSave={handleSave}
      />

      {paymentEntry && (
        <PaymentDialog
          open={!!paymentEntry}
          onOpenChange={(open) => !open && setPaymentEntry(undefined)}
          entry={paymentEntry}
          accounts={accounts}
          onConfirm={async (value, accountId, notes) => {
            await onRegisterPayment(paymentEntry.id, value, accountId, notes);
            setPaymentEntry(undefined);
          }}
        />
      )}
    </>
  );
}
