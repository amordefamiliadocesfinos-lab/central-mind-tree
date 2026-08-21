import type { CrmPriorityContract, CrmPriorityState } from './types';

export const CRM_ACTIVE_PRIORITY_LEVELS = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
export const CRM_NON_ACTIVE_PRIORITY_STATES = ['SCHEDULED_FUTURE', 'OUT_OF_ACTIVE_QUEUE'] as const;
export function isActivePriority(state: CrmPriorityState): state is typeof CRM_ACTIVE_PRIORITY_LEVELS[number] { return (CRM_ACTIVE_PRIORITY_LEVELS as readonly string[]).includes(state); }
export function createPriorityContract(state: CrmPriorityState, reason: string, label: string, signals: readonly string[] = [], tieBreaker?: string): CrmPriorityContract { return { state, reason, label, operational: isActivePriority(state), signals, tieBreaker }; }
