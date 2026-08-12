export const SALES_CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp / venda direta' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'mercado_livre', label: 'Mercado Livre' },
  { value: 'atacado', label: 'Grandes clientes / atacado' },
  { value: 'outros', label: 'Outros' },
] as const;

export const salesChannelLabel = (value?: string | null) =>
  SALES_CHANNELS.find(channel => channel.value === value)?.label || value || 'Não informado';

export const channelNeedsAccount = (value?: string | null) =>
  value === 'shopee' || value === 'mercado_livre';
