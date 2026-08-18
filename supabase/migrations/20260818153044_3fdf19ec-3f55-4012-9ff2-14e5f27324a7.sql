INSERT INTO public.inventory_movements (product_id, movement_type, quantity, previous_balance, new_balance, location, reference_type, notes)
SELECT product_id, 'adjust', quantity, quantity, 0, location, 'manual', 'Ajuste: saldo legado sem local consolidado e zerado conforme contagem'
FROM public.inventory
WHERE product_id = 'd3065783-10c7-42c3-88c7-41366aa8c5ba' AND location = 'Fábrica' AND quantity <> 0;

UPDATE public.inventory SET quantity = 0, updated_at = now()
WHERE product_id = 'd3065783-10c7-42c3-88c7-41366aa8c5ba' AND location = 'Fábrica';