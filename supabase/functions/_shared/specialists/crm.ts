// ============================================================================
// ESPECIALISTA CRM
// ----------------------------------------------------------------------------
// Camada de regra de negócio do módulo CRM. Recebe solicitações do Motor de
// Coordenação, valida/normaliza os parâmetros conforme as regras do domínio
// e delega a execução técnica ao Executor CRM.
//
// Fluxo oficial:
//   Motor de Coordenação → Especialista CRM → Executor CRM → Banco →
//   Executor CRM → Especialista CRM → Motor de Coordenação
//
// Operações ativas:
//   - criar
//   - consultar
//   - listar
// ============================================================================

import {
  execCrmCreateContact,
  execCrmEditContact,
  execCrmGetContact,
  execCrmListContacts,
  type ExecutorContext,
} from "../executors/crm.ts";

export interface SpecialistResult {
  ok: boolean;
  entity_id?: string;
  data?: Record<string, unknown>;
  error?: string;
  details?: unknown;
  correlation_id?: string;
}

function normalizePhoneDigits(v: unknown): string | null {
  if (!v) return null;
  const digits = String(v).replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

// ---------------------------------------------------------------------------
// criar contato
// ---------------------------------------------------------------------------
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

export async function crmCreateContact(
  rawParams: CrmCreateContactParams | undefined,
  ctx?: ExecutorContext,
): Promise<SpecialistResult> {
  const params = rawParams ?? {};

  const name = String(params.name ?? params.nome ?? "").trim();
  if (!name) {
    return {
      ok: false,
      error: "Nome do contato é obrigatório para criar o cadastro.",
      correlation_id: ctx?.correlation_id,
    };
  }

  const whatsapp =
    normalizePhoneDigits(params.whatsapp) ??
    normalizePhoneDigits(params.telefone) ??
    normalizePhoneDigits(params.phone) ??
    normalizePhoneDigits(params.mobile);

  const email = params.email ? String(params.email).trim() : null;
  const notes = (params.notes ?? params.observacoes) as string | undefined;
  const origem_lead = (params.origem_lead as string) ?? null;

  return execCrmCreateContact(
    { name, whatsapp, email, notes: notes ?? null, origem_lead },
    ctx,
  );
}

// ---------------------------------------------------------------------------
// consultar contato
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
  ctx?: ExecutorContext,
): Promise<SpecialistResult> {
  const params = rawParams ?? {};
  const id = (params.id ?? params.contact_id) as string | undefined;
  const phone_digits =
    normalizePhoneDigits(params.whatsapp) ??
    normalizePhoneDigits(params.telefone) ??
    normalizePhoneDigits(params.phone);
  const email = params.email ? String(params.email).trim() : null;
  const name = String(params.name ?? params.nome ?? "").trim() || null;

  if (!id && !phone_digits && !email && !name) {
    return {
      ok: false,
      error: "Informe id, whatsapp, email ou nome para consultar o contato.",
      correlation_id: ctx?.correlation_id,
    };
  }

  return execCrmGetContact({ id, phone_digits, email, name }, ctx);
}

// ---------------------------------------------------------------------------
// listar contatos
// ---------------------------------------------------------------------------
export interface CrmListContactsParams {
  search?: string;
  funnel_status?: string;
  limit?: number;
  [k: string]: unknown;
}

export async function crmListContacts(
  rawParams: CrmListContactsParams | undefined,
  ctx?: ExecutorContext,
): Promise<SpecialistResult> {
  const params = rawParams ?? {};
  return execCrmListContacts(
    {
      search: params.search ?? null,
      funnel_status: params.funnel_status ?? null,
      limit: params.limit,
    },
    ctx,
  );
}
