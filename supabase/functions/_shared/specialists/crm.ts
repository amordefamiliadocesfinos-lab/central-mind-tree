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
