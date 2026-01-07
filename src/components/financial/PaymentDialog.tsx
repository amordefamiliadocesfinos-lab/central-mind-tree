import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinancialEntry, FinancialAccount } from '@/hooks/useFinancial';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: FinancialEntry;
  accounts: FinancialAccount[];
  onConfirm: (value: number, accountId?: string, notes?: string) => Promise<void>;
}

export function PaymentDialog({ open, onOpenChange, entry, accounts, onConfirm }: PaymentDialogProps) {
  const remaining = entry.value - entry.value_paid;
  const [value, setValue] = useState(remaining.toString());
  const [accountId, setAccountId] = useState(entry.account_id || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return;

    setLoading(true);
    try {
      await onConfirm(numValue, accountId || undefined, notes || undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleFullPayment = () => {
    setValue(remaining.toString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar {entry.type === 'pagar' ? 'Pagamento' : 'Recebimento'}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-muted p-3 space-y-1">
          <p className="font-medium">{entry.description}</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor total:</span>
            <span>{formatCurrency(entry.value)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Já pago:</span>
            <span>{formatCurrency(entry.value_paid)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span>Restante:</span>
            <span className="text-primary">{formatCurrency(remaining)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Valor da baixa *</Label>
              <Button type="button" variant="link" size="sm" onClick={handleFullPayment}>
                Baixar total
              </Button>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar conta..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.current_balance)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações da baixa..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Baixa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
