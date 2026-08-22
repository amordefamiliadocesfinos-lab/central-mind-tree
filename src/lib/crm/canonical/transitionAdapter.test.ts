import { evaluateCanonicalTransitionShadow, mapLegacyNextAction, mapLegacyResult } from './transitionAdapter';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Canonical shadow adapter: ${message}`);
}

const base = {
  funnelStatus: 'negociacao',
  nextActionText: null,
  nextActionDate: null,
  returnAt: null,
};

assert(mapLegacyResult('no_interest').canonicalResult === 'CRM-RES-002', 'exact legacy result must map safely.');
assert(mapLegacyResult('sale_closed').classification === 'CONDITIONAL', 'sale closed must not be assumed to be order confirmed.');
assert(mapLegacyResult('invalid_phone').classification === 'UNMAPPED', 'unmapped legacy result must stay unmapped.');
assert(mapLegacyNextAction('CONFERIR PAGAMENTO').canonicalAction === 'CRM-PA-013', 'exact canonical action text must map safely.');
assert(mapLegacyNextAction('Fazer follow-up da proposta').classification === 'UNMAPPED', 'free legacy action text must not be approximated.');

const unmapped = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'sale_closed' });
assert(unmapped.canonicalDecision === null && unmapped.legacyComparison.status === 'INSUFFICIENT_CONTEXT', 'conditional legacy result must not run canonical decision automatically.');

const noInterest = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'no_interest' });
assert(noInterest.canonicalDecision?.result === 'CRM-RES-002', 'exact result must run shadow decision.');
assert(noInterest.canonicalDecision?.nextAction.value === null, 'shadow decision must preserve legitimate absence.');

const returnMissingMoment = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'RETORNO COMBINADO' });
assert(returnMissingMoment.canonicalDecision?.temporal.policy === 'MISSING_REQUIRED_CONTEXT', 'shadow mode must expose incomplete return context without writing it.');

const paymentInformed = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'PAGAMENTO INFORMADO' });
assert(paymentInformed.canonicalDecision?.nextAction.value === 'CRM-PA-013', 'payment informed must remain distinct in shadow mode.');

const paymentConfirmed = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'PAGAMENTO CONFIRMADO', operationalContext: { hasPendingCommercialRequirement: true } });
assert(paymentConfirmed.canonicalDecision?.nextAction.value === 'CRM-PA-010', 'payment confirmed with a real requirement can conclude order.');

const order = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'PEDIDO CONFIRMADO' });
assert(order.canonicalDecision?.handoff.required, 'order confirmed must preserve handoff as diagnostic only.');

const issue = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'REPOSIÇÃO SOLICITADA', hasOpenPostSaleIssue: true });
assert(issue.canonicalDecision?.result === 'CRM-RES-024', 'post-sale issue must override inadequate replenishment in shadow mode.');

const restriction = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'REPOSIÇÃO SOLICITADA', contactRestricted: true });
assert(restriction.canonicalDecision?.result === 'CRM-RES-033', 'contact restriction must prevail in shadow mode.');

const ambiguity = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'no_interest', operationalConversationCandidates: 2 });
assert(ambiguity.conversationAmbiguity === 'CANONICAL_CONVERSATION_AMBIGUITY', 'multiple selected conversation candidates must remain a diagnostic risk.');

const observedBehavior = { stage: 'negociacao', nextActionText: null, nextActionDate: null, returnAt: null, resolvesConversation: false, handoff: false };
const observedMatch = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'no_interest', legacyBehavior: observedBehavior });
assert(observedMatch.legacyComparison.status === 'MATCH', 'MATCH requires every comparable legacy dimension to be observed.');
assert(observedMatch.canonicalDecision?.stage.action === 'KEEP', 'shadow adapter must preserve stage KEEP.');

const unobserved = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'no_interest' });
assert(unobserved.legacyComparison.status === 'INSUFFICIENT_CONTEXT', 'missing legacy behavior must never fall through to MATCH.');
assert(unobserved.legacyComparison.missingDimensions?.length === 5, 'all missing comparable dimensions must be diagnosed.');

for (const omitted of ['stage', 'nextActionText', 'nextActionDate', 'returnAt', 'resolvesConversation', 'handoff'] as const) {
  const incompleteBehavior = { ...observedBehavior } as Partial<typeof observedBehavior>;
  delete incompleteBehavior[omitted];
  const incomplete = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'no_interest', legacyBehavior: incompleteBehavior });
  assert(incomplete.legacyComparison.status === 'INSUFFICIENT_CONTEXT', `missing ${omitted} must never produce MATCH or CANONICAL_DIFFERS.`);
}

const actionDiff = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'no_interest', legacyBehavior: { ...observedBehavior, nextActionText: 'CONFERIR PAGAMENTO' } });
assert(actionDiff.legacyComparison.differencesByDimension?.nextAction, 'next action divergence must be classified separately.');

const temporalDiff = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'no_interest', legacyBehavior: { ...observedBehavior, nextActionDate: '2026-09-01T12:00:00Z' } });
assert(temporalDiff.legacyComparison.differencesByDimension?.['temporal.nextActionDate'], 'next-action date divergence must be classified separately.');

const returnAtDiff = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'no_interest', legacyBehavior: { ...observedBehavior, returnAt: '2026-09-01T12:00:00Z' } });
assert(returnAtDiff.legacyComparison.differencesByDimension?.['temporal.returnAt'], 'conversation return_at divergence must be classified separately.');

const handoffDiff = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'no_interest', legacyBehavior: { ...observedBehavior, handoff: true } });
assert(handoffDiff.legacyComparison.differencesByDimension?.handoff, 'handoff divergence must be classified separately.');

const multipleDiffs = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'no_interest', legacyBehavior: { ...observedBehavior, nextActionText: 'CONFERIR PAGAMENTO', nextActionDate: '2026-09-01T12:00:00Z', returnAt: '2026-09-01T12:00:00Z', handoff: true } });
assert(multipleDiffs.legacyComparison.status === 'CANONICAL_DIFFERS', 'multiple observed differences must remain a canonical difference.');
assert(Boolean(multipleDiffs.legacyComparison.differencesByDimension?.nextAction), 'multiple difference diagnostic must retain next action difference.');
assert(Boolean(multipleDiffs.legacyComparison.differencesByDimension?.['temporal.nextActionDate']), 'multiple difference diagnostic must retain next-action date difference.');
assert(Boolean(multipleDiffs.legacyComparison.differencesByDimension?.['temporal.returnAt']), 'multiple difference diagnostic must retain return_at difference.');
assert(Boolean(multipleDiffs.legacyComparison.differencesByDimension?.handoff), 'multiple difference diagnostic must retain handoff difference.');
assert(!multipleDiffs.legacyComparison.differencesByDimension?.stage, 'equal dimensions must not be reported as different.');

for (const freeText of [
  'Fazer follow-up da proposta',
  'Retomar negociação',
  'Realizar pós-venda',
  'Responder cliente no WhatsApp',
  'Verificar resposta do cliente',
  'Corrigir telefone do contato',
]) {
  assert(mapLegacyNextAction(freeText).classification === 'UNMAPPED', `${freeText} must not be semantically approximated to a canonical action.`);
}

const unknownWithMissing = evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'resultado desconhecido', funnelStatus: null });
assert(unknownWithMissing.legacyComparison.status === 'UNMAPPED_LEGACY_VALUE', 'unknown result must take precedence over incomplete context.');

assert(noInterest.futureTaskHint === 'CONCLUDE_OR_NONE', 'shadow task hint must remain diagnostic only.');
assert(evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'RETORNO COMBINADO', operationalContext: { hasConcreteReturnMoment: true }, returnAt: '2026-09-01T12:00:00Z' }).returnAtHint === 'MAINTAIN', 'existing legitimate return must only be maintained diagnostically.');
assert(evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'RETORNO COMBINADO', operationalContext: { hasConcreteReturnMoment: true } }).returnAtHint === 'CREATE_FUTURE', 'missing legitimate return must only be suggested diagnostically.');
assert(evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'no_interest', returnAt: '2026-09-01T12:00:00Z' }).returnAtHint === 'CLEAR_FUTURE', 'prohibited return must only be suggested for future clearing.');
assert(evaluateCanonicalTransitionShadow({ ...base, legacyResult: 'RETORNO COMBINADO', returnAt: '2026-09-01T12:00:00Z', newFact: { source: 'meta', eventType: 'customer_replied', timestamp: '2026-08-20T12:00:00Z' }, newFactRelation: 'INCOMPATIBLE' }).returnAtHint === 'REASSESS', 'incompatible fact must only recommend return reassessment.');

const frozenInput = Object.freeze({ ...base, legacyResult: 'no_interest', legacyBehavior: Object.freeze({ ...observedBehavior }) });
evaluateCanonicalTransitionShadow(frozenInput);
assert(frozenInput.legacyBehavior.stage === 'negociacao', 'shadow mode must not mutate its input.');

// T3.3: the two temporal values are independently observable legacy facts.
const clientRepliedFacts = {
  ...base,
  legacyResult: 'client_replied',
  legacyBehavior: { stage: 'contato_realizado', nextActionText: 'Definir prÃ³ximo passo comercial', nextActionDate: '2026-09-01T09:00:00Z', returnAt: null },
};
assert(Object.prototype.hasOwnProperty.call(clientRepliedFacts.legacyBehavior, 'nextActionDate') && clientRepliedFacts.legacyBehavior.nextActionDate !== null, 'client_replied must retain its planned next-action date.');
assert(Object.prototype.hasOwnProperty.call(clientRepliedFacts.legacyBehavior, 'returnAt') && clientRepliedFacts.legacyBehavior.returnAt === null, 'client_replied must observe absence of conversation return_at separately.');
assert(evaluateCanonicalTransitionShadow(clientRepliedFacts).legacyComparison.status === 'INSUFFICIENT_CONTEXT', 'conditional client_replied remains conditional and cannot gain MATCH.');

const awaitingResponseFacts = {
  ...base,
  legacyResult: 'awaiting_response',
  legacyBehavior: { stage: 'contato_realizado', nextActionText: 'Verificar resposta do cliente', nextActionDate: '2026-09-01T09:00:00Z', returnAt: '2026-09-01T09:00:00Z' },
};
assert(awaitingResponseFacts.legacyBehavior.nextActionDate !== awaitingResponseFacts.legacyBehavior.returnAt || Boolean(awaitingResponseFacts.legacyBehavior.returnAt), 'awaiting_response keeps planned action and conversation return as separate fields.');
assert(evaluateCanonicalTransitionShadow(awaitingResponseFacts).legacyComparison.status === 'INSUFFICIENT_CONTEXT', 'conditional awaiting_response remains conditional.');

const noTemporalFacts = { ...base, legacyResult: 'no_interest', legacyBehavior: { ...observedBehavior } };
assert(noTemporalFacts.legacyBehavior.nextActionDate === null && noTemporalFacts.legacyBehavior.returnAt === null, 'observed absence must not invent temporal values.');

const missingActionDate = { ...base, legacyResult: 'no_interest', legacyBehavior: { stage: 'negociacao', nextActionText: null, returnAt: null, resolvesConversation: false, handoff: false } };
assert(evaluateCanonicalTransitionShadow(missingActionDate).legacyComparison.status === 'INSUFFICIENT_CONTEXT', 'missing nextActionDate remains unobserved, not null by default.');
