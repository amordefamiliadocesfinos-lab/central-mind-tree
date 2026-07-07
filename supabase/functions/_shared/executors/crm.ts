// ============================================================================
// EXECUTOR CRM
// ----------------------------------------------------------------------------
// Executor técnico do Especialista CRM. Segue o padrão do Executor Base:
// registra operações num mapa e delega validação/erro/saída ao runner base.
//
// Fluxo oficial:
//   IA Orquestradora → Motor de Coordenação → Especialista CRM →
//   Executor CRM → Executor Base → Supabase/DB → Executor Base →
//   Executor CRM → Especialista CRM → Motor de Coordenação → IA Orquestradora
//
// Operações implementadas nesta etapa: criar, consultar, listar.
// ============================================================================

import {
  runBaseExecution,
  type BaseExecutionResult,
  type BaseOperationDefinition,
} from "./base.ts";

export interface ExecutorResult {
  ok: boolean;
  entity_id?: string;
  data?: Record<string, unknown>;
  error?: string;
  details?: unknown;
  correlation_id?: string;
}

export interface ExecutorContext {
  correlation_id?: string;
  requested_by?: string;
}

function toExecutorResult(r: BaseExecutionResult): ExecutorResult {
  return {
    ok: r.ok,
    entity_id: r.entity_id,
    data: r.data,
    error: r.ok ? undefined : (r.error ?? r.message),
    details: r.details,
    correlation_id: r.correlation_id,
  };
}

// ---------------------------------------------------------------------------
// Operações registradas no Executor CRM (usadas via Executor Base)
// ---------------------------------------------------------------------------

const CRM_OPERATIONS: Record<string, BaseOperationDefinition> = {
  // --- criar contato -----------------------------------------------------
  criar: {
    requiredParams: ["name"],
    handler: async (params, ctx) => {
      const name = String(params.name ?? "").trim();
      if (!name) {
        return {
          status: "validation_error",
          ok: false,
          error: "Parâmetro obrigatório ausente: name.",
        };
      }
      const payload: Record<string, unknown> = {
        name,
        type: "cliente",
        person_type: "fisica",
        funnel_status: "novo_lead",
        temperatura_lead: "morno",
        origem_lead: (params.origem_lead as string) ?? "IA Orquestradora",
        is_active: true,
      };
      if (params.whatsapp) payload.whatsapp = params.whatsapp;
      if (params.email) payload.email = params.email;
      if (params.notes) payload.notes = params.notes;

      const { data, error } = await ctx.supabase
        .from("contacts")
        .insert(payload)
        .select("id, name, whatsapp, email")
        .single();

      if (error) {
        return {
          status: "error",
          ok: false,
          error: `Falha técnica ao inserir contato: ${error.message}`,
          details: error,
        };
      }
      return {
        ok: true,
        message: `Contato "${data.name}" criado com sucesso.`,
        entity_id: data.id,
        data: {
          id: data.id,
          name: data.name,
          whatsapp: data.whatsapp ?? null,
          email: data.email ?? null,
        },
      };
    },
  },

  // --- consultar contato -------------------------------------------------
  consultar: {
    handler: async (params, ctx) => {
      const id = params.id as string | undefined;
      const phone_digits = params.phone_digits as string | undefined;
      const email = params.email as string | undefined;
      const name = params.name as string | undefined;

      if (!id && !phone_digits && !email && !name) {
        return {
          status: "validation_error",
          ok: false,
          error: "Informe id, phone_digits, email ou name para consultar.",
        };
      }

      let query = ctx.supabase
        .from("contacts")
        .select(
          "id,name,email,phone,whatsapp,funnel_status,client_classification,lifetime_value,city,state,ultimo_contato,notes",
        )
        .eq("is_active", true)
        .limit(1);

      if (id) query = query.eq("id", id);
      else if (phone_digits) {
        query = query.or(
          `whatsapp.eq.${phone_digits},phone.eq.${phone_digits},mobile.eq.${phone_digits}`,
        );
      } else if (email) query = query.ilike("email", email);
      else if (name) query = query.ilike("name", `%${name}%`);

      const { data, error } = await query.maybeSingle();
      if (error) {
        return { status: "error", ok: false, error: `Falha técnica: ${error.message}` };
      }
      if (!data) {
        return { status: "not_found", ok: false, error: "Contato não encontrado." };
      }
      return { ok: true, entity_id: data.id, data };
    },
  },

  // --- listar contatos ---------------------------------------------------
  listar: {
    handler: async (params, ctx) => {
      const limit = Math.max(1, Math.min(Number(params.limit) || 25, 100));
      let query = ctx.supabase
        .from("contacts")
        .select(
          "id,name,email,phone,whatsapp,funnel_status,client_classification,lifetime_value,ultimo_contato",
        )
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (params.funnel_status) query = query.eq("funnel_status", String(params.funnel_status));
      if (params.search) {
        const s = `%${String(params.search)}%`;
        query = query.or(
          `name.ilike.${s},email.ilike.${s},phone.ilike.${s},whatsapp.ilike.${s}`,
        );
      }

      const { data, error } = await query;
      if (error) {
        return { status: "error", ok: false, error: `Falha técnica: ${error.message}` };
      }
      return {
        ok: true,
        data: { count: data?.length ?? 0, items: data ?? [] },
      };
    },
  },
};

// ---------------------------------------------------------------------------
// API pública mantida (compatível com o Especialista CRM já existente)
// ---------------------------------------------------------------------------

export interface ExecCreateContactInput {
  name: string;
  whatsapp?: string | null;
  email?: string | null;
  notes?: string | null;
  origem_lead?: string | null;
}

export async function execCrmCreateContact(
  input: ExecCreateContactInput,
  ctx?: ExecutorContext,
): Promise<ExecutorResult> {
  const result = await runBaseExecution(
    {
      correlation_id: ctx?.correlation_id,
      requested_by: ctx?.requested_by,
      specialist: "crm",
      entity: "contato",
      operation: "criar",
      params: input as unknown as Record<string, unknown>,
    },
    CRM_OPERATIONS,
  );
  return toExecutorResult(result);
}

export interface ExecGetContactInput {
  id?: string;
  phone_digits?: string | null;
  email?: string | null;
  name?: string | null;
}

export async function execCrmGetContact(
  input: ExecGetContactInput,
  ctx?: ExecutorContext,
): Promise<ExecutorResult> {
  const result = await runBaseExecution(
    {
      correlation_id: ctx?.correlation_id,
      requested_by: ctx?.requested_by,
      specialist: "crm",
      entity: "contato",
      operation: "consultar",
      params: input as unknown as Record<string, unknown>,
    },
    CRM_OPERATIONS,
  );
  return toExecutorResult(result);
}

export interface ExecListContactsInput {
  search?: string | null;
  funnel_status?: string | null;
  limit?: number;
}

export async function execCrmListContacts(
  input: ExecListContactsInput,
  ctx?: ExecutorContext,
): Promise<ExecutorResult> {
  const result = await runBaseExecution(
    {
      correlation_id: ctx?.correlation_id,
      requested_by: ctx?.requested_by,
      specialist: "crm",
      entity: "contato",
      operation: "listar",
      params: (input ?? {}) as unknown as Record<string, unknown>,
    },
    CRM_OPERATIONS,
  );
  return toExecutorResult(result);
}
