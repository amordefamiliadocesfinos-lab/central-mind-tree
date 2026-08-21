import type { CrmNewFact } from './types';

export function createCrmNewFact(fact: CrmNewFact): CrmNewFact {
  return { ...fact, metadata: fact.metadata ? { ...fact.metadata } : undefined };
}
