import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInventoryMovements, MovementType, MOVEMENT_LABELS } from '@/hooks/useInventoryMovements';
import { ArrowDownCircle, ArrowUpCircle, Package, Wrench, BookmarkCheck } from 'lucide-react';

interface InventoryMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  currentBalance: number;
  onSuccess: () => void;
}

const MOVEMENT_ICONS: Record<MovementType, React.ReactNode> = {
  in: <ArrowDownCircle className="h-4 w-4 text-green-500" />,
  out: <ArrowUpCircle className="h-4 w-4 text-red-500" />,
  reserve: <BookmarkCheck className="h-4 w-4 text-amber-500" />,
  consume: <Package className="h-4 w-4 text-orange-500" />,
  adjust: <Wrench className="h-4 w-4 text-blue-500" />,
};

export function InventoryMovementDialog({
  open,
  onOpenChange,
  productId,
  productName,
  currentBalance,
  onSuccess,
}: InventoryMovementDialogProps) {
  const { createMovement } = useInventoryMovements();
  const [type, setType] = useState<MovementType>('in');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (quantity <= 0 && type !== 'adjust') {
      return;
    }

    setLoading(true);
    const result = await createMovement(productId, type, quantity, notes || undefined);
    setLoading(false);

    if (result) {
      onSuccess();
      onOpenChange(false);
      setType('in');
      setQuantity(1);
      setNotes('');
    }
  };

  const calculateNewBalance = () => {
    switch (type) {
      case 'in':
        return currentBalance + quantity;
      case 'out':
      case 'consume':
        return Math.max(0, currentBalance - quantity);
      case 'reserve':
        return currentBalance;
      case 'adjust':
        return quantity;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimento de Estoque</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">{productName}</p>
            <p className="text-sm text-muted-foreground">
              Saldo atual: <span className="font-bold">{currentBalance}</span>
            </p>
          </div>

          <div>
            <Label>Tipo de Movimento</Label>
            <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(MOVEMENT_LABELS) as [MovementType, { label: string }][]).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      {MOVEMENT_ICONS[key]}
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              {type === 'adjust' ? 'Novo Saldo' : 'Quantidade'}
            </Label>
            <Input
              type="number"
              step="any"
              min={type === 'adjust' ? 0 : 0.000001}
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="p-3 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Novo saldo após movimento:</p>
            <p className="text-2xl font-bold">{calculateNewBalance()}</p>
          </div>

          <div>
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo ou referência..."
              rows={2}
            />
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? 'Registrando...' : 'Registrar Movimento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
