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

      const SELECT_COLS =
        "id,name,email,phone,whatsapp,mobile,funnel_status,client_classification,lifetime_value,city,state,ultimo_contato,notes";

      // 1) ID exato → resposta única e determinística
      if (id) {
        const { data, error } = await ctx.supabase
          .from("contacts")
          .select(SELECT_COLS)
          .eq("id", id)
          .eq("is_active", true)
          .maybeSingle();
        if (error) return { status: "error", ok: false, error: `Falha técnica: ${error.message}` };
        if (!data) return { status: "not_found", ok: false, error: "Contato não encontrado." };
        return { ok: true, entity_id: data.id, data };
      }

      // 2) Demais critérios: buscar até 10 e decidir se é único ou ambíguo
      let query = ctx.supabase
        .from("contacts")
        .select(SELECT_COLS)
        .eq("is_active", true)
        .limit(10);

      if (phone_digits) {
        query = query.or(
          `whatsapp.eq.${phone_digits},phone.eq.${phone_digits},mobile.eq.${phone_digits}`,
        );
      } else if (email) {
        query = query.ilike("email", email);
      } else if (name) {
        query = query.ilike("name", `%${name}%`);
      }

      const { data, error } = await query;
      if (error) return { status: "error", ok: false, error: `Falha técnica: ${error.message}` };
      const rows = data ?? [];
      if (rows.length === 0) {
        return { status: "not_found", ok: false, error: "Contato não encontrado." };
      }
      if (rows.length === 1) {
        return { ok: true, entity_id: rows[0].id, data: rows[0] };
      }
      // Ambíguo: devolver opções para a IA Orquestradora oferecer escolha
      return {
        ok: true,
        status: "ok",
        message: `Encontrados ${rows.length} contatos parecidos. Escolha um para consultar.`,
        data: {
          ambiguous: true,
          match_count: rows.length,
          options: rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            whatsapp: r.whatsapp ?? null,
            phone: r.phone ?? null,
            email: r.email ?? null,
            funnel_status: r.funnel_status ?? null,
            city: r.city ?? null,
            state: r.state ?? null,
          })),
        },
      };
    },
  },

  // --- editar contato ----------------------------------------------------
  editar: {

    handler: async (params, ctx) => {
      const id = params.id as string | undefined;
      const phone_digits = params.phone_digits as string | undefined;
      const email_lookup = params.email_lookup as string | undefined;
      const name_lookup = params.name_lookup as string | undefined;

      if (!id && !phone_digits && !email_lookup && !name_lookup) {
        return {
          status: "validation_error",
          ok: false,
          error: "Informe id, phone_digits, email_lookup ou name_lookup para localizar o contato.",
        };
      }

      const updates = (params.updates ?? {}) as Record<string, unknown>;
      const allowed = ["name", "phone", "whatsapp", "email", "notes"];
      const cleanUpdates: Record<string, unknown> = {};
      for (const k of allowed) {
        if (updates[k] !== undefined && updates[k] !== null && updates[k] !== "") {
          cleanUpdates[k] = updates[k];
        }
      }
      if (Object.keys(cleanUpdates).length === 0) {
        return {
          status: "validation_error",
          ok: false,
          error: "Nenhum campo válido para atualizar (permitidos: name, phone, whatsapp, email, notes).",
        };
      }

      // 1) Localizar contato
      let targetId: string | null = null;
      if (id) {
        const { data, error } = await ctx.supabase
          .from("contacts")
          .select("id")
          .eq("id", id)
          .eq("is_active", true)
          .maybeSingle();
        if (error) return { status: "error", ok: false, error: `Falha técnica: ${error.message}` };
        if (!data) return { status: "not_found", ok: false, error: "Contato não encontrado." };
        targetId = data.id;
      } else {
        let query = ctx.supabase
          .from("contacts")
          .select("id,name,whatsapp,phone,email,funnel_status,city,state")
          .eq("is_active", true)
          .limit(10);
        if (phone_digits) {
          query = query.or(
            `whatsapp.eq.${phone_digits},phone.eq.${phone_digits},mobile.eq.${phone_digits}`,
          );
        } else if (email_lookup) {
          query = query.ilike("email", email_lookup);
        } else if (name_lookup) {
          query = query.ilike("name", `%${name_lookup}%`);
        }
        const { data, error } = await query;
        if (error) return { status: "error", ok: false, error: `Falha técnica: ${error.message}` };
        const rows = data ?? [];
        if (rows.length === 0) {
          return { status: "not_found", ok: false, error: "Contato não encontrado para edição." };
        }
        if (rows.length > 1) {
          return {
            ok: true,
            status: "ok",
            message: `Encontrados ${rows.length} contatos parecidos. Escolha um antes de editar.`,
            data: {
              ambiguous: true,
              match_count: rows.length,
              options: rows.map((r: any) => ({
                id: r.id,
                name: r.name,
                whatsapp: r.whatsapp ?? null,
                phone: r.phone ?? null,
                email: r.email ?? null,
                funnel_status: r.funnel_status ?? null,
                city: r.city ?? null,
                state: r.state ?? null,
              })),
            },
          };
        }
        targetId = rows[0].id;
      }

      // 2) Aplicar atualização
      const { data: updated, error: upErr } = await ctx.supabase
        .from("contacts")
        .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
        .eq("id", targetId!)
        .select("id,name,email,phone,whatsapp,notes")
        .maybeSingle();

      if (upErr) {
        return {
          status: "error",
          ok: false,
          error: `Falha técnica ao atualizar contato: ${upErr.message}`,
          details: upErr,
        };
      }
      if (!updated) {
        return { status: "not_found", ok: false, error: "Contato não encontrado após atualização." };
      }

      return {
        ok: true,
        message: `Contato "${updated.name}" atualizado com sucesso.`,
        entity_id: updated.id,
        data: {
          id: updated.id,
          updated_fields: Object.keys(cleanUpdates),
          contact: updated,
        },
      };
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

  // --- excluir contato ---------------------------------------------------
  excluir: {
    handler: async (params, ctx) => {
      const id = params.id as string | undefined;
      const phone_digits = params.phone_digits as string | undefined;
      const email_lookup = params.email_lookup as string | undefined;
      const name_lookup = params.name_lookup as string | undefined;

      if (!id && !phone_digits && !email_lookup && !name_lookup) {
        return {
          status: "validation_error",
          ok: false,
          error: "Informe id, phone_digits, email_lookup ou name_lookup para localizar o contato a excluir.",
        };
      }

      // 1) Localizar contato
      let target: { id: string; name: string } | null = null;
      if (id) {
        const { data, error } = await ctx.supabase
          .from("contacts")
          .select("id,name")
          .eq("id", id)
          .eq("is_active", true)
          .maybeSingle();
        if (error) return { status: "error", ok: false, error: `Falha técnica: ${error.message}` };
        if (!data) return { status: "not_found", ok: false, error: "Contato não encontrado." };
        target = { id: data.id, name: data.name };
      } else {
        let query = ctx.supabase
          .from("contacts")
          .select("id,name,whatsapp,phone,email,funnel_status,city,state")
          .eq("is_active", true)
          .limit(10);
        if (phone_digits) {
          query = query.or(
            `whatsapp.eq.${phone_digits},phone.eq.${phone_digits},mobile.eq.${phone_digits}`,
          );
        } else if (email_lookup) {
          query = query.ilike("email", email_lookup);
        } else if (name_lookup) {
          query = query.ilike("name", `%${name_lookup}%`);
        }
        const { data, error } = await query;
        if (error) return { status: "error", ok: false, error: `Falha técnica: ${error.message}` };
        const rows = data ?? [];
        if (rows.length === 0) {
          return { status: "not_found", ok: false, error: "Contato não encontrado para exclusão." };
        }
        if (rows.length > 1) {
          return {
            ok: true,
            status: "ok",
            message: `Encontrados ${rows.length} contatos parecidos. Escolha um antes de excluir.`,
            data: {
              ambiguous: true,
              match_count: rows.length,
              options: rows.map((r: any) => ({
                id: r.id,
                name: r.name,
                whatsapp: r.whatsapp ?? null,
                phone: r.phone ?? null,
                email: r.email ?? null,
                funnel_status: r.funnel_status ?? null,
                city: r.city ?? null,
                state: r.state ?? null,
              })),
            },
          };
        }
        target = { id: rows[0].id, name: rows[0].name };
      }

      // 2) Executar exclusão real no banco
      const { error: delErr } = await ctx.supabase
        .from("contacts")
        .delete()
        .eq("id", target!.id);

      if (delErr) {
        return {
          status: "error",
          ok: false,
          error: `Falha técnica ao excluir contato: ${delErr.message}. Pode haver vínculos (pedidos, financeiro, atendimentos) impedindo a remoção.`,
          details: delErr,
        };
      }

      return {
        ok: true,
        message: `Contato "${target!.name}" excluído com sucesso.`,
        entity_id: target!.id,
        data: { id: target!.id, name: target!.name, deleted: true },
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

export interface ExecEditContactInput {
  id?: string | null;
  phone_digits?: string | null;
  email_lookup?: string | null;
  name_lookup?: string | null;
  updates: {
    name?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    notes?: string;
  };
}

export async function execCrmEditContact(
  input: ExecEditContactInput,
  ctx?: ExecutorContext,
): Promise<ExecutorResult> {
  const result = await runBaseExecution(
    {
      correlation_id: ctx?.correlation_id,
      requested_by: ctx?.requested_by,
      specialist: "crm",
      entity: "contato",
      operation: "editar",
      params: input as unknown as Record<string, unknown>,
    },
    CRM_OPERATIONS,
  );
  return toExecutorResult(result);
}
