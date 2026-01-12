import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FinancialEntry, FinancialAccount, FinancialCategory } from '@/hooks/useFinancial';
import { formatCurrency } from '@/lib/utils';
import { Loader2, ChevronUp, Info, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface AdvancedPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: FinancialEntry[];
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  isPartial: boolean;
  onConfirm: (id: string, value: number, accountId?: string, notes?: string) => Promise<void>;
}

interface EntryPaymentData {
  id: string;
  accountId: string;
  categoryId: string;
  interest: number;
  discount: number;
  penalty: number;
  fee: number;
  marketplaceFee: number;
  receivedValue: number;
}

export function AdvancedPaymentDialog({ 
  open, 
  onOpenChange, 
  entries,
  accounts, 
  categories,
  isPartial,
  onConfirm 
}: AdvancedPaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [useGroupedPosting, setUseGroupedPosting] = useState(false);
  const [useSingleCategory, setUseSingleCategory] = useState(false);
  const [useDueDateAsPayment, setUseDueDateAsPayment] = useState(false);
  const [globalAccountId, setGlobalAccountId] = useState('');
  const [globalCategoryId, setGlobalCategoryId] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showDetails, setShowDetails] = useState(true);
  
  // Payment data for each entry
  const [entriesData, setEntriesData] = useState<EntryPaymentData[]>(() => 
    entries.map(entry => ({
      id: entry.id,
      accountId: entry.account_id || '',
      categoryId: entry.category_id || '',
      interest: 0,
      discount: 0,
      penalty: 0,
      fee: 0,
      marketplaceFee: 0,
      receivedValue: isPartial ? 0 : (entry.value - entry.value_paid),
    }))
  );

  // Calculate total
  const totalValue = useMemo(() => {
    return entriesData.reduce((sum, data) => sum + data.receivedValue, 0);
  }, [entriesData]);

  const originalTotal = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.value, 0);
  }, [entries]);

  const updateEntryData = (entryId: string, field: keyof EntryPaymentData, value: any) => {
    setEntriesData(prev => prev.map(data => {
      if (data.id !== entryId) return data;
      
      const newData = { ...data, [field]: value };
      
      // Find the original entry
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return newData;
      
      // Recalculate received value based on adjustments
      if (['interest', 'discount', 'penalty', 'fee', 'marketplaceFee'].includes(field)) {
        const baseValue = entry.value - entry.value_paid;
        newData.receivedValue = baseValue + newData.interest - newData.discount + newData.penalty - newData.fee - newData.marketplaceFee;
      }
      
      return newData;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    try {
      for (const data of entriesData) {
        if (data.receivedValue > 0) {
          const accountId = useSingleCategory ? globalAccountId : data.accountId;
          await onConfirm(data.id, data.receivedValue, accountId || undefined);
        }
      }
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const entry = entries[0];
  if (!entry) return null;

  const isReceivable = entry.type === 'receber';
  const remaining = entry.value - entry.value_paid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Baixa de lançamentos</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Inclua as informações necessárias para a baixa dos lançamentos.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Toggle options */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch 
                checked={useGroupedPosting} 
                onCheckedChange={setUseGroupedPosting}
              />
              <Label className="text-sm">Lançamento agrupado</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={useSingleCategory} 
                onCheckedChange={setUseSingleCategory}
              />
              <Label className="text-sm">Categoria única para todos registros</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={useDueDateAsPayment} 
                onCheckedChange={setUseDueDateAsPayment}
              />
              <Label className="text-sm">Utilizar data de vencimento</Label>
            </div>
          </div>

          {/* Global fields */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Destino</Label>
              <Select value={globalAccountId} onValueChange={setGlobalAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="-" />
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
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={globalCategoryId} onValueChange={setGlobalCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.type === entry.type || c.type === 'ambos').map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data do {isReceivable ? 'recebimento' : 'pagamento'}</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor total</Label>
              <Input
                value={formatCurrency(totalValue)}
                readOnly
                className="bg-muted font-medium"
              />
            </div>
          </div>

          {/* Entry description */}
          <div className="space-y-2">
            <Label>Histórico</Label>
            <Textarea
              value={entry.description || ''}
              readOnly
              className="bg-muted"
              rows={2}
            />
          </div>

          {/* Entries details */}
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <span className="font-medium">Lançamentos selecionados</span>
                <ChevronUp className={`h-4 w-4 transition-transform ${showDetails ? '' : 'rotate-180'}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              {/* Info banner */}
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-blue-700 dark:text-blue-300">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  Os cálculos de juros e multa são realizados automaticamente caso haja valores fornecidos na inclusão da conta
                </span>
              </div>

              {entries.map((entry, index) => {
                const data = entriesData.find(d => d.id === entry.id);
                if (!data) return null;
                
                const entryRemaining = entry.value - entry.value_paid;
                
                return (
                  <Card key={entry.id} className="p-4 space-y-4">
                    {/* Entry header info */}
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cliente: </span>
                        <span className="font-medium">{entry.contact?.name || entry.description?.split(' ').slice(0, 3).join(' ')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">N° do documento: </span>
                        <span className="font-medium">{entry.document_number || '-'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vencimento: </span>
                        <span className="font-medium">{format(parseISO(entry.due_date), 'dd/MM/yyyy')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Valor original: </span>
                        <span className="font-medium">{formatCurrency(entry.value)}</span>
                      </div>
                    </div>

                    {/* Entry fields */}
                    <div className="grid grid-cols-7 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Conta financeira</Label>
                        <Select 
                          value={data.accountId} 
                          onValueChange={(v) => updateEntryData(entry.id, 'accountId', v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione" />
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
                      <div className="space-y-1">
                        <Label className="text-xs">Categoria</Label>
                        <Select 
                          value={data.categoryId} 
                          onValueChange={(v) => updateEntryData(entry.id, 'categoryId', v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.filter(c => c.type === entry.type || c.type === 'ambos').map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Juros</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-9"
                          value={data.interest || ''}
                          onChange={(e) => updateEntryData(entry.id, 'interest', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Desconto</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-9"
                          value={data.discount || ''}
                          onChange={(e) => updateEntryData(entry.id, 'discount', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Multa</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-9"
                          value={data.penalty || ''}
                          onChange={(e) => updateEntryData(entry.id, 'penalty', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tarifa</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-9"
                          value={data.fee || ''}
                          onChange={(e) => updateEntryData(entry.id, 'fee', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor {isReceivable ? 'recebido' : 'pago'}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={entryRemaining + data.interest + data.penalty}
                          className="h-9 font-medium"
                          value={data.receivedValue || ''}
                          onChange={(e) => updateEntryData(entry.id, 'receivedValue', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}

              {/* Additional categorization link */}
              <button type="button" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                <span>↗</span> Categorização dos valores adicionais
              </button>
            </CollapsibleContent>
          </Collapsible>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || totalValue <= 0} className="bg-emerald-600 hover:bg-emerald-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Baixar pagamento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
