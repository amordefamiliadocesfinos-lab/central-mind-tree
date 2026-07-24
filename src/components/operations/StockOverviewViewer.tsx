import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Search, X, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product } from '@/hooks/useOrders';

interface Props {
  products: Product[];
  getBalance: (productId: string) => number;
  categories: string[];
}

type StockFilter = 'all' | 'in' | 'low' | 'out';

export function StockOverviewViewer({ products, getBalance, categories }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlySelected, setOnlySelected] = useState(false);

  const enriched = useMemo(
    () =>
      products.map((p) => {
        const balance = getBalance(p.id);
        const min = (p as any).min_stock ?? 0;
        let status: 'in' | 'low' | 'out' = 'in';
        if (balance <= 0) status = 'out';
        else if (min > 0 && balance <= min) status = 'low';
        return { ...p, balance, min, status };
      }),
    [products, getBalance]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter((p) => {
        if (onlySelected && !selected.has(p.id)) return false;
        if (category !== 'all' && p.category !== category) return false;
        if (stockFilter !== 'all' && p.status !== stockFilter) return false;
        if (q && !`${p.name} ${p.category ?? ''}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [enriched, search, category, stockFilter, onlySelected, selected]);

  const totals = useMemo(() => {
    const source = selected.size > 0 ? enriched.filter((p) => selected.has(p.id)) : filtered;
    const units = source.reduce((s, p) => s + (Number(p.balance) || 0), 0);
    return { count: source.length, units };
  }, [enriched, filtered, selected]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSel = filtered.every((p) => next.has(p.id));
      if (allSel) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelected(new Set());
    setOnlySelected(false);
  };

  const statusBadge = (s: 'in' | 'low' | 'out') => {
    if (s === 'out') return <Badge variant="destructive" className="text-[10px]">Sem estoque</Badge>;
    if (s === 'low') return <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">Baixo</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Em estoque</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Estoque Atual
          <span className="text-xs font-normal text-muted-foreground ml-1">
            ({totals.count} {totals.count === 1 ? 'item' : 'itens'} · {totals.units.toLocaleString('pt-BR')} un)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-full sm:w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
            <SelectTrigger className="h-9 w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo estoque</SelectItem>
              <SelectItem value="in">Em estoque</SelectItem>
              <SelectItem value="low">Baixo</SelectItem>
              <SelectItem value="out">Sem estoque</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={toggleAllVisible} className="h-8">
            <CheckSquare className="h-3.5 w-3.5 mr-1" />
            {filtered.every((p) => selected.has(p.id)) && filtered.length > 0 ? 'Desmarcar visíveis' : 'Selecionar visíveis'}
          </Button>
          {selected.size > 0 && (
            <>
              <Button
                size="sm"
                variant={onlySelected ? 'default' : 'outline'}
                onClick={() => setOnlySelected((v) => !v)}
                className="h-8"
              >
                Ver só selecionados ({selected.size})
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection} className="h-8">
                <X className="h-3.5 w-3.5 mr-1" /> Limpar
              </Button>
            </>
          )}
        </div>

        <ScrollArea className="h-[420px] rounded-md border">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((p) => {
                const isSel = selected.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors',
                      isSel && 'bg-primary/5'
                    )}
                  >
                    <Checkbox checked={isSel} onCheckedChange={() => toggle(p.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{p.name}</span>
                        {statusBadge(p.status)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.category || 'Sem categoria'}
                        {p.min > 0 && <> · mín. {p.min}</>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn(
                        'text-base font-semibold tabular-nums',
                        p.status === 'out' && 'text-destructive',
                        p.status === 'low' && 'text-amber-600'
                      )}>
                        {p.balance.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-[10px] text-muted-foreground">em estoque</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
