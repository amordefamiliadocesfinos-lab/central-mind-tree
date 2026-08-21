export type CrmResultCode = `CRM-RES-${string}`;
export type CrmNextActionCode = `CRM-PA-${string}`;

export type CrmResultFamily =
  | 'interest'
  | 'solution_proposal'
  | 'objection_decision'
  | 'closing_payment'
  | 'temporal_continuity'
  | 'post_sale'
  | 'stock_replenishment'
  | 'contact_restriction';

export interface CrmCanonicalResult {
  code: CrmResultCode;
  label: string;
  description: string;
  family: CrmResultFamily;
  transversal: boolean;
  requiresAdditionalContext: boolean;
}

export type CrmNextActionNature = 'commercial' | 'relational' | 'validation' | 'post_sale';

export interface CrmCanonicalNextAction {
  code: CrmNextActionCode;
  label: string;
  description: string;
  nature: CrmNextActionNature;
  canBeImmediate: boolean;
  canBeFuture: boolean;
  requiresTimeWhenFuture: boolean;
  canGenerateOperationalTask: boolean;
}

export type CrmPriorityLevel = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
export type CrmPriorityState = CrmPriorityLevel | 'SCHEDULED_FUTURE' | 'OUT_OF_ACTIVE_QUEUE';

export interface CrmPriorityContract {
  state: CrmPriorityState;
  reason: string;
  label: string;
  operational: boolean;
  signals: readonly string[];
  tieBreaker?: string;
}

export type CrmEventSource = 'meta' | 'zapi' | 'frontend' | 'automation' | 'integration' | 'manual';
export type CrmEventType =
  | 'message_received'
  | 'customer_replied'
  | 'payment_informed'
  | 'payment_confirmed'
  | 'order_confirmed'
  | 'refusal'
  | 'objection'
  | 'post_sale_issue'
  | 'delivery_confirmed'
  | 'other';

export interface CrmNewFact {
  source: CrmEventSource;
  eventType: CrmEventType;
  timestamp: string;
  contactId?: string | null;
  conversationId?: string | null;
  externalId?: string | null;
  metadata?: Record<string, unknown>;
}
