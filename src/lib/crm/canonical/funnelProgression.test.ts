import { getCrmTransition } from './transitions';
import { resolveFunnelStageFromCanonicalResult } from './funnelProgression';
import { CRM_CANONICAL_RESULTS } from './results';
import type { CrmFunnelStage } from '../model';
import type { CrmResultCode } from './types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Funnel progression: ${message}`);
}

function resolve(result: CrmResultCode, currentStage: CrmFunnelStage, future = false) {
  const decision = getCrmTransition({ result, currentStage, currentNextAction: null, currentNextActionDate: null, currentReturnAt: null, operationalContext: { hasLegitimateFutureReason: future, hasConcreteReturnMoment: future } });
  return resolveFunnelStageFromCanonicalResult({ result, currentStage, decision, hasLegitimateFutureReturn: future });
}

assert(CRM_CANONICAL_RESULTS.length === 33, 'all 33 canonical results must remain available.');
for (const item of CRM_CANONICAL_RESULTS) assert(resolve(item.code, 'contato_realizado').previousStage === 'contato_realizado', `${item.code} must resolve a stage.`);
assert(resolve('CRM-RES-001', 'novo_lead').nextStage === 'contato_realizado', 'new lead + interest must advance.');
assert(resolve('CRM-RES-001', 'negociacao').action === 'KEEP', 'interest must not regress negotiation.');
assert(resolve('CRM-RES-002', 'negociacao').nextStage === 'perdido', 'no interest must close commercially.');
assert(resolve('CRM-RES-003', 'contato_realizado', true).nextStage === 'cadencia', 'silence with legitimate return must enter cadence.');
assert(resolve('CRM-RES-005', 'contato_realizado').action === 'KEEP', 'solution approval must not fabricate proposal sent.');
assert(resolve('CRM-RES-007', 'proposta_enviada').nextStage === 'negociacao', 'proposal accepted must enter negotiation.');
assert(resolve('CRM-RES-008', 'contato_realizado').nextStage === 'proposta_enviada', 'proposal analysis must identify proposal sent.');
assert(resolve('CRM-RES-015', 'negociacao').nextStage === 'perdido', 'withdrawal must close commercially.');
assert(resolve('CRM-RES-018', 'proposta_enviada').nextStage === 'negociacao', 'awaiting payment must not close the sale.');
assert(resolve('CRM-RES-019', 'negociacao').nextStage === 'negociacao', 'payment informed must not close the sale.');
assert(resolve('CRM-RES-020', 'negociacao').nextStage === 'negociacao', 'payment confirmed alone must not close the sale.');
assert(resolve('CRM-RES-021', 'negociacao').nextStage === 'fechado', 'confirmed order must close commercially.');
assert(resolve('CRM-RES-022', 'proposta_enviada', true).action === 'KEEP', 'return combined must keep the commercial stage.');
assert(resolve('CRM-RES-023', 'fechado').nextStage === 'pos_venda', 'delivery confirmation must enter post-sale.');
assert(resolve('CRM-RES-024', 'fechado').nextStage === 'pos_venda', 'post-sale issue must remain visible in post-sale.');
assert(resolve('CRM-RES-028', 'fechado').nextStage === 'pos_venda', 'negative experience must not become lost automatically.');
assert(resolve('CRM-RES-032', 'pos_venda').nextStage === 'contato_realizado', 'replenishment request must reopen the opportunity.');
assert(resolve('CRM-RES-033', 'negociacao').nextStage === 'perdido', 'contact restriction must close commercially.');
assert(resolve('CRM-RES-008', 'negociacao').action === 'KEEP', 'automatic progression must not regress a later stage.');
