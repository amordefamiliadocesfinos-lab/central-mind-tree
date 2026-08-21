import type { CrmCanonicalResult, CrmResultCode } from './types';

const result = (code: CrmResultCode, label: string, family: CrmCanonicalResult['family'], description: string, transversal = false, requiresAdditionalContext = false): CrmCanonicalResult => ({ code, label, family, description, transversal, requiresAdditionalContext });

/** Fonte canônica: Documento 09.04, seção 5. O 09.02 fornece a semântica. */
export const CRM_CANONICAL_RESULTS = [
  result('CRM-RES-001', 'Interesse demonstrado', 'interest', 'O contato demonstrou abertura comercial real.'),
  result('CRM-RES-002', 'Sem interesse', 'interest', 'O contato informou que não possui interesse.'),
  result('CRM-RES-003', 'Sem resposta', 'interest', 'Não houve resposta após interação relevante.', false, true),
  result('CRM-RES-004', 'Nova necessidade identificada', 'interest', 'Surgiu necessidade nova ou materialmente diferente.'),
  result('CRM-RES-005', 'Solução aprovada', 'solution_proposal', 'A solução atende à necessidade, sem significar aceitação comercial.'),
  result('CRM-RES-006', 'Solução não adequada', 'solution_proposal', 'A solução não atende ao contexto informado.'),
  result('CRM-RES-007', 'Proposta aceita', 'solution_proposal', 'A condição comercial foi aceita.'),
  result('CRM-RES-008', 'Proposta em análise', 'solution_proposal', 'A proposta está sob avaliação, sem decisão final.'),
  result('CRM-RES-009', 'Alteração comercial solicitada', 'solution_proposal', 'Foi solicitada alteração relevante de condição comercial.'),
  result('CRM-RES-010', 'Objeção identificada', 'objection_decision', 'Foi identificada uma barreira comercial.', false, true),
  result('CRM-RES-011', 'Objeção resolvida', 'objection_decision', 'A objeção deixou de impedir o avanço.'),
  result('CRM-RES-012', 'Objeção não resolvida', 'objection_decision', 'A barreira continua relevante.'),
  result('CRM-RES-013', 'Decisão adiada', 'objection_decision', 'A decisão foi adiada.'),
  result('CRM-RES-014', 'Decisão depende de terceiro', 'objection_decision', 'A decisão depende de outra pessoa.'),
  result('CRM-RES-015', 'Desistência informada', 'objection_decision', 'O contato desistiu de processo comercial já em andamento.'),
  result('CRM-RES-016', 'Sem solução compatível', 'objection_decision', 'Não há solução compatível no contexto atual.'),
  result('CRM-RES-017', 'Aguardando dados do cliente', 'closing_payment', 'Faltam dados do contato para continuidade.'),
  result('CRM-RES-018', 'Aguardando pagamento', 'closing_payment', 'O pagamento é a pendência atual.'),
  result('CRM-RES-019', 'Pagamento informado', 'closing_payment', 'O pagamento foi informado, mas ainda não confirmado.'),
  result('CRM-RES-020', 'Pagamento confirmado', 'closing_payment', 'O pagamento foi confirmado por fonte confiável.'),
  result('CRM-RES-021', 'Pedido confirmado', 'closing_payment', 'O pedido foi concluído comercialmente.'),
  result('CRM-RES-022', 'Retorno combinado', 'temporal_continuity', 'Há acordo legítimo para retomar em momento futuro.', false, true),
  result('CRM-RES-023', 'Pedido recebido corretamente', 'post_sale', 'O contato confirmou recebimento adequado.'),
  result('CRM-RES-024', 'Problema identificado', 'post_sale', 'Foi identificado problema que exige tratamento.', true, true),
  result('CRM-RES-025', 'Problema resolvido', 'post_sale', 'O problema recebeu resolução suficiente.'),
  result('CRM-RES-026', 'Experiência positiva', 'post_sale', 'A experiência foi relatada positivamente.'),
  result('CRM-RES-027', 'Experiência neutra', 'post_sale', 'A experiência não foi positiva nem negativa de forma relevante.'),
  result('CRM-RES-028', 'Experiência negativa', 'post_sale', 'A experiência foi relatada negativamente.', true, true),
  result('CRM-RES-029', 'Aceitação positiva na revenda', 'post_sale', 'Houve aceitação positiva em contexto de revenda.'),
  result('CRM-RES-030', 'Estoque suficiente', 'stock_replenishment', 'O contato possui estoque suficiente.'),
  result('CRM-RES-031', 'Estoque baixo', 'stock_replenishment', 'O contato informou estoque baixo.', false, true),
  result('CRM-RES-032', 'Reposição solicitada', 'stock_replenishment', 'O contato solicitou reposição.'),
  result('CRM-RES-033', 'Não deseja contato', 'contact_restriction', 'O contato solicitou não receber novo contato.', true),
] as const satisfies readonly CrmCanonicalResult[];

export const CRM_RESULTS_BY_CODE = new Map(CRM_CANONICAL_RESULTS.map(item => [item.code, item]));
export function getCanonicalResult(code?: string | null) { return code ? CRM_RESULTS_BY_CODE.get(code as CrmResultCode) ?? null : null; }
