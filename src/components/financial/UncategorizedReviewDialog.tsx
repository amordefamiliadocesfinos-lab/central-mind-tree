import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FinancialCategory } from '@/hooks/useFinancial';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; categories: FinancialCategory[]; onChanged?: () => void; }
interface ReviewEntry { id: string; description: string; value: number; due_date: string; type: 'pagar' | 'receber'; import_file_name?: string | null; }

export function UncategorizedReviewDialog({ open, onOpenChange, categories, onChanged }: Props) {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('financial_entries')
      .select('id,description,value,due_date,type,import_file_name')
      .not('import_source', 'is', null).is('category_id', null)
      .order('due_date', { ascending: false }).limit(300);
    if (error) toast.error('Erro ao carregar lançamentos sem categoria');
    setEntries((data as ReviewEntry[]) || []); setLoading(false);
  };
  useEffect(() => { if (open) load(); }, [open]);
  const categorize = async (entry: ReviewEntry, categoryId: string) => {
    const { error } = await supabase.from('financial_entries').update({ category_id: categoryId }).eq('id', entry.id);
    if (error) return toast.error('Erro ao salvar categoria');
    setEntries(current => current.filter(item => item.id !== entry.id));
    onChanged?.();
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Revisar lançamentos importados</DialogTitle><DialogDescription>Classifique somente os registros ainda sem categoria. Cada escolha é salva imediatamente.</DialogDescription></DialogHeader>
    <div className="flex items-center justify-between"><Badge variant="secondary">{entries.length} pendentes</Badge>{loading && <span className="text-sm text-muted-foreground">Carregando...</span>}</div>
    <div className="space-y-2">{entries.map(entry => <div key={entry.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_220px] sm:items-center">
      <div><p className="font-medium">{entry.description}</p><p className="text-xs text-muted-foreground">{entry.due_date} · {entry.import_file_name || 'importação'}</p></div>
      <span className="font-medium">{formatCurrency(Number(entry.value))}</span>
      <Select onValueChange={value => categorize(entry, value)}><SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger><SelectContent>{categories.filter(category => category.type === entry.type || category.type === 'ambos').map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select>
    </div>)}</div>
    {!loading && entries.length === 0 && <p className="py-8 text-center text-muted-foreground">Todos os importados estão categorizados.</p>}
    <div className="flex justify-end"><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></div>
  </DialogContent></Dialog>;
}
