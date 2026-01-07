import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FinancialAccount } from '@/hooks/useFinancial';
import { formatCurrency } from '@/lib/utils';
import { Plus, Building2, CreditCard, Wallet, Edit } from 'lucide-react';

interface AccountsManagerProps {
  accounts: FinancialAccount[];
  onSave: (account: Partial<FinancialAccount> & { name: string; type: string }) => Promise<void>;
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
  const [editing, setEditing] = useState<FinancialAccount | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'caixa',
    initial_balance: '0',
    bank_name: '',
    agency: '',
    account_number: '',
  });

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

  const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Caixas e Bancos</CardTitle>
          <Button size="sm" onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Conta
          </Button>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma conta cadastrada
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Saldo Inicial</TableHead>
                    <TableHead className="text-right">Saldo Atual</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {accountTypeIcons[account.type]}
                          <div>
                            <p className="font-medium">{account.name}</p>
                            {account.bank_name && (
                              <p className="text-xs text-muted-foreground">
                                {account.bank_name} - Ag: {account.agency} / CC: {account.account_number}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{accountTypeLabels[account.type]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(account.initial_balance)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={account.current_balance >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                          {formatCurrency(account.current_balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(account)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={3} className="font-medium">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      <span className={totalBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                        {formatCurrency(totalBalance)}
                      </span>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
    </>
  );
}
