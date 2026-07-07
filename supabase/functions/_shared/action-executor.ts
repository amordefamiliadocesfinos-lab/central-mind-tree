// ============================================================================
// EXECUTOR UNIVERSAL DE AÇÕES
// ----------------------------------------------------------------------------
// Ponto único de execução de QUALQUER ação solicitada pela IA Orquestradora.
// A IA NUNCA executa diretamente — ela envia uma ActionRequest ao Executor,
// que:
//   1. Valida a capacidade contra o Catálogo Universal.
//   2. Verifica se há um handler real registrado (status "disponivel").
//   3. Executa o handler correspondente ao módulo correto.
//   4. Aguarda retorno confirmado do sistema.
//   5. Devolve um ActionResult padronizado.
//
// Todo módulo (CRM, Financeiro, Operações, etc.) passa pelo MESMO fluxo.
// ============================================================================

import {
  CAPABILITIES_CATALOG,
  findCapability,
  type Capability,
  type ModuleCapabilities,
} from "./capabilities-catalog.ts";

// ---------- Contratos ------------------------------------------------------

export interface ActionRequest {
  /** Verbo da capacidade (criar, editar, excluir, consultar, ...) */
  verb: string;
  /** Entidade alvo (tarefa, contato, lancamento_financeiro, ...) */
  entity: string;
  /** Payload da ação — validado pelo handler específico */
  payload?: Record<string, unknown>;
  /** Metadados (origem da chamada, usuário ativo, correlação, etc.) */
  meta?: {
    requested_by?: string;   // ex.: "ai_orquestradora"
    user_id?: string;
    correlation_id?: string;
    dry_run?: boolean;
  };
}

export type ActionStatus =
  | "ok"                      // executado com confirmação real do sistema
  | "capability_not_found"    // não existe no catálogo
  | "capability_not_available"// existe mas está "planejada"
  | "invalid_payload"         // payload rejeitado pelo handler
  | "handler_error"           // erro durante execução real
  | "dry_run";                // simulação (não executou)

export interface ActionResult {
  status: ActionStatus;
  message: string;
  module?: string;
  capability?: string;
  data?: unknown;
  error?: string;
  correlation_id?: string;
  executed_at?: string;
}

/** Handler real conectado a um módulo do sistema. */
export type ActionHandler = (
  request: ActionRequest,
) => Promise<Omit<ActionResult, "status" | "correlation_id" | "executed_at"> & { data?: unknown }>;

// ---------- Registro dinâmico de handlers ---------------------------------

const HANDLERS = new Map<string, ActionHandler>();

function handlerKey(verb: string, entity: string): string {
  return `${verb.toLowerCase()}::${entity.toLowerCase()}`;
}

/**
 * Registra um handler real para uma capacidade.
 * A capacidade DEVE existir no Catálogo Universal.
 * Ao registrar, o Executor passa a considerar essa capacidade como
 * efetivamente "disponível" no runtime (mesmo que o catálogo estático
 * ainda a marque como "planejada" — o runtime tem prioridade).
 */
export function registerActionHandler(
  verb: string,
  entity: string,
  handler: ActionHandler,
): void {
  const hit = findCapability(verb, entity);
  if (!hit) {
    throw new Error(
      `[ActionExecutor] Tentativa de registrar handler para capacidade inexistente: ${verb}_${entity}. ` +
        `Adicione-a ao Catálogo Universal antes de conectar um executor.`,
    );
  }
  HANDLERS.set(handlerKey(verb, entity), handler);
}

export function listRegisteredHandlers(): string[] {
  return Array.from(HANDLERS.keys());
}

// ---------- Execução unificada --------------------------------------------

export async function executeAction(request: ActionRequest): Promise<ActionResult> {
  const correlation_id =
    request.meta?.correlation_id ?? crypto.randomUUID();
  const executed_at = new Date().toISOString();

  // 1. Localiza capacidade no catálogo
  const hit = findCapability(request.verb, request.entity);
  if (!hit) {
    return {
      status: "capability_not_found",
      message:
        "Ainda não possuo essa capacidade. A ação solicitada não está registrada no Catálogo Universal de Capacidades.",
      correlation_id,
      executed_at,
    };
  }

  const { module: mod, capability } = hit;
  const capLabel = `${capability.verb}_${capability.entity}`;

  // 2. Verifica handler real registrado
  const handler = HANDLERS.get(handlerKey(capability.verb, capability.entity));
  const runtimeAvailable = Boolean(handler);
  const declaredAvailable = capability.status === "disponivel";

  if (!handler || (!runtimeAvailable && !declaredAvailable)) {
    return {
      status: "capability_not_available",
      message:
        "Não consegui executar esta ação, pois ainda não existe uma ferramenta disponível para isso.",
      module: mod.id,
      capability: capLabel,
      correlation_id,
      executed_at,
    };
  }

  // 3. Dry-run: valida caminho sem executar
  if (request.meta?.dry_run) {
    return {
      status: "dry_run",
      message: `Capacidade ${capLabel} localizada no módulo ${mod.name}. Execução real não realizada (dry_run).`,
      module: mod.id,
      capability: capLabel,
      correlation_id,
      executed_at,
    };
  }

  // 4. Executa handler real e aguarda retorno confirmado
  try {
    const out = await handler(request);
    return {
      status: "ok",
      message: out.message ?? `Ação ${capLabel} executada com sucesso.`,
      module: out.module ?? mod.id,
      capability: out.capability ?? capLabel,
      data: out.data,
      correlation_id,
      executed_at,
    };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
    return {
      status: "handler_error",
      message: `Falha ao executar ${capLabel} no módulo ${mod.name}.`,
      module: mod.id,
      capability: capLabel,
      error: msg,
      correlation_id,
      executed_at,
    };
  }
}

// ---------- Introspecção (para IA e UIs) ----------------------------------

export interface ExecutorSnapshot {
  modules: Array<{
    id: string;
    name: string;
    purpose: string;
    capabilities: Array<{
      verb: string;
      entity: string;
      declared_status: Capability["status"];
      runtime_available: boolean;
      description: string;
    }>;
  }>;
}

export function snapshotExecutor(): ExecutorSnapshot {
  return {
    modules: CAPABILITIES_CATALOG.map((mod: ModuleCapabilities) => ({
      id: mod.id,
      name: mod.name,
      purpose: mod.purpose,
      capabilities: mod.capabilities.map((c) => ({
        verb: c.verb,
        entity: c.entity,
        declared_status: c.status,
        runtime_available: HANDLERS.has(handlerKey(c.verb, c.entity)),
        description: c.description,
      })),
    })),
  };
}
