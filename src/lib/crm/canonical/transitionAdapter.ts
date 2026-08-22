import { normalizeCrmStage, type CrmFunnelStage } from '../model';
import { CRM_CANONICAL_NEXT_ACTIONS } from './nextActions';
import { CRM_CANONICAL_RESULTS } from './results';
import { getCrmTransition, type CrmTransitionContext, type CrmTransitionDecision } from './transitions';
import type { CrmNewFact, CrmNextActionCode, CrmResultCode } from './types';

export type LegacyMappingClassification = 'EXACT' | 'CONDITIONAL' | 'UNMAPPED';
export type ShadowComparison = 'MATCH' | 'CANONICAL_DIFFERS' | 'INSUFFICIENT_CONTEXT' | 'UNMAPPED_LEGACY_VALUE';

export interface LegacyCrmResultMapping {
  legacyValue: string;
  canonicalResult: CrmResultCode | null;
  classification: LegacyMappingClassification;
  note: string;
}

export interface LegacyCrmNextActionMapping {
  legacyValue: string;
  canonicalAction: CrmNextActionCode | null;
  classification: LegacyMappingClassification;
  note: string;
}

/** The only legacy Inbox outcome whose meaning is unequivocal in the current UI. */
const LEGACY_RESULT_MAPPINGS: readonly LegacyCrmResultMapping[] = [
  { legacyValue: 'no_interest', canonicalResult: 'CRM-RES-002', classification: 'EXACT', note: 'Chave operacional atual com o mesmo significado canÃ´nico.' },
  { legacyValue: 'Sem interesse', canonicalResult: 'CRM-RES-002', classification: 'EXACT', note: 'RÃ³tulo atual com o mesmo significado canÃ´nico.' },
  { legacyValue: 'sale_closed', canonicalResult: null, classification: 'CONDITIONAL', note: 'Venda fechada nÃ£o comprova, por si sÃ³, pedido confirmado canÃ´nico.' },
  { legacyValue: 'proposal_sent', canonicalResult: null, classification: 'CONDITIONAL', note: 'Proposta enviada nÃ£o equivale a proposta em anÃ¡lise do cliente.' },
  { legacyValue: 'awaiting_response', canonicalResult: null, classification: 'CONDITIONAL', note: 'Aguardar resposta nÃ£o prova sem resposta nem retorno combinado.' },
  { legacyValue: 'post_sale_done', canonicalResult: null, classification: 'CONDITIONAL', note: 'PÃ³s-venda realizado nÃ£o identifica fato canÃ´nico especÃ­fico.' },
  { legacyValue: 'client_replied', canonicalResult: null, classification: 'CONDITIONAL', note: 'Cliente respondeu exige interpretaÃ§Ã£o do novo fato.' },
  { legacyValue: 'waiting_internal_quote', canonicalResult: null, classification: 'CONDITIONAL', note: 'OrÃ§amento interno Ã© estado interno, nÃ£o Resultado canÃ´nico.' },
  { legacyValue: 'invalid_phone', canonicalResult: null, classification: 'UNMAPPED', note: 'Telefone invÃ¡lido nÃ£o possui Resultado canÃ´nico equivalente.' },
  { legacyValue: 'record_only', canonicalResult: null, classification: 'UNMAPPED', note: 'Apenas registrar nÃ£o declara um Resultado operacional.' },
] as const;

function normalizeLegacyValue(value?: string | null) {
  return value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR') ?? '';
}

export function mapLegacyResult(value?: string | null): LegacyCrmResultMapping {
  const normalized = normalizeLegacyValue(value);
  const explicit = LEGACY_RESULT_MAPPINGS.find(mapping => normalizeLegacyValue(mapping.legacyValue) === normalized);
  if (explicit) return explicit;
  const canonical = CRM_CANONICAL_RESULTS.find(result => normalizeLegacyValue(result.label) === normalized || normalizeLegacyValue(result.code) === normalized);
  if (canonical) return { legacyValue: value ?? '', canonicalResult: canonical.code, classification: 'EXACT', note: 'Valor jÃ¡ corresponde exatamente ao contrato canÃ´nico.' };
  return { legacyValue: value ?? '', canonicalResult: null, classification: 'UNMAPPED', note: 'UNMAPPED_LEGACY_RESULT: nÃ£o hÃ¡ equivalÃªncia inequÃ­voca.' };
}

export function mapLegacyNextAction(value?: string | null): LegacyCrmNextActionMapping {
  const normalized = normalizeLegacyValue(value);
  if (!normalized) return { legacyValue: value ?? '', canonicalAction: null, classification: 'EXACT', note: 'AusÃªncia legÃ­tima de PrÃ³xima AÃ§Ã£o.' };
  const canonical = CRM_CANONICAL_NEXT_ACTIONS.find(action => normalizeLegacyValue(action.label) === normalized || normalizeLegacyValue(action.code) === normalized);
  if (canonical) return { legacyValue: value ?? '', canonicalAction: canonical.code, classification: 'EXACT', note: 'Texto corresponde exatamente Ã  PrÃ³xima AÃ§Ã£o canÃ´nica.' };
  return { legacyValue: value, canonicalAction: null, classification: 'UNMAPPED', note: 'UNMAPPED_LEGACY_NEXT_ACTION: texto livre sem equivalÃªncia segura.' };
}

export interface CrmTransitionShadowInput {
  legacyResult: string | null;
  funnelStatus: string | null;
  nextActionText: string | null;
  nextActionDate: string | null;
  returnAt: string | null;
  conversationStatus?: string | null;
  attendanceState?: string | null;
  needsReply?: boolean;
  newFact?: CrmNewFact | null;
  newFactRelation?: CrmTransitionContext['newFactRelation'];
  contactRestricted?: boolean;
  hasOpenPostSaleIssue?: boolean;
  operationalContext?: CrmTransitionContext['operationalContext'];
  operationalConversationCandidates?: number;
  legacyBehavior?: {
    stage?: string | null;
    nextActionText?: string | null;
    /** Date the legacy writer intends to persist in contacts.next_action_date. */
    nextActionDate?: string | null;
    /** Value the legacy writer intends to persist in service_conversations.return_at. */
    returnAt?: string | null;
    resolvesConversation?: boolean | null;
    handoff?: boolean | null;
  };
}

export interface CrmTransitionShadowResult {
  canonicalDecision: CrmTransitionDecision | null;
  mappingWarnings: string[];
  missingContext: string[];
  legacyComparison: {
    status: ShadowComparison;
    differences: string[];
    differencesByDimension?: Partial<Record<'stage' | 'nextAction' | 'temporal' | 'temporal.nextActionDate' | 'temporal.returnAt' | 'conversation' | 'handoff', string>>;
    missingDimensions?: Array<'stage' | 'nextAction' | 'temporal' | 'conversation' | 'handoff'>;
  };
  conversationAmbiguity: 'NONE' | 'CANONICAL_CONVERSATION_AMBIGUITY';
  futureTaskHint: 'CREATE_OR_MAINTAIN' | 'CONCLUDE_OR_NONE' | 'NONE';
  returnAtHint: 'MAINTAIN' | 'CREATE_FUTURE' | 'CLEAR_FUTURE' | 'REASSESS' | 'NONE';
}

function compareLegacy(
  decision: CrmTransitionDecision,
  input: CrmTransitionShadowInput,
  nextActionMapping: LegacyCrmNextActionMapping,
  missingContext: string[],
): CrmTransitionShadowResult['legacyComparison'] {
  if (missingContext.length) return { status: 'INSUFFICIENT_CONTEXT', differences: missingContext };
  if (nextActionMapping.classification === 'UNMAPPED') return { status: 'UNMAPPED_LEGACY_VALUE', differences: [nextActionMapping.note] };

  const differences: string[] = [];
  const legacyStage = input.legacyBehavior?.stage ?? input.funnelStatus;
  if (decision.stage.action === 'KEEP' && legacyStage && normalizeCrmStage(legacyStage) !== normalizeCrmStage(input.funnelStatus)) differences.push('Legado propÃµe alteraÃ§Ã£o de etapa; canÃ´nico preserva KEEP.');
  if (decision.nextAction.value !== nextActionMapping.canonicalAction) differences.push('PrÃ³xima AÃ§Ã£o legada difere da decisÃ£o canÃ´nica.');
  if (Boolean(input.legacyBehavior?.returnAt) !== (decision.temporal.policy === 'REQUIRED_FUTURE')) differences.push('ProgramaÃ§Ã£o temporal legada difere da polÃ­tica canÃ´nica.');
  if (Boolean(input.legacyBehavior?.resolvesConversation) !== decision.handoff.required) differences.push('Encerramento/handoff legado difere da decisÃ£o canÃ´nica.');
  return { status: differences.length ? 'CANONICAL_DIFFERS' : 'MATCH', differences };
}

type ComparableDimension = 'stage' | 'nextAction' | 'temporal' | 'conversation' | 'handoff';
type DifferenceDimension = ComparableDimension | 'temporal.nextActionDate' | 'temporal.returnAt';

function compareObservedLegacy(
  decision: CrmTransitionDecision,
  input: CrmTransitionShadowInput,
  missingContext: string[],
): CrmTransitionShadowResult['legacyComparison'] {
  if (missingContext.length) return { status: 'INSUFFICIENT_CONTEXT', differences: missingContext, missingDimensions: ['stage'] };
  const behavior = input.legacyBehavior;
  const required: ComparableDimension[] = ['stage', 'nextAction', 'temporal', 'conversation', 'handoff'];
  const missingDimensions = required.filter((dimension) => {
    if (!behavior) return true;
    if (dimension === 'temporal') {
      return !Object.prototype.hasOwnProperty.call(behavior, 'nextActionDate') || !Object.prototype.hasOwnProperty.call(behavior, 'returnAt');
    }
    const property = dimension === 'nextAction' ? 'nextActionText'
      : dimension === 'conversation' ? 'resolvesConversation'
          : dimension;
    return !Object.prototype.hasOwnProperty.call(behavior, property);
  });
  if (missingDimensions.length) {
    return { status: 'INSUFFICIENT_CONTEXT', differences: ['Comportamento legado ainda nÃ£o foi observado em todas as dimensÃµes comparÃ¡veis.'], missingDimensions };
  }

  const behaviorAction = mapLegacyNextAction(behavior.nextActionText);
  if (behaviorAction.classification === 'UNMAPPED') return { status: 'UNMAPPED_LEGACY_VALUE', differences: [behaviorAction.note] };

  const differencesByDimension: Partial<Record<DifferenceDimension, string>> = {};
  if (decision.stage.action === 'KEEP' && behavior.stage && normalizeCrmStage(behavior.stage) !== normalizeCrmStage(input.funnelStatus)) differencesByDimension.stage = 'Legado propÃµe alteraÃ§Ã£o de etapa; canÃ´nico preserva KEEP.';
  if (decision.nextAction.value !== behaviorAction.canonicalAction) differencesByDimension.nextAction = 'PrÃ³xima AÃ§Ã£o legada difere da decisÃ£o canÃ´nica.';
  const requiresFutureActionDate = decision.temporal.policy === 'REQUIRED_FUTURE';
  if (Boolean(behavior.nextActionDate) !== requiresFutureActionDate) {
    differencesByDimension['temporal.nextActionDate'] = 'Legacy next-action schedule differs from canonical temporal policy.';
  }
  // return_at belongs to the conversation and remains independent from the
  // contact's next_action_date. The canonical decision only prohibits it here.
  if (decision.temporal.policy === 'PROHIBITED' && behavior.returnAt) {
    differencesByDimension['temporal.returnAt'] = 'Legacy conversation return_at exists where future programming is prohibited.';
  }
  if (Boolean(behavior.resolvesConversation) !== decision.handoff.required) differencesByDimension.conversation = 'Encerramento legado difere da decisÃ£o canÃ´nica.';
  if (Boolean(behavior.handoff) !== decision.handoff.required) differencesByDimension.handoff = 'Handoff legado difere da decisÃ£o canÃ´nica.';
  const differences = Object.values(differencesByDimension);
  return { status: differences.length ? 'CANONICAL_DIFFERS' : 'MATCH', differences, differencesByDimension, missingDimensions };
}

/**
 * Adapta valores existentes e avalia o motor em modo sombra. Esta funÃ§Ã£o nunca
 * escreve estado: ela Ã© apenas uma ponte diagnÃ³stica e reversÃ­vel.
 */
export function evaluateCanonicalTransitionShadow(input: CrmTransitionShadowInput): CrmTransitionShadowResult {
  const resultMapping = mapLegacyResult(input.legacyResult);
  const nextActionMapping = mapLegacyNextAction(input.nextActionText);
  const mappingWarnings: string[] = [];
  const missingContext: string[] = [];
  if (resultMapping.classification !== 'EXACT' || !resultMapping.canonicalResult) mappingWarnings.push(resultMapping.note);
  if (nextActionMapping.classification !== 'EXACT') mappingWarnings.push(nextActionMapping.note);
  if (!input.funnelStatus) missingContext.push('Funnel status atual ausente.');
  if (!resultMapping.canonicalResult) {
    return {
      canonicalDecision: null,
      mappingWarnings,
      missingContext,
      legacyComparison: { status: resultMapping.classification === 'UNMAPPED' ? 'UNMAPPED_LEGACY_VALUE' : 'INSUFFICIENT_CONTEXT', differences: [...mappingWarnings, ...missingContext] },
      conversationAmbiguity: (input.operationalConversationCandidates ?? 1) > 1 ? 'CANONICAL_CONVERSATION_AMBIGUITY' : 'NONE',
      futureTaskHint: 'NONE',
      returnAtHint: 'NONE',
    };
  }

  const context: CrmTransitionContext = {
    result: resultMapping.canonicalResult,
    currentStage: normalizeCrmStage(input.funnelStatus),
    currentNextAction: nextActionMapping.canonicalAction,
    currentNextActionDate: input.nextActionDate,
    currentReturnAt: input.returnAt,
    conversationStatus: input.conversationStatus,
    attendanceState: input.attendanceState,
    needsReply: input.needsReply,
    newFact: input.newFact,
    newFactRelation: input.newFactRelation,
    contactRestricted: input.contactRestricted,
    hasOpenPostSaleIssue: input.hasOpenPostSaleIssue,
    operationalContext: input.operationalContext,
  };
  const canonicalDecision = getCrmTransition(context);
  if (canonicalDecision.temporal.policy === 'MISSING_REQUIRED_CONTEXT') missingContext.push('Retorno combinado sem momento, perÃ­odo ou critÃ©rio concreto.');
  const returnAtHint = canonicalDecision.obsoletePreviousProgramming
    ? 'REASSESS'
    : canonicalDecision.temporal.policy === 'REQUIRED_FUTURE'
      ? input.returnAt ? 'MAINTAIN' : 'CREATE_FUTURE'
      : canonicalDecision.temporal.policy === 'PROHIBITED'
        ? 'CLEAR_FUTURE'
        : 'NONE';

  return {
    canonicalDecision,
    mappingWarnings,
    missingContext,
    legacyComparison: compareObservedLegacy(canonicalDecision, input, missingContext),
    conversationAmbiguity: (input.operationalConversationCandidates ?? 1) > 1 ? 'CANONICAL_CONVERSATION_AMBIGUITY' : 'NONE',
    futureTaskHint: canonicalDecision.nextAction.value ? 'CREATE_OR_MAINTAIN' : 'CONCLUDE_OR_NONE',
    returnAtHint,
  };
}
