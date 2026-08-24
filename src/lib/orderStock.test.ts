import {
  getOrderStockEventForStatus,
  getOrderStockEventKey,
  getPhysicalStockEvent,
} from './orderStockContract';

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Teste pequeno e independente de Supabase: valida a parte determinística do contrato.
const orderId = '11111111-1111-1111-1111-111111111111';
const itemId = '22222222-2222-2222-2222-222222222222';

expect(getOrderStockEventForStatus('enviado') === 'shipped', 'Enviado deve gerar expedição');
expect(getOrderStockEventForStatus('entregue') === 'shipped', 'Entregue não pode baixar duas vezes');
expect(getOrderStockEventForStatus('confirmado') === 'confirmed', 'Confirmado deve permanecer sem saída física');
expect(getOrderStockEventForStatus('pendente') === null, 'Pendente não deve movimentar estoque');
expect(getPhysicalStockEvent('external_shipped') === 'physical_out', 'Canal externo usa a mesma saída física');

const shippedKey = getOrderStockEventKey(orderId, 'shipped', itemId, 'Fábrica');
const deliveredKey = getOrderStockEventKey(orderId, 'external_shipped', itemId, 'Fábrica');
expect(shippedKey === deliveredKey, 'A mesma expedição deve ter uma única chave idempotente');
