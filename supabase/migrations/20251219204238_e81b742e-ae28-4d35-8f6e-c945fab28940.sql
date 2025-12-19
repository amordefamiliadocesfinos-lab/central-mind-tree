-- First, drop the existing check constraint on movement_type
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;

-- Recreate the check constraint including 'transfer' type
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_movement_type_check 
CHECK (movement_type IN ('in', 'out', 'transfer', 'reserve', 'consume', 'adjust'));