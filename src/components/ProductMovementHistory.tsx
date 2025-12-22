import { useEffect, useState } from 'react';
import { useInventoryMovements, InventoryMovement, MOVEMENT_LABELS, MovementType } from '@/hooks/useInventoryMovements';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProductMovementHistoryProps {
  productId: string;
}

export function ProductMovementHistory({ productId }: ProductMovementHistoryProps) {
  const { getProductHistory } = useInventoryMovements();
  const [history, setHistory] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getProductHistory(productId);
      setHistory(data);
      setLoading(false);
    };
    load();
  }, [productId, getProductHistory]);

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>;
  }

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum movimento registrado.
      </p>
    );
  }

  return (
    <ScrollArea className="h-64">
      <div className="space-y-2">
        {history.map((movement) => {
          const label = MOVEMENT_LABELS[movement.movement_type as MovementType] || { 
            label: movement.movement_type, 
            color: 'bg-gray-500' 
          };
          const isPositive = movement.movement_type === 'in' || 
            (movement.movement_type === 'adjust' && movement.quantity > 0);
          
          return (
            <div
              key={movement.id}
              className="flex items-center justify-between p-2 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <Badge className={cn('text-white text-xs', label.color)}>
                  {label.label}
                </Badge>
                <div>
                  <p className={cn(
                    'font-medium text-sm',
                    isPositive ? 'text-green-600' : 'text-red-600'
                  )}>
                    {isPositive ? '+' : '-'}{Math.abs(movement.quantity)}
                  </p>
                  {movement.notes && (
                    <p className="text-xs text-muted-foreground">{movement.notes}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {format(new Date(movement.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </p>
                <p className="text-xs">
                  {movement.previous_balance} → {movement.new_balance}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
