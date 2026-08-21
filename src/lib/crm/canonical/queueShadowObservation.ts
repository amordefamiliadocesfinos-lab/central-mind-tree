import {
  evaluateCanonicalTransitionShadow,
  type CrmTransitionShadowInput,
  type CrmTransitionShadowResult,
} from './transitionAdapter';

type ObservationSource = 'handleQueueDone' | 'applyAttendanceOutcome:queue';

/** Technical facts only. Contact and conversation identifiers are deliberately absent. */
export interface QueueResultShadowFacts {
  legacyResult: string;
  currentFunnelStatus: string | null;
  currentNextActionText: string | null;
  currentNextActionDate: string | null;
  legacyBehavior: NonNullable<CrmTransitionShadowInput['legacyBehavior']>;
  operationalConversationCandidates?: number;
}

/**
 * Facts already calculated by applyAttendanceOutcome before its first write.
 * Physical conversation behavior and handoff remain absent because neither has
 * been selected or applied at this point.
 */
export interface AttendanceOutcomeShadowFacts extends QueueResultShadowFacts {
  source: 'queue' | 'inbox';
}

export interface QueueShadowObservation {
  source: ObservationSource;
  legacyResult: string;
  canonicalResult: string | null;
  classification: CrmTransitionShadowResult['legacyComparison']['status'];
  differences: string[];
  mappingWarnings: string[];
  missingContext: string[];
  conversationWarnings: string[];
  taskHint: CrmTransitionShadowResult['futureTaskHint'];
  returnAtHint: CrmTransitionShadowResult['returnAtHint'];
  handoff: boolean | null;
}

export interface QueueShadowObservationOptions {
  enabled: boolean;
  log?: (message: string, detail?: QueueShadowObservation) => void;
  evaluate?: (input: CrmTransitionShadowInput) => CrmTransitionShadowResult;
}

/** Pure feature gate: the observation can never run in a production build. */
export function isQueueShadowObservationEnabled(isDevelopment: boolean, flag: string | undefined): boolean {
  return isDevelopment && flag === 'true';
}

export function buildQueueResultShadowInput(facts: QueueResultShadowFacts): CrmTransitionShadowInput {
  return {
    legacyResult: facts.legacyResult,
    funnelStatus: facts.currentFunnelStatus,
    nextActionText: facts.currentNextActionText,
    nextActionDate: facts.currentNextActionDate,
    // The writers do not read current return_at at this point; no extra query is made.
    returnAt: null,
    operationalConversationCandidates: facts.operationalConversationCandidates,
    legacyBehavior: facts.legacyBehavior,
  };
}

function toObservation(
  source: ObservationSource,
  legacyResult: string,
  diagnostic: CrmTransitionShadowResult,
): QueueShadowObservation {
  return {
    source,
    legacyResult,
    canonicalResult: diagnostic.canonicalDecision?.result ?? null,
    classification: diagnostic.legacyComparison.status,
    differences: diagnostic.legacyComparison.differences,
    mappingWarnings: diagnostic.mappingWarnings,
    missingContext: diagnostic.missingContext,
    conversationWarnings: diagnostic.conversationAmbiguity === 'NONE'
      ? []
      : [diagnostic.conversationAmbiguity],
    taskHint: diagnostic.futureTaskHint,
    returnAtHint: diagnostic.returnAtHint,
    handoff: diagnostic.canonicalDecision?.handoff.required ?? null,
  };
}

function observeShadow(
  source: ObservationSource,
  facts: QueueResultShadowFacts,
  options: QueueShadowObservationOptions,
): QueueShadowObservation | null {
  if (!options.enabled) return null;
  try {
    const diagnostic = (options.evaluate ?? evaluateCanonicalTransitionShadow)(buildQueueResultShadowInput(facts));
    const observation = toObservation(source, facts.legacyResult, diagnostic);
    (options.log ?? console.debug)('[CRM Shadow] observação local', observation);
    return observation;
  } catch {
    // Diagnostics are never allowed to stop the legacy writer.
    (options.log ?? console.info)('[CRM Shadow] observação indisponível; fluxo legado preservado.');
    return null;
  }
}

export function observeQueueResultShadow(
  facts: QueueResultShadowFacts,
  options: QueueShadowObservationOptions,
): QueueShadowObservation | null {
  return observeShadow('handleQueueDone', facts, options);
}

/**
 * The T4.4 experiment is restricted to the queue. Inbox calls intentionally
 * return before evaluating the canonical diagnostic.
 */
export function observeAttendanceOutcomeShadow(
  facts: AttendanceOutcomeShadowFacts,
  options: QueueShadowObservationOptions,
): QueueShadowObservation | null {
  if (facts.source !== 'queue') return null;
  return observeShadow('applyAttendanceOutcome:queue', facts, options);
}
