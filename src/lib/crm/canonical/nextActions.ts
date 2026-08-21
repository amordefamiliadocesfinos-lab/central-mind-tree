import type { CrmCanonicalNextAction, CrmNextActionCode } from './types';

const action = (code: CrmNextActionCode, label: string, nature: CrmCanonicalNextAction['nature'], description: string, canBeFuture = false, canGenerateOperationalTask = false): CrmCanonicalNextAction => ({ code, label, nature, description, canBeImmediate: true, canBeFuture, requiresTimeWhenFuture: canBeFuture, canGenerateOperationalTask });

/** Fonte canônica: Documento 09.03 V1.1. A ausência legítima é null, nunca um código. */
export const CRM_CANONICAL_NEXT_ACTIONS = [
  action('CRM-PA-001', 'Qualificar contato', 'commercial', 'Obter informações essenciais para qualificação.'),
  action('CRM-PA-002', 'Identificar oportunidade', 'commercial', 'Entender necessidade e oportunidade atual.'),
  action('CRM-PA-003', 'Reavaliar oportunidade', 'commercial', 'Reinterpretar necessidade ou contexto alterado.'),
  action('CRM-PA-004', 'Apresentar solução', 'commercial', 'Apresentar solução compatível.'),
  action('CRM-PA-005', 'Validar aderência da solução', 'commercial', 'Confirmar aderência da solução.'),
  action('CRM-PA-006', 'Esclarecer dúvida', 'relational', 'Esclarecer dúvida factual relevante.'),
  action('CRM-PA-007', 'Elaborar/atualizar proposta', 'commercial', 'Elaborar ou atualizar condição comercial.', false, true),
  action('CRM-PA-008', 'Verificar condição comercial', 'validation', 'Validar condição decisiva para continuidade.', false, true),
  action('CRM-PA-009', 'Tratar objeção', 'commercial', 'Tratar barreira comercial identificada.'),
  action('CRM-PA-010', 'Concluir pedido', 'commercial', 'Concluir a etapa comercial do pedido.', false, true),
  action('CRM-PA-011', 'Solicitar dados necessários', 'relational', 'Solicitar informação necessária.'),
  action('CRM-PA-012', 'Orientar pagamento', 'relational', 'Orientar o pagamento necessário.'),
  action('CRM-PA-013', 'Conferir pagamento', 'validation', 'Conferir pagamento informado.', false, true),
  action('CRM-PA-014', 'Retomar contato', 'relational', 'Retomar contato por motivo legítimo.', true, true),
  action('CRM-PA-015', 'Confirmar recebimento', 'post_sale', 'Confirmar recebimento adequado.'),
  action('CRM-PA-016', 'Avaliar experiência', 'post_sale', 'Obter feedback de experiência.'),
  action('CRM-PA-017', 'Tratar/acompanhar ocorrência', 'post_sale', 'Conduzir problema até resolução.', false, true),
  action('CRM-PA-018', 'Avaliar reposição', 'post_sale', 'Verificar necessidade real de reposição.'),
  action('CRM-PA-019', 'Conduzir nova compra', 'commercial', 'Conduzir recompra ou nova oportunidade.'),
] as const satisfies readonly CrmCanonicalNextAction[];

export const CRM_NEXT_ACTIONS_BY_CODE = new Map(CRM_CANONICAL_NEXT_ACTIONS.map(item => [item.code, item]));
export function getCanonicalNextAction(code?: string | null) { return code ? CRM_NEXT_ACTIONS_BY_CODE.get(code as CrmNextActionCode) ?? null : null; }
