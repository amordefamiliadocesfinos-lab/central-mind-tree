interface IdentifiableOrder {
  id: string;
  order_number?: string | null;
  customer_name?: string | null;
}

export function getOrderReference(order: IdentifiableOrder): string {
  const orderNumber = order.order_number?.trim();
  return orderNumber || `#${order.id.slice(0, 6)}`;
}

export function getOrderCustomerName(order: IdentifiableOrder): string {
  return order.customer_name?.trim() || 'Cliente não informado';
}
