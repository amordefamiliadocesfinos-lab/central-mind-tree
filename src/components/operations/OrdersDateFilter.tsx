import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

export type OrderDateField = 'due_date' | 'order_date' | 'created_at';
export type OrderDatePreset = 'all' | 'today' | 'week' | 'month' | 'last7' | 'last30' | 'custom';

export interface OrdersDateFilterValue {
  preset: OrderDatePreset;
  field: OrderDateField;
  range?: DateRange;
}

interface Props {
  value: OrdersDateFilterValue;
  onChange: (v: OrdersDateFilterValue) => void;
}

const PRESETS: { key: OrderDatePreset; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'last7', label: '7 dias' },
  { key: 'last30', label: '30 dias' },
];

const FIELD_LABEL: Record<OrderDateField, string> = {
  due_date: 'Entrega',
  order_date: 'Pedido',
  created_at: 'Criação',
};

export function resolveDateRange(v: OrdersDateFilterValue): { from: Date; to: Date } | null {
  const now = new Date();
  switch (v.preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last7':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'last30':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'custom':
      if (v.range?.from) {
        return {
          from: startOfDay(v.range.from),
          to: endOfDay(v.range.to ?? v.range.from),
        };
      }
      return null;
    default:
      return null;
  }
}

export function filterOrdersByDate<T>(
  orders: T[],
  value: OrdersDateFilterValue,
): T[] {
  const interval = resolveDateRange(value);
  if (!interval) return orders;
  return orders.filter((o) => {
    const raw = (o as Record<string, unknown>)[value.field] as string | null | undefined;
    if (!raw) return false;
    try {
      const d = typeof raw === 'string' && raw.length === 10 ? parseISO(raw) : new Date(raw);
      return isWithinInterval(d, { start: interval.from, end: interval.to });
    } catch {
      return false;
    }
  });
}

export function OrdersDateFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const interval = resolveDateRange(value);
  const isActive = value.preset !== 'all';

  const customLabel = () => {
    if (value.preset === 'custom' && value.range?.from) {
      const from = format(value.range.from, 'dd/MM/yy', { locale: ptBR });
      const to = value.range.to ? format(value.range.to, 'dd/MM/yy', { locale: ptBR }) : from;
      return from === to ? from : `${from} – ${to}`;
    }
    return 'Personalizado';
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={value.field}
        onValueChange={(f) => onChange({ ...value, field: f as OrderDateField })}
      >
        <SelectTrigger className="h-9 w-auto min-w-[110px] rounded-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="due_date">Entrega</SelectItem>
          <SelectItem value="order_date">Pedido</SelectItem>
          <SelectItem value="created_at">Criação</SelectItem>
        </SelectContent>
      </Select>

      <div className="scroll-x-container">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            variant={value.preset === p.key ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 h-9 px-4 rounded-full text-sm touch-manipulation active:scale-95"
            onClick={() =>
              onChange({
                ...value,
                preset: value.preset === p.key ? 'all' : p.key,
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
              variant={value.preset === 'custom' ? 'default' : 'outline'}
              size="sm"
              className="shrink-0 h-9 px-4 rounded-full text-sm gap-2"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {customLabel()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
            <Calendar
              mode="range"
              selected={value.range}
              onSelect={(range) =>
                onChange({ ...value, preset: 'custom', range })
              }
              numberOfMonths={2}
              locale={ptBR}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>

        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-9 px-3 rounded-full text-sm text-destructive"
            onClick={() => onChange({ ...value, preset: 'all', range: undefined })}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {isActive && interval && (
        <span className="text-xs text-muted-foreground hidden md:inline">
          {FIELD_LABEL[value.field]}:{' '}
          {format(interval.from, 'dd/MM/yy', { locale: ptBR })} –{' '}
          {format(interval.to, 'dd/MM/yy', { locale: ptBR })}
        </span>
      )}
    </div>
  );
}
