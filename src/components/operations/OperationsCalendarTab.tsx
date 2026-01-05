import { useState, useEffect, useMemo } from 'react';
import { Order } from '@/hooks/useOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Package } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface OperationsCalendarTabProps {
  orders: Order[];
  orderStatus: Record<string, { label: string; color: string }>;
  onOrderClick: (order: Order) => void;
  onDateChange?: (orderId: string, newDate: string) => Promise<void>;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function OperationsCalendarTab({ 
  orders, 
  orderStatus, 
  onOrderClick,
  onDateChange,
}: OperationsCalendarTabProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Get days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  // Create calendar grid
  const calendarDays = useMemo(() => {
    const days: { date: Date; dateKey: string; isCurrentMonth: boolean }[] = [];
    
    // Previous month days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      days.push({
        date,
        dateKey: date.toISOString().split('T')[0],
        isCurrentMonth: false,
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        dateKey: date.toISOString().split('T')[0],
        isCurrentMonth: true,
      });
    }
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        dateKey: date.toISOString().split('T')[0],
        isCurrentMonth: false,
      });
    }
    
    return days;
  }, [year, month, daysInMonth, firstDayOfMonth]);

  // Group orders by due_date
  const ordersByDate = useMemo(() => {
    const map: Record<string, Order[]> = {};
    orders.forEach(order => {
      if (order.due_date) {
        if (!map[order.due_date]) map[order.due_date] = [];
        map[order.due_date].push(order);
      }
    });
    return map;
  }, [orders]);

  const navigateMonth = (delta: number) => {
    setCurrentMonth(new Date(year, month + delta, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const isToday = (dateKey: string) => {
    return dateKey === new Date().toISOString().split('T')[0];
  };

  const handleDragStart = (order: Order) => {
    setDraggedOrder(order);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    if (draggedOrder && onDateChange) {
      await onDateChange(draggedOrder.id, dateKey);
    }
    setDraggedOrder(null);
  };

  const dayOrders = selectedDate ? ordersByDate[selectedDate] || [] : [];

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <h2 className="text-lg font-semibold">{MONTHS[month]} {year}</h2>
          <Button variant="link" size="sm" onClick={goToToday} className="text-xs">
            Hoje
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-2">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ date, dateKey, isCurrentMonth }) => {
              const dayOrdersList = ordersByDate[dateKey] || [];
              const hasOrders = dayOrdersList.length > 0;
              const today = isToday(dateKey);
              const selected = selectedDate === dateKey;

              return (
                <div
                  key={dateKey}
                  className={cn(
                    'relative min-h-[60px] p-1 rounded-md border transition-colors cursor-pointer',
                    !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
                    today && 'ring-2 ring-primary',
                    selected && 'bg-primary/10 border-primary',
                    hasOrders && 'border-primary/50',
                    'hover:bg-muted/50'
                  )}
                  onClick={() => setSelectedDate(dateKey)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, dateKey)}
                >
                  <span className={cn(
                    'text-xs font-medium',
                    today && 'text-primary font-bold'
                  )}>
                    {date.getDate()}
                  </span>
                  
                  {/* Order indicators */}
                  {hasOrders && (
                    <div className="mt-1 space-y-0.5">
                      {dayOrdersList.slice(0, 2).map(order => (
                        <div
                          key={order.id}
                          className={cn(
                            'text-[9px] px-1 py-0.5 rounded truncate text-white',
                            orderStatus[order.status]?.color || 'bg-gray-500'
                          )}
                          draggable
                          onDragStart={() => handleDragStart(order)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOrderClick(order);
                          }}
                        >
                          {order.customer_name || order.order_number}
                        </div>
                      ))}
                      {dayOrdersList.length > 2 && (
                        <div className="text-[9px] text-muted-foreground text-center">
                          +{dayOrdersList.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Orders */}
      {selectedDate && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Pedidos para {selectedDate.split('-').reverse().join('/')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dayOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum pedido para esta data
              </p>
            ) : (
              <div className="space-y-2">
                {dayOrders.map(order => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => onOrderClick(order)}
                    draggable
                    onDragStart={() => handleDragStart(order)}
                  >
                    <div>
                      <p className="font-medium">
                        {order.customer_name || `Pedido #${order.order_number || order.id.slice(0, 8)}`}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="h-3 w-3" />
                        <span>{order.items?.length || 0} itens</span>
                        {order.total_value && (
                          <span>• {formatCurrency(order.total_value)}</span>
                        )}
                      </div>
                    </div>
                    <Badge className={cn('text-white', orderStatus[order.status]?.color)}>
                      {orderStatus[order.status]?.label || order.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Drag hint */}
      <p className="text-xs text-center text-muted-foreground">
        Arraste pedidos entre dias para alterar o prazo
      </p>
    </div>
  );
}
