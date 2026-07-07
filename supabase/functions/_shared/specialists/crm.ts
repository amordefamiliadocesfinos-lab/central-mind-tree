// ============================================================================
// ESPECIALISTA CRM / Contatos
// ----------------------------------------------------------------------------
// Primeira implementação real de um Especialista conectado ao Motor de
// Coordenação. Nesta etapa, implementa somente:
//
//   Módulo:    CRM / Contatos
//   Entidade:  Contato
//   Operação:  criar
//
// Responsabilidades:
//   - validar dados mínimos (nome);
//   - normalizar telefone/WhatsApp;
//   - criar o contato real na tabela `contacts`;
//   - devolver { ok, contact_id, error } para o Motor de Coordenação.
// ============================================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

export interface CrmCreateContactParams {
  name?: string;
  nome?: string;
  whatsapp?: string;
  telefone?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  origem_lead?: string;
  notes?: string;
  observacoes?: string;
  [k: string]: unknown;
}

export interface SpecialistResult {
  ok: boolean;
  entity_id?: string;
  data?: Record<string, unknown>;
  error?: string;
  details?: unknown;
}

function normalizePhoneDigits(v: unknown): string | null {
  if (!v) return null;
  const digits = String(v).replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

function getSupabase(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados");
  }
  return createClient(url, key);
}

export async function crmCreateContact(
  rawParams: CrmCreateContactParams | undefined,
): Promise<SpecialistResult> {
  const params = rawParams ?? {};

  // 1. Validação mínima — nome é obrigatório
  const name = String(params.name ?? params.nome ?? "").trim();
  if (!name) {
    return {
      ok: false,
      error: "Nome do contato é obrigatório para criar o cadastro.",
    };
  }

  // 2. Normaliza WhatsApp / telefone (aceita vários apelidos vindos da IA)
  const whatsapp =
    normalizePhoneDigits(params.whatsapp) ??
    normalizePhoneDigits(params.telefone) ??
    normalizePhoneDigits(params.phone) ??
    normalizePhoneDigits(params.mobile);

  // 3. Insere no banco (mínimo viável, respeitando defaults do schema)
  try {
    const supabase = getSupabase();
    const payload: Record<string, unknown> = {
      name,
      type: "cliente",
      person_type: "fisica",
      funnel_status: "novo_lead",
      temperatura_lead: "morno",
      origem_lead: (params.origem_lead as string) ?? "IA Orquestradora",
      is_active: true,
    };
    if (whatsapp) payload.whatsapp = whatsapp;
    if (params.email) payload.email = String(params.email);
    const notes = (params.notes ?? params.observacoes) as string | undefined;
    if (notes) payload.notes = notes;

    const { data, error } = await supabase
      .from("contacts")
      .insert(payload)
      .select("id, name, whatsapp")
      .single();

    if (error) {
      return {
        ok: false,
        error: `Falha ao criar contato: ${error.message}`,
        details: error,
      };
    }

    return {
      ok: true,
      entity_id: data.id,
      data: {
        id: data.id,
        name: data.name,
        whatsapp: data.whatsapp ?? null,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Operação: consultar contato
// ---------------------------------------------------------------------------
export interface CrmGetContactParams {
  id?: string;
  contact_id?: string;
  whatsapp?: string;
  telefone?: string;
  phone?: string;
  email?: string;
  name?: string;
  nome?: string;
  [k: string]: unknown;
}

export async function crmGetContact(
  rawParams: CrmGetContactParams | undefined,
): Promise<SpecialistResult> {
  const params = rawParams ?? {};
  try {
    const supabase = getSupabase();
    const id = (params.id ?? params.contact_id) as string | undefined;
    const phone =
      normalizePhoneDigits(params.whatsapp) ??
      normalizePhoneDigits(params.telefone) ??
      normalizePhoneDigits(params.phone);
    const email = params.email ? String(params.email).trim() : null;
    const name = String(params.name ?? params.nome ?? "").trim();

    let query = supabase
      .from("contacts")
      .select(
        "id,name,email,phone,whatsapp,funnel_status,client_classification,lifetime_value,city,state,ultimo_contato,notes",
      )
      .eq("is_active", true)
      .limit(1);

    if (id) {
      query = query.eq("id", id);
    } else if (phone) {
      query = query.or(`whatsapp.eq.${phone},phone.eq.${phone},mobile.eq.${phone}`);
    } else if (email) {
      query = query.ilike("email", email);
    } else if (name) {
      query = query.ilike("name", `%${name}%`);
    } else {
      return { ok: false, error: "Informe id, whatsapp, email ou nome para consultar o contato." };
    }

    const { data, error } = await query.maybeSingle();
    if (error) return { ok: false, error: `Falha ao consultar contato: ${error.message}` };
    if (!data) return { ok: false, error: "Contato não encontrado." };

    return { ok: true, entity_id: data.id, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Operação: listar contatos
// ---------------------------------------------------------------------------
export interface CrmListContactsParams {
  search?: string;
  funnel_status?: string;
  limit?: number;
  [k: string]: unknown;
}

export async function crmListContacts(
  rawParams: CrmListContactsParams | undefined,
): Promise<SpecialistResult> {
  const params = rawParams ?? {};
  try {
    const supabase = getSupabase();
    const limit = Math.max(1, Math.min(Number(params.limit) || 25, 100));
    let query = supabase
      .from("contacts")
      .select(
        "id,name,email,phone,whatsapp,funnel_status,client_classification,lifetime_value,ultimo_contato",
      )
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (params.funnel_status) {
      query = query.eq("funnel_status", String(params.funnel_status));
    }
    if (params.search) {
      const s = `%${String(params.search)}%`;
      query = query.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s},whatsapp.ilike.${s}`);
    }

    const { data, error } = await query;
    if (error) return { ok: false, error: `Falha ao listar contatos: ${error.message}` };
    return {
      ok: true,
      data: { count: data?.length ?? 0, items: data ?? [] },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
