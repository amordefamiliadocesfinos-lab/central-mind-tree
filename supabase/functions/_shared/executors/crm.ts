// ============================================================================
// EXECUTOR CRM
// ----------------------------------------------------------------------------
// Camada de execução técnica do Especialista CRM.
//
// Fluxo oficial:
//   IA Orquestradora → Motor de Coordenação → Especialista CRM →
//   Executor CRM → Banco de Dados → Executor CRM → Especialista CRM →
//   Motor de Coordenação → IA Orquestradora
//
// Responsabilidades desta camada:
//   - receber solicitação já normalizada pelo Especialista;
//   - validar parâmetros mínimos no nível técnico;
//   - acessar a tabela `contacts` via cliente Supabase (service role);
//   - executar a operação real (INSERT / SELECT);
//   - devolver { ok, entity_id, data, error, correlation_id };
//   - NUNCA conversar diretamente com o usuário.
//
// Operações implementadas nesta etapa:
//   - criar
//   - consultar
//   - listar
// ============================================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

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
}

function getSupabase(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados");
  }
  return createClient(url, key);
}

function wrap<T extends ExecutorResult>(r: T, ctx?: ExecutorContext): T {
  if (ctx?.correlation_id) r.correlation_id = ctx.correlation_id;
  return r;
}

// ---------------------------------------------------------------------------
// criar
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
  if (!input?.name || !String(input.name).trim()) {
    return wrap({ ok: false, error: "Parâmetro obrigatório ausente: name." }, ctx);
  }
  try {
    const supabase = getSupabase();
    const payload: Record<string, unknown> = {
      name: String(input.name).trim(),
      type: "cliente",
      person_type: "fisica",
      funnel_status: "novo_lead",
      temperatura_lead: "morno",
      origem_lead: input.origem_lead ?? "IA Orquestradora",
      is_active: true,
    };
    if (input.whatsapp) payload.whatsapp = input.whatsapp;
    if (input.email) payload.email = input.email;
    if (input.notes) payload.notes = input.notes;

    const { data, error } = await supabase
      .from("contacts")
      .insert(payload)
      .select("id, name, whatsapp, email")
      .single();

    if (error) {
      return wrap({ ok: false, error: `Falha técnica ao inserir contato: ${error.message}`, details: error }, ctx);
    }
    return wrap({
      ok: true,
      entity_id: data.id,
      data: { id: data.id, name: data.name, whatsapp: data.whatsapp ?? null, email: data.email ?? null },
    }, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return wrap({ ok: false, error: message }, ctx);
  }
}

// ---------------------------------------------------------------------------
// consultar
// ---------------------------------------------------------------------------
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
  const { id, phone_digits, email, name } = input ?? {};
  if (!id && !phone_digits && !email && !name) {
    return wrap({ ok: false, error: "Informe id, phone_digits, email ou name para consultar." }, ctx);
  }
  try {
    const supabase = getSupabase();
    let query = supabase
      .from("contacts")
      .select(
        "id,name,email,phone,whatsapp,funnel_status,client_classification,lifetime_value,city,state,ultimo_contato,notes",
      )
      .eq("is_active", true)
      .limit(1);

    if (id) query = query.eq("id", id);
    else if (phone_digits) query = query.or(`whatsapp.eq.${phone_digits},phone.eq.${phone_digits},mobile.eq.${phone_digits}`);
    else if (email) query = query.ilike("email", email);
    else if (name) query = query.ilike("name", `%${name}%`);

    const { data, error } = await query.maybeSingle();
    if (error) return wrap({ ok: false, error: `Falha técnica ao consultar contato: ${error.message}` }, ctx);
    if (!data) return wrap({ ok: false, error: "Contato não encontrado." }, ctx);
    return wrap({ ok: true, entity_id: data.id, data }, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return wrap({ ok: false, error: message }, ctx);
  }
}

// ---------------------------------------------------------------------------
// listar
// ---------------------------------------------------------------------------
export interface ExecListContactsInput {
  search?: string | null;
  funnel_status?: string | null;
  limit?: number;
}

export async function execCrmListContacts(
  input: ExecListContactsInput,
  ctx?: ExecutorContext,
): Promise<ExecutorResult> {
  try {
    const supabase = getSupabase();
    const limit = Math.max(1, Math.min(Number(input?.limit) || 25, 100));
    let query = supabase
      .from("contacts")
      .select(
        "id,name,email,phone,whatsapp,funnel_status,client_classification,lifetime_value,ultimo_contato",
      )
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (input?.funnel_status) query = query.eq("funnel_status", String(input.funnel_status));
    if (input?.search) {
      const s = `%${String(input.search)}%`;
      query = query.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s},whatsapp.ilike.${s}`);
    }

    const { data, error } = await query;
    if (error) return wrap({ ok: false, error: `Falha técnica ao listar contatos: ${error.message}` }, ctx);
    return wrap({ ok: true, data: { count: data?.length ?? 0, items: data ?? [] } }, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return wrap({ ok: false, error: message }, ctx);
  }
}
