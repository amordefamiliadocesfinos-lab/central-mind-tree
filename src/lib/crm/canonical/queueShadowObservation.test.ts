import {
  buildQueueResultShadowInput,
  isQueueShadowObservationEnabled,
  observeAttendanceOutcomeShadow,
  observeQueueResultShadow,
  type AttendanceOutcomeShadowFacts,
  type QueueResultShadowFacts,
} from './queueShadowObservation';
import { evaluateCanonicalTransitionShadow } from './transitionAdapter';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Queue shadow observation: ${message}`);
}

// The real queue writer decides stage, next action and its lack of return_at
// effect, but does not decide conversation resolution or operational handoff.
const queueWriterFacts: QueueResultShadowFacts = {
  legacyResult: 'no_interest',
  currentFunnelStatus: 'negociacao',
  currentNextActionText: null,
  currentNextActionDate: null,
  legacyBehavior: {
    stage: 'negociacao',
    nextActionText: null,
    nextActionDate: null,
    returnAt: null,
  },
};

const built = buildQueueResultShadowInput(queueWriterFacts);
assert(built.legacyResult === 'no_interest', 'the selected legacy result must be passed through unchanged.');
assert(built.legacyBehavior?.stage === 'negociacao', 'the observed legacy stage must be retained.');
assert(built.returnAt === null, 'the writer has no return_at effect to infer.');
assert(!Object.hasOwn(built.legacyBehavior ?? {}, 'resolvesConversation'), 'a writer that does not decide conversation must leave it unobserved.');
assert(!Object.hasOwn(built.legacyBehavior ?? {}, 'handoff'), 'a writer that does not decide handoff must leave it unobserved.');

const logs: Array<{ message: string; detail?: unknown }> = [];
const queueObservation = observeQueueResultShadow(queueWriterFacts, {
  enabled: true,
  log: (message, detail) => logs.push({ message, detail }),
});
assert(queueObservation?.classification === 'INSUFFICIENT_CONTEXT', 'the real queue writer must not produce MATCH with unobserved conversation and handoff.');
assert(logs.length === 1 && !JSON.stringify(logs[0]).includes('contactId'), 'local diagnostic must stay structured and omit contact identifiers.');

// MATCH remains possible only for a context where every dimension was genuinely observed.
const fullyObservedSynthetic: QueueResultShadowFacts = {
  ...queueWriterFacts,
  legacyBehavior: {
    ...queueWriterFacts.legacyBehavior,
    nextActionDate: null,
    resolvesConversation: false,
    handoff: false,
  },
};
const matched = observeQueueResultShadow(fullyObservedSynthetic, { enabled: true, log: () => undefined });
assert(matched?.classification === 'MATCH', 'MATCH remains valid only for a fully observed synthetic context outside this writer.');

const differs = observeQueueResultShadow({
  ...fullyObservedSynthetic,
  legacyBehavior: { ...fullyObservedSynthetic.legacyBehavior, nextActionText: 'CONFERIR PAGAMENTO' },
}, { enabled: true, log: () => undefined });
assert(differs?.classification === 'CANONICAL_DIFFERS', 'an observed legacy difference must remain diagnostic only.');

const queueWriterDifference = observeQueueResultShadow({
  ...queueWriterFacts,
  legacyBehavior: { ...queueWriterFacts.legacyBehavior, nextActionText: 'CONFERIR PAGAMENTO' },
}, { enabled: true, log: () => undefined });
assert(queueWriterDifference?.classification === 'INSUFFICIENT_CONTEXT', 'unobserved conversation and handoff retain their T3-H precedence over an otherwise observed difference.');

const insufficient = observeQueueResultShadow({
  ...queueWriterFacts,
  legacyBehavior: { stage: 'negociacao', nextActionText: null, returnAt: null },
}, { enabled: true, log: () => undefined });
assert(insufficient?.classification === 'INSUFFICIENT_CONTEXT', 'unobserved legacy dimensions must not be inferred.');

const unmapped = observeQueueResultShadow({ ...queueWriterFacts, legacyResult: 'invalid_phone' }, { enabled: true, log: () => undefined });
assert(unmapped?.classification === 'UNMAPPED_LEGACY_VALUE', 'unmapped legacy outcomes must remain unmapped.');

const disabled = observeQueueResultShadow(queueWriterFacts, { enabled: false, log: () => { throw new Error('must not log when disabled'); } });
assert(disabled === null, 'production-disabled observation must have no effect.');

let legacyContinues = false;
const failed = observeQueueResultShadow(queueWriterFacts, {
  enabled: true,
  evaluate: () => { throw new Error('shadow failure'); },
  log: () => undefined,
});
legacyContinues = true;
assert(failed === null && legacyContinues, 'a shadow failure must not block legacy execution.');

const frozenFacts = Object.freeze({ ...queueWriterFacts, legacyBehavior: Object.freeze({ ...queueWriterFacts.legacyBehavior }) });
observeQueueResultShadow(frozenFacts, { enabled: true, evaluate: evaluateCanonicalTransitionShadow, log: () => undefined });
assert(frozenFacts.legacyBehavior.stage === 'negociacao', 'observation must not mutate the legacy facts.');

const attendanceQueueFacts: AttendanceOutcomeShadowFacts = {
  ...queueWriterFacts,
  source: 'queue',
  legacyBehavior: {
    stage: 'negociacao',
    nextActionText: null,
    nextActionDate: null,
    returnAt: null,
    // Conversation and handoff are intentionally absent at PO-2.
  },
};
const attendanceQueue = observeAttendanceOutcomeShadow(attendanceQueueFacts, { enabled: true, log: () => undefined });
assert(attendanceQueue?.source === 'applyAttendanceOutcome:queue', 'attendance observation must identify the authorized queue source.');
assert(attendanceQueue?.classification === 'INSUFFICIENT_CONTEXT', 'attendance writer must not force MATCH while handoff is unobserved.');
assert(!Object.hasOwn(attendanceQueueFacts.legacyBehavior, 'resolvesConversation'), 'CONFIG intent must not be treated as observed conversation behavior.');
assert(!Object.hasOwn(attendanceQueueFacts.legacyBehavior, 'handoff'), 'attendance writer must not manufacture a handoff decision.');

let inboxEvaluationRan = false;
const attendanceInbox = observeAttendanceOutcomeShadow({ ...attendanceQueueFacts, source: 'inbox' }, {
  enabled: true,
  evaluate: () => { inboxEvaluationRan = true; throw new Error('Inbox must not be observed in T4.4'); },
  log: () => undefined,
});
assert(attendanceInbox === null && !inboxEvaluationRan, 'Inbox calls must stay outside the queue-only experiment.');

const attendanceConditional = observeAttendanceOutcomeShadow({
  ...attendanceQueueFacts,
  legacyResult: 'sale_closed',
  legacyBehavior: { ...attendanceQueueFacts.legacyBehavior, stage: 'fechado', resolvesConversation: true },
}, { enabled: true, log: () => undefined });
assert(attendanceConditional?.classification === 'INSUFFICIENT_CONTEXT', 'conditional attendance outcomes must not gain canonical meaning automatically.');

const attendanceUnmapped = observeAttendanceOutcomeShadow({ ...attendanceQueueFacts, legacyResult: 'invalid_phone' }, { enabled: true, log: () => undefined });
assert(attendanceUnmapped?.classification === 'UNMAPPED_LEGACY_VALUE', 'unmapped attendance outcomes must remain diagnostic only.');

const attendanceFailure = observeAttendanceOutcomeShadow(attendanceQueueFacts, {
  enabled: true,
  evaluate: () => { throw new Error('observer failure'); },
  log: () => undefined,
});
assert(attendanceFailure === null, 'attendance observer failure must remain isolated from the legacy writer.');

const clientRepliedFacts: AttendanceOutcomeShadowFacts = {
  ...attendanceQueueFacts,
  legacyResult: 'client_replied',
  legacyBehavior: { stage: 'contato_realizado', nextActionText: 'Definir prÃ³ximo passo comercial', nextActionDate: '2026-09-01T09:00:00Z', returnAt: null },
};
assert(clientRepliedFacts.legacyBehavior.nextActionDate !== null && clientRepliedFacts.legacyBehavior.returnAt === null, 'client_replied must retain a future next-action date without a conversation return_at.');
assert(observeAttendanceOutcomeShadow(clientRepliedFacts, { enabled: true, log: () => undefined })?.classification === 'INSUFFICIENT_CONTEXT', 'client_replied remains conditional with conversation and handoff unobserved.');

const awaitingResponseFacts: AttendanceOutcomeShadowFacts = {
  ...attendanceQueueFacts,
  legacyResult: 'awaiting_response',
  legacyBehavior: { stage: 'contato_realizado', nextActionText: 'Verificar resposta do cliente', nextActionDate: '2026-08-22T10:00:00.000Z', returnAt: '2026-08-22T14:30:00.000Z' },
};
assert(Object.hasOwn(awaitingResponseFacts.legacyBehavior, 'nextActionDate') && Object.hasOwn(awaitingResponseFacts.legacyBehavior, 'returnAt'), 'awaiting_response must observe both temporal dimensions separately.');
assert(awaitingResponseFacts.legacyBehavior.nextActionDate === '2026-08-22T10:00:00.000Z', 'awaiting_response must preserve DATA_A in nextActionDate.');
assert(awaitingResponseFacts.legacyBehavior.returnAt === '2026-08-22T14:30:00.000Z', 'awaiting_response must preserve DATA_B in returnAt.');
assert(String(awaitingResponseFacts.legacyBehavior.nextActionDate) !== String(awaitingResponseFacts.legacyBehavior.returnAt), 'nextActionDate and returnAt must remain distinct even when both are observed.');

const noActionFacts: AttendanceOutcomeShadowFacts = {
  ...attendanceQueueFacts,
  legacyResult: 'record_only',
  legacyBehavior: { stage: 'negociacao', nextActionText: null, nextActionDate: null, returnAt: null },
};
assert(noActionFacts.legacyBehavior.nextActionText === null && noActionFacts.legacyBehavior.nextActionDate === null && noActionFacts.legacyBehavior.returnAt === null, 'a decided absence must not invent an action or temporal value.');

assert(isQueueShadowObservationEnabled(true, 'true'), 'development with the explicit flag enables observation.');
assert(!isQueueShadowObservationEnabled(true, 'false'), 'development without the explicit flag keeps observation disabled.');
assert(!isQueueShadowObservationEnabled(false, 'true'), 'production cannot enable observation even with the flag.');
assert(!isQueueShadowObservationEnabled(false, 'false'), 'production without the flag remains disabled.');
