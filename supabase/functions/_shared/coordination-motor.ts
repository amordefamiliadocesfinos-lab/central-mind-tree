// ============================================================================
// MOTOR DE COORDENAÇÃO DA IA ORQUESTRADORA
// ----------------------------------------------------------------------------
// Camada intermediária entre a IA Orquestradora e os Especialistas (módulos).
//
// Nesta etapa, o Motor NÃO executa ações reais no banco. Ele apenas:
//   1. Recebe a solicitação padronizada da IA.
//   2. Valida o formato mínimo da entrada.
//   3. Resolve o Especialista responsável a partir do Catálogo Universal.
//   4. Registra a solicitação em um log em memória (auditoria da etapa).
//   5. Devolve uma resposta padronizada com o plano de encaminhamento.
//
// Nenhum módulo existente é alterado. Nenhum fluxo atual é modificado.
// ============================================================================

import { CAPABILITIES_CATALOG, resolveCapability } from "./capabilities-catalog.ts";
import {
  crmCreateContact,
  crmGetContact,
  crmListContacts,
  type SpecialistResult,
} from "./specialists/crm.ts";

// ---------- Contratos ------------------------------------------------------

export interface CoordinationRequest {
  requested_by?: string;      // usuário solicitante
  objective?: string;         // objetivo identificado pela IA
  module?: string;            // módulo sugerido
  entity: string;             // entidade
  operation: string;          // operação
  scope?: string;             // escopo (all | one | livre)
  params?: Record<string, unknown>; // parâmetros
  risk_level?: "low" | "medium" | "high" | "critical";
  requires_confirmation?: boolean;
  correlation_id?: string;
}

export type CoordinationStatus =
  | "planned"                  // solicitação aceita, sem especialista real ainda
  | "executed"                 // especialista executou a ação com sucesso
  | "execution_failed"         // especialista tentou executar e retornou erro
  | "specialist_not_found"     // não há especialista para essa capacidade
  | "invalid_request"          // faltam campos obrigatórios
  | "confirmation_required";   // ação destrutiva sem confirmação explícita

export interface CoordinationResponse {
  status: CoordinationStatus;
  message: string;
  suggested_specialist?: {
    module_id: string;
    module_name: string;
    entity_id: string;
    entity_name: string;
  };
  planned_action?: {
    operation: string;
    scope?: string;
    params?: Record<string, unknown>;
    destructive: boolean;
    requires_confirmation: boolean;
  };
  execution?: {
    performed: boolean;
    ok?: boolean;
    entity_id?: string;
    data?: Record<string, unknown>;
    error?: string;
  };
  correlation_id: string;
  received_at: string;
  error?: string;
}

// ---------- Registro de especialistas conectados --------------------------
// Cada entrada mapeia (module_id + entity_id + operation) para o executor real.
// Nesta etapa, apenas CRM / Contato / criar está conectado.
type SpecialistExecutor = (
  params: Record<string, unknown> | undefined,
) => Promise<SpecialistResult>;

const SPECIALIST_REGISTRY: Record<string, SpecialistExecutor> = {
  "crm:contato:criar": (params) => crmCreateContact(params as any),
};

function specialistKey(moduleId: string, entityId: string, operation: string): string {
  return `${moduleId}:${entityId}:${operation}`;
}

// ---------- Log em memória (validação desta etapa) ------------------------

interface CoordinationLogEntry {
  correlation_id: string;
  received_at: string;
  request: CoordinationRequest;
  response: CoordinationResponse;
}

const COORDINATION_LOG: CoordinationLogEntry[] = [];
const MAX_LOG_ENTRIES = 200;

export function getCoordinationLog(limit = 50): CoordinationLogEntry[] {
  return COORDINATION_LOG.slice(-Math.min(limit, MAX_LOG_ENTRIES)).reverse();
}

export function clearCoordinationLog(): void {
  COORDINATION_LOG.length = 0;
}

// ---------- Recepção e encaminhamento -------------------------------------

export async function coordinateRequest(
  request: CoordinationRequest,
): Promise<CoordinationResponse> {
  const correlation_id = request.correlation_id ?? crypto.randomUUID();
  const received_at = new Date().toISOString();

  // 1. Validação mínima
  if (!request.entity || !request.operation) {
    const resp: CoordinationResponse = {
      status: "invalid_request",
      message:
        "Solicitação incompleta: informe pelo menos 'entity' e 'operation'.",
      correlation_id,
      received_at,
    };
    record(request, resp);
    return resp;
  }

  // 2. Resolve especialista via catálogo
  const resolved = resolveCapability({
    moduleId: request.module,
    entity: request.entity,
    operation: request.operation,
  });

  if (!resolved) {
    const resp: CoordinationResponse = {
      status: "specialist_not_found",
      message:
        "Nenhum Especialista registrado é capaz de atender essa combinação de entidade e operação. A capacidade ainda não está disponível.",
      correlation_id,
      received_at,
    };
    record(request, resp);
    return resp;
  }

  const { module: mod, entity: ent, operation, inferred_scope, requires_confirmation } = resolved;
  const scope = request.scope ?? inferred_scope;
  const needsConfirm = Boolean(requires_confirmation || request.requires_confirmation);
  const confirmed = Boolean(request.params?.confirm);

  // 3. Confirmação para operações destrutivas
  if (needsConfirm && !confirmed) {
    const resp: CoordinationResponse = {
      status: "confirmation_required",
      message:
        `A operação "${operation}" em ${ent.name} (${mod.name}) exige confirmação explícita do usuário antes de ser encaminhada.`,
      suggested_specialist: {
        module_id: mod.id,
        module_name: mod.name,
        entity_id: ent.id,
        entity_name: ent.name,
      },
      planned_action: {
        operation,
        scope,
        params: request.params,
        destructive: true,
        requires_confirmation: true,
      },
      correlation_id,
      received_at,
    };
    record(request, resp);
    return resp;
  }

  // 4. Dispatch para o Especialista real, se conectado
  const key = specialistKey(mod.id, ent.id, operation);
  const executor = SPECIALIST_REGISTRY[key];

  const baseSpecialist = {
    module_id: mod.id,
    module_name: mod.name,
    entity_id: ent.id,
    entity_name: ent.name,
  };
  const basePlan = {
    operation,
    scope,
    params: request.params,
    destructive: Boolean(requires_confirmation),
    requires_confirmation: needsConfirm,
  };

  if (executor) {
    try {
      const result = await executor(request.params);
      const resp: CoordinationResponse = {
        status: result.ok ? "executed" : "execution_failed",
        message: result.ok
          ? `Especialista "${mod.name}" executou a operação "${operation}" em ${ent.name} com sucesso.`
          : `Especialista "${mod.name}" retornou erro ao executar "${operation}": ${result.error ?? "erro desconhecido"}`,
        suggested_specialist: baseSpecialist,
        planned_action: basePlan,
        execution: {
          performed: true,
          ok: result.ok,
          entity_id: result.entity_id,
          data: result.data,
          error: result.error,
        },
        correlation_id,
        received_at,
      };
      record(request, resp);
      return resp;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const resp: CoordinationResponse = {
        status: "execution_failed",
        message: `Falha inesperada no Especialista "${mod.name}": ${message}`,
        suggested_specialist: baseSpecialist,
        planned_action: basePlan,
        execution: { performed: true, ok: false, error: message },
        correlation_id,
        received_at,
      };
      record(request, resp);
      return resp;
    }
  }

  // 5. Sem especialista conectado ainda — apenas planejamento
  const resp: CoordinationResponse = {
    status: "planned",
    message:
      `Solicitação recebida e encaminhada ao Especialista "${mod.name}" para a entidade "${ent.name}" (operação: ${operation}). Especialista real ainda não conectado nesta etapa.`,
    suggested_specialist: baseSpecialist,
    planned_action: basePlan,
    execution: { performed: false },
    correlation_id,
    received_at,
  };
  record(request, resp);
  return resp;
}

function record(request: CoordinationRequest, response: CoordinationResponse): void {
  COORDINATION_LOG.push({
    correlation_id: response.correlation_id,
    received_at: response.received_at,
    request,
    response,
  });
  if (COORDINATION_LOG.length > MAX_LOG_ENTRIES) {
    COORDINATION_LOG.splice(0, COORDINATION_LOG.length - MAX_LOG_ENTRIES);
  }
}

// ---------- Introspecção --------------------------------------------------

export function listSpecialists() {
  return CAPABILITIES_CATALOG.map((mod) => ({
    module_id: mod.id,
    module_name: mod.name,
    purpose: mod.purpose,
    entities: (Array.isArray(mod.entities) ? mod.entities : []).map((e) => ({
      entity_id: e.id,
      entity_name: e.name,
      operations: Array.isArray(e.operations) ? e.operations : [],
    })),
  }));
}
