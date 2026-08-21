import { normalizeCrmStage, type CrmFunnelStage } from '../model';
import type { CrmTransitionDecision } from './transitions';
import type { CrmResultCode } from './types';

export type CrmFunnelProgression = {
  action: 'KEEP' | 'MOVE';
  previousStage: CrmFunnelStage;
  nextStage: CrmFunnelStage;
  reason: string;
};

export interface ResolveFunnelStageInput {
  result: CrmResultCode;
  currentStage: CrmFunnelStage | string | null | undefined;
  decision: CrmTransitionDecision;
  /** A data só é considerada quando já foi validada pela transição canônica. */
  hasLegitimateFutureReturn?: boolean;
  /** Reservado para um writer que possua evidência real de proposta apresentada. */
  proposalPresented?: boolean;
}

const ACTIVE_COMMERCIAL_STAGES: readonly CrmFunnelStage[] = [
  'novo_lead',
  'contato_realizado',
  'proposta_enviada',
  'negociacao',
  'fechado',
];

function keep(previousStage: CrmFunnelStage, reason: string): CrmFunnelProgression {
  return { action: 'KEEP', previousStage, nextStage: previousStage, reason };
}

function move(previousStage: CrmFunnelStage, nextStage: CrmFunnelStage, reason: string): CrmFunnelProgression {
  return previousStage === nextStage
    ? keep(previousStage, reason)
    : { action: 'MOVE', previousStage, nextStage, reason };
}

/** Avança só o percurso comercial principal; estados especiais exigem regra explícita. */
function moveForward(previousStage: CrmFunnelStage, target: CrmFunnelStage, reason: string): CrmFunnelProgression {
  const previousIndex = ACTIVE_COMMERCIAL_STAGES.indexOf(previousStage);
  const targetIndex = ACTIVE_COMMERCIAL_STAGES.indexOf(target);
  if (previousIndex === -1 || targetIndex === -1 || previousIndex >= targetIndex) return keep(previousStage, reason);
  return move(previousStage, target, reason);
}

function moveToCadenceWhenFutureIsLegitimate(previousStage: CrmFunnelStage, hasLegitimateFutureReturn: boolean, reason: string) {
  if (!hasLegitimateFutureReturn) return keep(previousStage, `${reason} Sem retorno futuro legítimo.`);
  if (['fechado', 'pos_venda', 'perdido'].includes(previousStage)) return keep(previousStage, `${reason} Estado atual preservado.`);
  return move(previousStage, 'cadencia', reason);
}

/**
 * Traduz somente o destino documental homologado para o funil técnico já
 * existente. Próxima ação e temporalidade continuam sob getCrmTransition().
 */
export function resolveFunnelStageFromCanonicalResult(input: ResolveFunnelStageInput): CrmFunnelProgression {
  const previousStage = normalizeCrmStage(input.currentStage);
  const result = input.decision.result ?? input.result;
  const futureReturn = Boolean(input.hasLegitimateFutureReturn);

  switch (result) {
    case 'CRM-RES-001': return moveForward(previousStage, 'contato_realizado', 'Interesse demonstrado avança somente o novo lead.');
    case 'CRM-RES-002': return move(previousStage, 'perdido', 'Sem interesse encerra a continuidade comercial.');
    case 'CRM-RES-003': return moveToCadenceWhenFutureIsLegitimate(previousStage, futureReturn, 'Sem resposta com retomada futura entra em cadência.');
    case 'CRM-RES-004': return ['cadencia', 'pos_venda', 'perdido'].includes(previousStage)
      ? move(previousStage, 'contato_realizado', 'Nova necessidade reabre a oportunidade comercial.')
      : keep(previousStage, 'Nova necessidade preserva o fluxo comercial ativo.');
    case 'CRM-RES-005': case 'CRM-RES-006': case 'CRM-RES-022': case 'CRM-RES-030':
      return keep(previousStage, 'O resultado não comprova mudança de etapa comercial.');
    case 'CRM-RES-007': return moveForward(previousStage, 'negociacao', 'Proposta aceita avança para negociação, sem fechar a venda.');
    case 'CRM-RES-008': return moveForward(previousStage, 'proposta_enviada', 'Proposta em análise confirma proposta enviada sem regressão.');
    case 'CRM-RES-009': return input.proposalPresented && ['novo_lead', 'contato_realizado'].includes(previousStage)
      ? move(previousStage, 'proposta_enviada', 'Alteração comercial com proposta comprovada mantém a proposta enviada.')
      : keep(previousStage, 'Não há evidência adicional de proposta apresentada.');
    case 'CRM-RES-010': case 'CRM-RES-011': case 'CRM-RES-012': case 'CRM-RES-017': case 'CRM-RES-018': case 'CRM-RES-019': case 'CRM-RES-020':
      return moveForward(previousStage, 'negociacao', 'O resultado mantém ou avança a negociação, sem fechar a venda isoladamente.');
    case 'CRM-RES-013': case 'CRM-RES-014': return moveToCadenceWhenFutureIsLegitimate(previousStage, futureReturn, 'Decisão temporal com retorno legítimo entra em cadência.');
    case 'CRM-RES-015': case 'CRM-RES-016': case 'CRM-RES-033': return move(previousStage, 'perdido', 'O resultado encerra a continuidade comercial atual.');
    case 'CRM-RES-021': return move(previousStage, 'fechado', 'Pedido confirmado realiza a conversão comercial.');
    case 'CRM-RES-023': case 'CRM-RES-024': case 'CRM-RES-025': case 'CRM-RES-026': case 'CRM-RES-027': case 'CRM-RES-028': case 'CRM-RES-029': case 'CRM-RES-031':
      return move(previousStage, 'pos_venda', 'O resultado pertence ao relacionamento pós-venda.');
    case 'CRM-RES-032': return ['pos_venda', 'cadencia', 'fechado'].includes(previousStage)
      ? move(previousStage, 'contato_realizado', 'Reposição solicitada inicia uma nova oportunidade comercial.')
      : keep(previousStage, 'Reposição preserva o fluxo comercial já ativo.');
    default: return keep(previousStage, 'Resultado sem destino técnico de etapa.');
  }
}
