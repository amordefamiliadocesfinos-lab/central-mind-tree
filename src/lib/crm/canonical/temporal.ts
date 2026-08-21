import { getCanonicalNextAction } from './nextActions';
import type { CrmNextActionCode } from './types';

export function isLegitimateNoNextAction(code?: CrmNextActionCode | null) { return code == null; }
export function nextActionCanBeImmediate(code?: CrmNextActionCode | null) { return code ? Boolean(getCanonicalNextAction(code)?.canBeImmediate) : false; }
export function nextActionCanBeFuture(code?: CrmNextActionCode | null) { return code ? Boolean(getCanonicalNextAction(code)?.canBeFuture) : false; }
export function nextActionRequiresTimeWhenFuture(code?: CrmNextActionCode | null) { return code ? Boolean(getCanonicalNextAction(code)?.requiresTimeWhenFuture) : false; }
export function nextActionCanGenerateTask(code?: CrmNextActionCode | null) { return code ? Boolean(getCanonicalNextAction(code)?.canGenerateOperationalTask) : false; }
/** `return_at` só é semanticamente válido para uma ação futura legítima. */
export function canSetReturnAt(code?: CrmNextActionCode | null, scheduledFor?: string | null) { return Boolean(code && scheduledFor && nextActionCanBeFuture(code)); }
