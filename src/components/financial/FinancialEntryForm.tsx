import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinancialEntry, FinancialCategory, FinancialAccount } from '@/hooks/useFinancial';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface FinancialEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: FinancialEntry;
  type: 'pagar' | 'receber';
  categories: FinancialCategory[];
  accounts: FinancialAccount[];
  onSave: (data: any) => Promise<void>;
}

export function FinancialEntryForm({
  open,
  onOpenChange,
  entry,
  type,
  categories,
  accounts,
  onSave,
}: FinancialEntryFormProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: '',
    value: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    category_id: '',
    account_id: '',
    document_number: '',
    notes: '',
  });

  useEffect(() => {
    if (entry) {
      setForm({
        description: entry.description,
        value: entry.value.toString(),
        due_date: entry.due_date,
        category_id: entry.category_id || '',
        account_id: entry.account_id || '',
        document_number: entry.document_number || '',
        notes: entry.notes || '',
      });
    } else {
      setForm({
        description: '',
        value: '',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        category_id: '',
        account_id: '',
        document_number: '',
        notes: '',
      });
    }
  }, [entry, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.value) return;

    setLoading(true);
    try {
      await onSave({
        type,
        description: form.description,
        value: parseFloat(form.value),
        due_date: form.due_date,
        category_id: form.category_id || null,
        account_id: form.account_id || null,
        document_number: form.document_number || null,
        notes: form.notes || null,
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === type || c.type === 'ambos');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {entry ? 'Editar' : 'Novo'} {type === 'pagar' ? 'Conta a Pagar' : 'Conta a Receber'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Pagamento fornecedor X"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nº Documento</Label>
            <Input
              value={form.document_number}
              onChange={(e) => setForm({ ...form, document_number: e.target.value })}
              placeholder="NF, boleto, etc"
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notas adicionais..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
