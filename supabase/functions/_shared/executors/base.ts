// ============================================================================
// EXECUTOR BASE
// ----------------------------------------------------------------------------
// Padrão reutilizável para todos os Executores de Especialistas
// (CRM, Financeiro, Produção, Digital, Rotina, Agenda, Estoque, ...).
//
// Fluxo oficial:
//   IA Orquestradora → Motor de Coordenação → Especialista →
//   Executor do Especialista → Executor Base → Hooks/Supabase/Banco →
//   Executor Base → Executor do Especialista → Especialista →
//   Motor de Coordenação → IA Orquestradora
//
// Responsabilidades:
//   - padronizar entrada (correlation_id, usuário, especialista, entidade,
//     operação, escopo, parâmetros);
//   - validar dados mínimos;
//   - verificar se a operação existe no executor;
//   - executar o handler técnico do módulo (hook/função);
//   - capturar erros técnicos de forma segura;
//   - padronizar a saída (status, mensagem, dados, erro, correlation_id).
//
// O Executor Base NÃO toma decisões estratégicas. Apenas executa e padroniza.
// ============================================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

// ---------- Contratos padrão ----------------------------------------------

export interface BaseExecutionInput {
  correlation_id?: string;
  requested_by?: string;
  specialist?: string;   // ex.: "crm"
  entity?: string;       // ex.: "contato"
  operation: string;     // ex.: "criar"
  scope?: string;        // ex.: "one" | "all"
  params?: Record<string, unknown>;
}

export type BaseExecutionStatus = "ok" | "validation_error" | "not_found" | "error";

export interface BaseExecutionResult {
  status: BaseExecutionStatus;
  ok: boolean;
  message: string;
  entity_id?: string;
  data?: Record<string, unknown>;
  error?: string;
  details?: unknown;
  correlation_id?: string;
}

export interface BaseHandlerContext {
  correlation_id?: string;
  requested_by?: string;
  specialist?: string;
  entity?: string;
  operation: string;
  scope?: string;
  supabase: SupabaseClient;
}

export type BaseOperationHandler = (
  params: Record<string, unknown>,
  ctx: BaseHandlerContext,
) => Promise<Partial<BaseExecutionResult>>;

export interface BaseOperationDefinition {
  handler: BaseOperationHandler;
  requiredParams?: string[]; // parâmetros mínimos obrigatórios
}

// ---------- Cliente Supabase compartilhado --------------------------------

let cachedClient: SupabaseClient | null = null;

export function getBaseSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados");
  }
  cachedClient = createClient(url, key);
  return cachedClient;
}

// ---------- Runner padrão --------------------------------------------------

/**
 * Executa uma operação registrada em um mapa de operações do Executor
 * seguindo o padrão do Executor Base.
 */
export async function runBaseExecution(
  input: BaseExecutionInput,
  operations: Record<string, BaseOperationDefinition>,
): Promise<BaseExecutionResult> {
  const correlation_id = input.correlation_id;
  const operation = input.operation;

  // 1. Validação estrutural mínima
  if (!operation || typeof operation !== "string") {
    return {
      status: "validation_error",
      ok: false,
      message: "Operação não informada ao Executor Base.",
      error: "missing_operation",
      correlation_id,
    };
  }

  // 2. Operação existe?
  const def = operations[operation];
  if (!def) {
    return {
      status: "not_found",
      ok: false,
      message: `Operação "${operation}" não está disponível neste Executor.`,
      error: "operation_not_found",
      correlation_id,
    };
  }

  const params = input.params ?? {};

  // 3. Parâmetros mínimos
  if (def.requiredParams?.length) {
    const missing = def.requiredParams.filter(
      (k) => params[k] === undefined || params[k] === null || params[k] === "",
    );
    if (missing.length > 0) {
      return {
        status: "validation_error",
        ok: false,
        message: `Parâmetros obrigatórios ausentes: ${missing.join(", ")}.`,
        error: "missing_params",
        details: { missing },
        correlation_id,
      };
    }
  }

  // 4. Execução técnica com captura de erro
  try {
    const supabase = getBaseSupabaseClient();
    const ctx: BaseHandlerContext = {
      correlation_id,
      requested_by: input.requested_by,
      specialist: input.specialist,
      entity: input.entity,
      operation,
      scope: input.scope,
      supabase,
    };

    const partial = await def.handler(params, ctx);

    // 5. Padronização de saída
    const ok = partial.ok ?? (partial.status ? partial.status === "ok" : !partial.error);
    return {
      status: partial.status ?? (ok ? "ok" : "error"),
      ok,
      message:
        partial.message ??
        (ok
          ? `Operação "${operation}" executada com sucesso.`
          : partial.error ?? `Falha ao executar "${operation}".`),
      entity_id: partial.entity_id,
      data: partial.data,
      error: ok ? undefined : partial.error,
      details: partial.details,
      correlation_id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      ok: false,
      message: `Erro técnico ao executar "${operation}": ${message}`,
      error: message,
      correlation_id,
    };
  }
}
