export const CRM_FUNNEL_STAGES = [
  { key: 'novo_lead', label: 'Novo Lead' },
  { key: 'contato_realizado', label: 'Contato Realizado' },
  { key: 'proposta_enviada', label: 'Proposta Enviada' },
  { key: 'negociacao', label: 'Negociação' },
  { key: 'fechado', label: 'Fechado' },
  { key: 'pos_venda', label: 'Pós-Venda' },
  { key: 'cadencia', label: 'Cadência' },
  { key: 'perdido', label: 'Perdido' },
] as const;

export type CrmFunnelStage = typeof CRM_FUNNEL_STAGES[number]['key'];

const STAGE_ALIASES: Record<string, CrmFunnelStage> = {
  novo: 'novo_lead',
  lead: 'novo_lead',
  em_contato: 'contato_realizado',
  contato_feito: 'contato_realizado',
  qualificado: 'contato_realizado',
  interested: 'contato_realizado',
  engaged: 'negociacao',
  proposta: 'proposta_enviada',
  orcamento: 'proposta_enviada',
  convertido: 'fechado',
  cliente_ativo: 'pos_venda',
  vip: 'pos_venda',
  customer: 'pos_venda',
  inativo: 'cadencia',
};

const STAGE_KEYS = new Set<string>(CRM_FUNNEL_STAGES.map(stage => stage.key));

export function normalizeCrmStage(stage?: string | null): CrmFunnelStage {
  if (!stage) return 'novo_lead';
  if (STAGE_KEYS.has(stage)) return stage as CrmFunnelStage;
  return STAGE_ALIASES[stage] || 'novo_lead';
}

export function getCrmStageLabel(stage?: string | null): string {
  const normalized = normalizeCrmStage(stage);
  return CRM_FUNNEL_STAGES.find(item => item.key === normalized)?.label || 'Novo Lead';
}

export const CRM_EVENT_CODES = {
  LEAD_CREATED: 'lead_created',
  CONTACT_ATTEMPTED: 'contact_attempted',
  MESSAGE_SENT: 'message_sent',
  CUSTOMER_REPLIED: 'customer_replied',
  FOLLOW_UP_SCHEDULED: 'follow_up_scheduled',
  FOLLOW_UP_COMPLETED: 'follow_up_completed',
  PROPOSAL_SENT: 'proposal_sent',
  NEGOTIATION_STARTED: 'negotiation_started',
  SALE_WON: 'sale_won',
  SALE_LOST: 'sale_lost',
  POST_SALE_COMPLETED: 'post_sale_completed',
  STAGE_CHANGED: 'stage_changed',
} as const;

export type CrmEventCode = typeof CRM_EVENT_CODES[keyof typeof CRM_EVENT_CODES];
