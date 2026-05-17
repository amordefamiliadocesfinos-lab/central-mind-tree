import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ArrowDownAZ, ArrowUpAZ, Clock, History, TrendingUp, TrendingDown,
  PackageMinus, CalendarIcon, X, Lightbulb, LightbulbOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

export type ProductSortKey =
  | 'az'
  | 'za'
  | 'newest'
  | 'oldest'
  | 'price_desc'
  | 'price_asc'
  | 'low_stock';

export type ProductPeriodPreset = 'all' | 'today' | 'week' | 'month' | 'last30' | 'custom';
export type ProductIdeaLinkFilter = 'all' | 'linked' | 'unlinked';

export interface ProductsSubFiltersValue {
  sort: ProductSortKey;
  periodPreset: ProductPeriodPreset;
  range?: DateRange;
  ideaLink?: ProductIdeaLinkFilter;
}

interface Props {
  value: ProductsSubFiltersValue;
  onChange: (v: ProductsSubFiltersValue) => void;
}

const SORT_OPTIONS: { key: ProductSortKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'az', label: 'A-Z', icon: ArrowDownAZ },
  { key: 'za', label: 'Z-A', icon: ArrowUpAZ },
  { key: 'newest', label: 'Mais recentes', icon: Clock },
  { key: 'oldest', label: 'Mais antigos', icon: History },
  { key: 'price_desc', label: 'Maior preço', icon: TrendingUp },
  { key: 'price_asc', label: 'Menor preço', icon: TrendingDown },
  { key: 'low_stock', label: 'Estoque baixo', icon: PackageMinus },
];

const PERIOD_PRESETS: { key: ProductPeriodPreset; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'last30', label: '30 dias' },
];

export function resolveProductPeriod(v: ProductsSubFiltersValue): { from: Date; to: Date } | null {
  const now = new Date();
  switch (v.periodPreset) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case 'week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month': return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last30': return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'custom':
      if (v.range?.from) {
        return { from: startOfDay(v.range.from), to: endOfDay(v.range.to ?? v.range.from) };
      }
      return null;
    default: return null;
  }
}

export function applyProductsSubFilters<
  T extends { name: string; created_at: string; price: number | null; min_stock: number; id: string }
>(
  products: T[],
  value: ProductsSubFiltersValue,
  getBalance: (id: string) => number,
): T[] {
  let result = [...products];

  // Period filter on created_at
  const period = resolveProductPeriod(value);
  if (period) {
    result = result.filter((p) => {
      try {
        const d = p.created_at?.length === 10 ? parseISO(p.created_at) : new Date(p.created_at);
        return isWithinInterval(d, { start: period.from, end: period.to });
      } catch { return false; }
    });
  }

  // Normalize name for alphabetic sort: strip emojis/symbols, trim, lowercase, remove accents
  const normalizeName = (n: string) =>
    (n || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^\p{L}\p{N}\s]/gu, '') // remove emojis/symbols
      .trim()
      .toLowerCase();

  // Sort
  switch (value.sort) {
    case 'az':
      result.sort((a, b) =>
        normalizeName(a.name).localeCompare(normalizeName(b.name), 'pt-BR', {
          sensitivity: 'base',
          numeric: true,
          ignorePunctuation: true,
        }),
      );
      break;
    case 'za':
      result.sort((a, b) =>
        normalizeName(b.name).localeCompare(normalizeName(a.name), 'pt-BR', {
          sensitivity: 'base',
          numeric: true,
          ignorePunctuation: true,
        }),
      );
      break;
    case 'newest':
      result.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      break;
    case 'oldest':
      result.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      break;
    case 'price_desc':
      result.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'price_asc':
      result.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case 'low_stock':
      result.sort((a, b) => {
        const ba = getBalance(a.id);
        const bb = getBalance(b.id);
        const diffA = ba - a.min_stock;
        const diffB = bb - b.min_stock;
        return diffA - diffB;
      });
      break;
  }
  return result;
}

export function ProductsSubFilters({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const period = resolveProductPeriod(value);
  const periodActive = value.periodPreset !== 'all';

  const customLabel = () => {
    if (value.periodPreset === 'custom' && value.range?.from) {
      const from = format(value.range.from, 'dd/MM/yy', { locale: ptBR });
      const to = value.range.to ? format(value.range.to, 'dd/MM/yy', { locale: ptBR }) : from;
      return from === to ? from : `${from} – ${to}`;
    }
    return 'Personalizado';
  };

  return (
    <div className="space-y-2">
      <div className="scroll-x-container">
        {SORT_OPTIONS.map(({ key, label, icon: Icon }) => {
          const active = value.sort === key;
          return (
            <Button
              key={key}
              variant={active ? 'default' : 'outline'}
              size="sm"
              className="shrink-0 h-9 px-3 rounded-full text-xs gap-1.5 touch-manipulation active:scale-95"
              onClick={() => onChange({ ...value, sort: key })}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          );
        })}

        {PERIOD_PRESETS.map((p) => (
          <Button
            key={p.key}
            variant={value.periodPreset === p.key ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 h-9 px-3 rounded-full text-xs touch-manipulation active:scale-95"
            onClick={() =>
              onChange({
                ...value,
                periodPreset: value.periodPreset === p.key ? 'all' : p.key,
                range: undefined,
              })
            }
          >
            {p.label}
          </Button>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={value.periodPreset === 'custom' ? 'default' : 'outline'}
              size="sm"
              className="shrink-0 h-9 px-3 rounded-full text-xs gap-1.5"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {customLabel()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
            <Calendar
              mode="range"
              selected={value.range}
              onSelect={(range) => onChange({ ...value, periodPreset: 'custom', range })}
              numberOfMonths={2}
              locale={ptBR}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>

        {periodActive && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-9 px-3 rounded-full text-xs text-destructive"
            onClick={() => onChange({ ...value, periodPreset: 'all', range: undefined })}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar período
          </Button>
        )}
      </div>

      {periodActive && period && (
        <span className="text-xs text-muted-foreground hidden md:inline">
          Criado entre {format(period.from, 'dd/MM/yy', { locale: ptBR })} – {format(period.to, 'dd/MM/yy', { locale: ptBR })}
        </span>
      )}
    </div>
  );
}
