import { CRM_CANONICAL_RESULTS } from './results';
import { getCrmTransition, type CrmTransitionContext } from './transitions';
import type { CrmNextActionCode, CrmResultCode } from './types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Canonical transition: ${message}`);
}

const base: Omit<CrmTransitionContext, 'result'> = {
  currentStage: 'negociacao',
  currentNextAction: null,
  currentNextActionDate: null,
  currentReturnAt: null,
};

type Expected = {
  nextAction: CrmNextActionCode | null;
  temporalRequired?: boolean;
  handoff?: boolean;
};

// 33x33 behavioral matrix. Every canonical result must keep the technical
// stage until a separate destination-to-stage contract is homologated.
const expectedByResult: Record<CrmResultCode, Expected> = {
  'CRM-RES-001': { nextAction: 'CRM-PA-001' },
  'CRM-RES-002': { nextAction: null },
  'CRM-RES-003': { nextAction: null },
  'CRM-RES-004': { nextAction: 'CRM-PA-003' },
  'CRM-RES-005': { nextAction: 'CRM-PA-007' },
  'CRM-RES-006': { nextAction: 'CRM-PA-003' },
  'CRM-RES-007': { nextAction: 'CRM-PA-010' },
  'CRM-RES-008': { nextAction: null },
  'CRM-RES-009': { nextAction: 'CRM-PA-007' },
  'CRM-RES-010': { nextAction: 'CRM-PA-009' },
  'CRM-RES-011': { nextAction: 'CRM-PA-010' },
  'CRM-RES-012': { nextAction: 'CRM-PA-009' },
  'CRM-RES-013': { nextAction: null },
  'CRM-RES-014': { nextAction: null },
  'CRM-RES-015': { nextAction: null },
  'CRM-RES-016': { nextAction: null },
  'CRM-RES-017': { nextAction: 'CRM-PA-011' },
  'CRM-RES-018': { nextAction: null },
  'CRM-RES-019': { nextAction: 'CRM-PA-013' },
  'CRM-RES-020': { nextAction: null, handoff: true },
  'CRM-RES-021': { nextAction: null, handoff: true },
  'CRM-RES-022': { nextAction: null, temporalRequired: true },
  'CRM-RES-023': { nextAction: null },
  'CRM-RES-024': { nextAction: 'CRM-PA-017' },
  'CRM-RES-025': { nextAction: null },
  'CRM-RES-026': { nextAction: null },
  'CRM-RES-027': { nextAction: null },
  'CRM-RES-028': { nextAction: null },
  'CRM-RES-029': { nextAction: null },
  'CRM-RES-030': { nextAction: null },
  'CRM-RES-031': { nextAction: 'CRM-PA-018' },
  'CRM-RES-032': { nextAction: 'CRM-PA-019' },
  'CRM-RES-033': { nextAction: null },
};

assert(CRM_CANONICAL_RESULTS.length === 33, 'the canonical source must retain 33 results.');
for (const result of CRM_CANONICAL_RESULTS) {
  const expected = expectedByResult[result.code];
  const decision = getCrmTransition({ ...base, result: result.code });
  assert(decision.result === result.code, `${result.code} must preserve its canonical result without a transversal fact.`);
  assert(decision.stage.action === 'KEEP', `${result.code} must keep the technical stage without a destination-to-stage contract.`);
  assert(decision.nextAction.value === expected.nextAction, `${result.code} must select its documented safe default action.`);
  assert(decision.temporal.required === Boolean(expected.temporalRequired), `${result.code} must expose the documented temporal requirement.`);
  assert(decision.handoff.required === Boolean(expected.handoff), `${result.code} must expose its documented handoff requirement.`);
  assert(!decision.obsoletePreviousProgramming, `${result.code} must not obsolete programming without a documented reason.`);
}

// Conditional actions are supported by explicit current context, not merely by
// the action that happened to be stored before this decision.
assert(getCrmTransition({ ...base, result: 'CRM-RES-001', operationalContext: { supportedNextAction: 'CRM-PA-002' } }).nextAction.value === 'CRM-PA-002', 'interest with sufficient qualification must select opportunity identification.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-007', operationalContext: { supportedNextAction: 'CRM-PA-011' } }).nextAction.value === 'CRM-PA-011', 'proposal acceptance must keep the specific pending requirement.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-012', operationalContext: { supportedNextAction: 'CRM-PA-003' } }).nextAction.value === 'CRM-PA-003', 'unresolved objection can require opportunity reassessment.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-017', operationalContext: { supportedNextAction: 'CRM-PA-014', hasLegitimateFutureReason: true } }).nextAction.value === 'CRM-PA-014', 'data follow-up requires a legitimate future reason.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-018', operationalContext: { paymentGuidanceNeeded: true } }).nextAction.value === 'CRM-PA-012', 'awaiting payment only guides payment when guidance is needed.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-023', operationalContext: { supportedNextAction: 'CRM-PA-016' } }).nextAction.value === 'CRM-PA-016', 'receipt can lead to experience assessment only when context supports it.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-026', operationalContext: { supportedNextAction: 'CRM-PA-018' } }).nextAction.value === 'CRM-PA-018', 'positive experience only assesses replenishment when supported by context.');

// New fact relation: compatible facts preserve programming; substitutive or
// incompatible facts make the previous future programming obsolete.
const futureProgram = { currentNextAction: 'CRM-PA-014' as const, currentReturnAt: '2026-08-30', operationalContext: { hasConcreteReturnMoment: true } };
assert(!getCrmTransition({ ...base, ...futureProgram, result: 'CRM-RES-022', newFact: { source: 'meta', eventType: 'customer_replied', timestamp: '2026-08-20T12:00:00Z' }, newFactRelation: 'COMPATIBLE' }).obsoletePreviousProgramming, 'compatible new fact must preserve valid programming.');
assert(getCrmTransition({ ...base, ...futureProgram, result: 'CRM-RES-022', newFact: { source: 'meta', eventType: 'customer_replied', timestamp: '2026-08-20T12:00:00Z' }, newFactRelation: 'INCOMPATIBLE' }).obsoletePreviousProgramming, 'incompatible new fact must obsolete previous programming.');
assert(getCrmTransition({ ...base, ...futureProgram, result: 'CRM-RES-022', newFact: { source: 'integration', eventType: 'payment_confirmed', timestamp: '2026-08-20T12:00:00Z' }, newFactRelation: 'SUPERSEDES' }).obsoletePreviousProgramming, 'substitutive new fact must obsolete previous programming.');

// Required negative boundaries from the 09.04 map.
const paymentWithoutRequirement = getCrmTransition({ ...base, result: 'CRM-RES-020', currentNextAction: 'CRM-PA-010', operationalContext: { hasPendingCommercialRequirement: false } });
assert(paymentWithoutRequirement.nextAction.value === null, 'payment confirmation without commercial requirement must not preserve PA-010.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-020', operationalContext: { hasPendingCommercialRequirement: true } }).nextAction.value === 'CRM-PA-010', 'payment confirmation with a real commercial requirement can select PA-010.');

const returnWithoutMoment = getCrmTransition({ ...base, result: 'CRM-RES-022' });
assert(returnWithoutMoment.nextAction.value === null && returnWithoutMoment.temporal.policy === 'MISSING_REQUIRED_CONTEXT', 'return combined without concrete timing must not fabricate programming.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-022', operationalContext: { hasConcreteReturnMoment: true } }).nextAction.value === 'CRM-PA-014', 'return combined with concrete timing must select PA-014.');

assert(getCrmTransition({ ...base, result: 'CRM-RES-028' }).nextAction.value === null, 'negative experience without an operational issue must not fabricate PA-017.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-028', operationalContext: { requiresOccurrenceFollowUp: true } }).nextAction.value === 'CRM-PA-017', 'negative experience with a real occurrence can select PA-017.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-003' }).nextAction.value === null, 'silence without legitimate reason must not fabricate PA-014.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-023' }).nextAction.value === null, 'receipt must not presume satisfaction.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-019' }).nextAction.value === 'CRM-PA-013', 'payment informed must not produce effects exclusive to confirmation.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-021' }).stage.action === 'KEEP', 'order handoff must not create a technical commercial stage.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-032', contactRestricted: true }).nextAction.value === null, 'contact restriction must block incompatible commercial action.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-032', hasOpenPostSaleIssue: true }).result === 'CRM-RES-024', 'open post-sale issue must block inadequate replenishment.');
assert(getCrmTransition({ ...base, result: 'CRM-RES-002' }).nextAction.value === null, 'legitimate absence of next action must remain valid.');
