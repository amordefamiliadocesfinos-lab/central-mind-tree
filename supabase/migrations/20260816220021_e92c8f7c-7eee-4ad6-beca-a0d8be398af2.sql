update production_orders p
set status = case when o.status = 'cancelado' then 'cancelado' else 'concluido' end,
    completed_at = case when o.status = 'cancelado' then null else coalesce(p.completed_at, now()) end,
    notes = coalesce(p.notes || E'\n', '') || '[16/08/2026] Encerrada automaticamente - pedido ' || coalesce(o.order_number, '') || ' ' || o.status,
    updated_at = now()
from orders o
where o.id = p.source_order_id
  and o.status in ('concluido','cancelado','entregue')
  and p.status not in ('concluido','cancelado');