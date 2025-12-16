import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type MovementType = 'in' | 'out' | 'reserve' | 'consume' | 'adjust';

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  previous_balance: number;
  new_balance: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export const MOVEMENT_LABELS: Record<MovementType, { label: string; color: string }> = {
  in: { label: 'Entrada', color: 'bg-green-500' },
  out: { label: 'Saída', color: 'bg-red-500' },
  reserve: { label: 'Reserva', color: 'bg-amber-500' },
  consume: { label: 'Consumo', color: 'bg-orange-500' },
  adjust: { label: 'Ajuste', color: 'bg-blue-500' },
};

export function useInventoryMovements() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMovements = useCallback(async (productId?: string) => {
    setLoading(true);
    let query = supabase
      .from('inventory_movements')
      .select('*')
      .order('created_at', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching movements:', error);
      setLoading(false);
      return [];
    }

    setMovements((data as InventoryMovement[]) || []);
    setLoading(false);
    return (data as InventoryMovement[]) || [];
  }, []);

  const getCurrentBalance = useCallback(async (productId: string): Promise<number> => {
    const { data, error } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', productId)
      .maybeSingle();

    if (error) {
      console.error('Error getting balance:', error);
      return 0;
    }

    return data?.quantity || 0;
  }, []);

  const createMovement = useCallback(async (
    productId: string,
    type: MovementType,
    quantity: number,
    notes?: string,
    referenceType?: string,
    referenceId?: string
  ): Promise<InventoryMovement | null> => {
    // Get current balance
    const previousBalance = await getCurrentBalance(productId);
    
    // Calculate new balance based on movement type
    let newBalance = previousBalance;
    switch (type) {
      case 'in':
        newBalance = previousBalance + quantity;
        break;
      case 'out':
      case 'consume':
        newBalance = Math.max(0, previousBalance - quantity);
        break;
      case 'reserve':
        // Reserve doesn't change balance but marks items as reserved
        newBalance = previousBalance;
        break;
      case 'adjust':
        // Adjust sets the balance directly (quantity is the new balance)
        newBalance = quantity;
        break;
    }

    // Create movement record
    const { data: movement, error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: productId,
        movement_type: type,
        quantity: type === 'adjust' ? quantity - previousBalance : quantity,
        previous_balance: previousBalance,
        new_balance: newBalance,
        reference_type: referenceType || null,
        reference_id: referenceId || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (movementError) {
      toast.error('Erro ao registrar movimento');
      console.error('Movement error:', movementError);
      return null;
    }

    // Update inventory balance (upsert)
    const { error: inventoryError } = await supabase
      .from('inventory')
      .upsert({
        product_id: productId,
        quantity: newBalance,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id',
      });

    if (inventoryError) {
      console.error('Inventory update error:', inventoryError);
    }

    toast.success(`Movimento registrado: ${MOVEMENT_LABELS[type].label}`);
    return movement as InventoryMovement;
  }, [getCurrentBalance]);

  const getProductHistory = useCallback(async (productId: string): Promise<InventoryMovement[]> => {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
      return [];
    }

    return (data as InventoryMovement[]) || [];
  }, []);

  return {
    movements,
    loading,
    fetchMovements,
    createMovement,
    getProductHistory,
    getCurrentBalance,
    movementLabels: MOVEMENT_LABELS,
  };
}
