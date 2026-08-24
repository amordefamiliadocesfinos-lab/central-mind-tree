/** Eventos de estoque que podem decorrer de um pedido, independentemente do canal. */
export type OrderStockEvent =
  | 'confirmed'
  | 'cancelled'
  | 'shipped'
  | 'external_shipped';

/**
 * O pedido é um compromisso. Nesta fundação somente a expedição gera baixa
 * física; reserva e déficit serão evoluções posteriores do mesmo contrato.
 */
export function getOrderStockEventForStatus(status: string): OrderStockEvent | null {
  if (status === 'enviado' || status === 'entregue') return 'shipped';
  if (status === 'cancelado') return 'cancelled';
  if (status === 'confirmado') return 'confirmed';
  return null;
}

/** Enviado e enviado externamente compartilham a mesma saída física. */
export function getPhysicalStockEvent(event: OrderStockEvent): 'physical_out' | null {
  return event === 'shipped' || event === 'external_shipped' ? 'physical_out' : null;
}

/** Chave estável, usada pela migration para impedir a repetição da baixa. */
export function getOrderStockEventKey(
  orderId: string,
  event: OrderStockEvent,
  orderItemId: string,
  location: string,
): string {
  const physicalEvent = getPhysicalStockEvent(event) || event;
  return `order:${orderId}:${physicalEvent}:${orderItemId}:${location}`;
}
