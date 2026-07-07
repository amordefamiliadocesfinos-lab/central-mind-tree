// ============================================================================
// EXECUTOR UNIVERSAL DE AÇÕES
// ----------------------------------------------------------------------------
// Ponto único de execução de QUALQUER ação solicitada pela IA Orquestradora.
// A IA NUNCA executa diretamente — ela envia uma ActionRequest ao Executor,
// que:
//   1. Interpreta (módulo, entidade, operação, escopo) contra o Catálogo.
//   2. Valida operações destrutivas exigindo confirmação explícita.
//   3. Verifica se há handler real registrado no runtime.
//   4. Executa o handler e aguarda o retorno confirmado do sistema.
//   5. Devolve um ActionResult padronizado.
//
// Todo módulo (CRM, Financeiro, Operações, Assistente, etc.) passa pelo
// MESMO fluxo.
// ============================================================================

import {
  CAPABILITIES_CATALOG,
  resolveCapability,
  type EntityDef,
  type ModuleCapabilities,
  type Operation,
} from "./capabilities-catalog.ts";

// ---------- Contratos ------------------------------------------------------

export interface ActionRequest {
  /** Módulo alvo (opcional — resolvido pelo catálogo quando ausente). */
  module?: string;
  /** Entidade alvo (obrigatório). Aceita id ou alias legado. */
  entity: string;
  /** Operação genérica: criar, listar, consultar, editar, excluir, limpar... */
  operation?: string;
  /** Escopo lógico da operação: "all" | "one" | string livre. */
  scope?: string;
  /** Payload da ação — validado pelo handler específico. */
  payload?: Record<string, unknown>;
  /** Metadados (origem da chamada, usuário ativo, correlação, etc.) */
  meta?: {
    requested_by?: string;
    user_id?: string;
    correlation_id?: string;
    dry_run?: boolean;
  };
  /** Compat: forma antiga { verb, entity } — tratada como operação. */
  verb?: string;
}

export type ActionStatus =
  | "ok"
  | "capability_not_found"
  | "capability_not_available"
  | "confirmation_required"
  | "invalid_payload"
  | "handler_error"
  | "dry_run";

export interface ActionResult {
  status: ActionStatus;
  message: string;
  module?: string;
  entity?: string;
  operation?: string;
  scope?: string;
  data?: unknown;
  error?: string;
  correlation_id?: string;
  executed_at?: string;
}

/** Contexto entregue ao handler já resolvido pelo catálogo. */
export interface HandlerContext {
  module: ModuleCapabilities;
  entity: EntityDef;
  operation: Operation;
  scope?: string;
  request: ActionRequest;
}

export type ActionHandler = (
  ctx: HandlerContext,
) => Promise<Omit<ActionResult, "status" | "correlation_id" | "executed_at" | "module" | "entity" | "operation" | "scope"> & { data?: unknown }>;

// ---------- Registro dinâmico de handlers ---------------------------------

const HANDLERS = new Map<string, ActionHandler>();

function handlerKey(moduleId: string, entityId: string, operation: Operation): string {
  return `${moduleId}::${entityId}::${operation}`;
}

/**
 * Registra um handler real para (módulo, entidade, operação).
 * A combinação DEVE existir no Catálogo Universal.
 */
export function registerActionHandler(
  moduleId: string,
  entityId: string,
  operation: Operation,
  handler: ActionHandler,
): void {
  const mod = CAPABILITIES_CATALOG.find((m) => m.id === moduleId);
  if (!mod) throw new Error(`[ActionExecutor] Módulo inexistente no catálogo: ${moduleId}`);
  const ent = mod.entities.find((e) => e.id === entityId);
  if (!ent) throw new Error(`[ActionExecutor] Entidade inexistente em ${moduleId}: ${entityId}`);
  if (!ent.operations.includes(operation)) {
    throw new Error(
      `[ActionExecutor] Operação "${operation}" não declarada na entidade ${moduleId}.${entityId}. ` +
        `Atualize o catálogo antes de registrar o handler.`,
    );
  }
  HANDLERS.set(handlerKey(moduleId, entityId, operation), handler);
}

export function listRegisteredHandlers(): string[] {
  return Array.from(HANDLERS.keys());
}

// ---------- Execução unificada --------------------------------------------

export async function executeAction(request: ActionRequest): Promise<ActionResult> {
  const correlation_id = request.meta?.correlation_id ?? crypto.randomUUID();
  const executed_at = new Date().toISOString();

  const operationInput = request.operation ?? request.verb;
  if (!operationInput || !request.entity) {
    return {
      status: "invalid_payload",
      message: "ActionRequest inválida: informe pelo menos 'entity' e 'operation'.",
      correlation_id,
      executed_at,
    };
  }

  // 1. Resolve (módulo, entidade, operação) contra o catálogo
  const resolved = resolveCapability({
    moduleId: request.module,
    entity: request.entity,
    operation: operationInput,
  });

  if (!resolved) {
    return {
      status: "capability_not_found",
      message:
        "Ainda não possuo essa capacidade. A combinação de módulo, entidade e operação não está registrada no Catálogo Universal.",
      correlation_id,
      executed_at,
    };
  }

  const { module: mod, entity: ent, operation, inferred_scope } = resolved;
  const scope = request.scope ?? inferred_scope;

  // 2. Confirmação para operações destrutivas
  if (resolved.requires_confirmation) {
    const confirm = Boolean(request.payload?.confirm);
    if (!confirm) {
      return {
        status: "confirmation_required",
        message:
          `A operação "${operation}" em ${ent.name} (${mod.name}) é destrutiva. ` +
          `Confirme com o usuário e reenvie a ActionRequest com payload.confirm = true.`,
        module: mod.id,
        entity: ent.id,
        operation,
        scope,
        correlation_id,
        executed_at,
      };
    }
  }

  // 3. Verifica handler real registrado
  const handler = HANDLERS.get(handlerKey(mod.id, ent.id, operation));
  const declared = ent.status ?? "planejada";
  if (!handler) {
    return {
      status: "capability_not_available",
      message:
        declared === "disponivel"
          ? "A capacidade está declarada como disponível no catálogo, mas nenhum executor real foi conectado no runtime."
          : "Não consegui executar esta ação, pois ainda não existe uma ferramenta disponível para isso.",
      module: mod.id,
      entity: ent.id,
      operation,
      scope,
      correlation_id,
      executed_at,
    };
  }

  // 4. Dry-run
  if (request.meta?.dry_run) {
    return {
      status: "dry_run",
      message: `Capacidade ${mod.name} → ${ent.name} → ${operation} localizada. Execução real não realizada (dry_run).`,
      module: mod.id,
      entity: ent.id,
      operation,
      scope,
      correlation_id,
      executed_at,
    };
  }

  // 5. Executa handler real
  try {
    const out = await handler({ module: mod, entity: ent, operation, scope, request });
    return {
      status: "ok",
      message: out.message ?? `Ação executada: ${mod.name} → ${ent.name} → ${operation}.`,
      module: mod.id,
      entity: ent.id,
      operation,
      scope,
      data: out.data,
      correlation_id,
      executed_at,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
    const status: ActionStatus = msg.startsWith("invalid_payload") ? "invalid_payload" : "handler_error";
    return {
      status,
      message: `Falha ao executar ${mod.name} → ${ent.name} → ${operation}.`,
      module: mod.id,
      entity: ent.id,
      operation,
      scope,
      error: msg,
      correlation_id,
      executed_at,
    };
  }
}

// ---------- Introspecção --------------------------------------------------

export interface ExecutorSnapshot {
  modules: Array<{
    id: string;
    name: string;
    purpose: string;
    entities: Array<{
      id: string;
      name: string;
      operations: Array<{
        operation: Operation;
        destructive: boolean;
        runtime_available: boolean;
      }>;
      declared_status: EntityDef["status"];
      synonyms?: string[];
    }>;
  }>;
}

export function snapshotExecutor(): ExecutorSnapshot {
  return {
    modules: CAPABILITIES_CATALOG.map((mod) => ({
      id: mod.id,
      name: mod.name,
      purpose: mod.purpose,
      entities: mod.entities.map((ent) => ({
        id: ent.id,
        name: ent.name,
        declared_status: ent.status,
        synonyms: ent.synonyms,
        operations: ent.operations.map((op) => ({
          operation: op,
          destructive: Boolean(ent.destructive?.includes(op)),
          runtime_available: HANDLERS.has(handlerKey(mod.id, ent.id, op)),
        })),
      })),
    })),
  };
}
