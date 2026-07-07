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

// ---------------------------------------------------------------------------
// editar contato
// ---------------------------------------------------------------------------
export interface CrmEditContactParams {
  id?: string;
  contact_id?: string;
  whatsapp?: string;
  telefone?: string;
  phone?: string;
  email?: string;
  name?: string;
  nome?: string;
  updates?: Record<string, unknown>;
  // aceita também campos "flat" para edição
  novo_nome?: string;
  novo_email?: string;
  novo_whatsapp?: string;
  novo_telefone?: string;
  novas_observacoes?: string;
  [k: string]: unknown;
}

export async function crmEditContact(
  rawParams: CrmEditContactParams | undefined,
  ctx?: ExecutorContext,
): Promise<SpecialistResult> {
  const params = rawParams ?? {};

  // Suporte ao payload padrão { locator: {...}, updates: {...} }
  const locator = (params.locator ?? {}) as Record<string, unknown>;

  // Localização (aceita locator.* ou campos flat de compatibilidade)
  const id = (locator.id ?? locator.contact_id ?? params.id ?? params.contact_id) as
    | string
    | undefined;
  const phone_digits =
    normalizePhoneDigits(locator.whatsapp) ??
    normalizePhoneDigits(locator.telefone) ??
    normalizePhoneDigits(locator.phone) ??
    normalizePhoneDigits(params.whatsapp) ??
    normalizePhoneDigits(params.telefone) ??
    normalizePhoneDigits(params.phone);
  const email_lookup =
    (locator.email ? String(locator.email).trim() : null) ??
    (params.email ? String(params.email).trim() : null);
  const name_lookup =
    String(locator.name ?? locator.nome ?? params.name ?? params.nome ?? "").trim() || null;

  if (!id && !phone_digits && !email_lookup && !name_lookup) {
    return {
      ok: false,
      error: "Informe id, whatsapp, email ou nome para localizar o contato a editar.",
      correlation_id: ctx?.correlation_id,
    };
  }


  // Atualizações — aceita bloco `updates` ou campos "novo_*"
  const src = (params.updates ?? {}) as Record<string, unknown>;
  const updates: Record<string, string> = {};

  const takeStr = (v: unknown) =>
    v === undefined || v === null ? undefined : String(v).trim();

  const newName = takeStr(src.name ?? src.nome ?? params.novo_nome);
  const newEmail = takeStr(src.email ?? params.novo_email);
  const newWhats = takeStr(src.whatsapp ?? params.novo_whatsapp);
  const newPhone = takeStr(src.phone ?? src.telefone ?? params.novo_telefone);
  const newNotes = takeStr(src.notes ?? src.observacoes ?? params.novas_observacoes);

  if (newName) updates.name = newName;
  if (newEmail) updates.email = newEmail;
  if (newWhats) updates.whatsapp = normalizePhoneDigits(newWhats) ?? newWhats;
  if (newPhone) updates.phone = normalizePhoneDigits(newPhone) ?? newPhone;
  if (newNotes !== undefined && newNotes !== "") updates.notes = newNotes;

  if (Object.keys(updates).length === 0) {
    return {
      ok: false,
      error: "Nenhum campo informado para atualização (permitidos: nome, telefone, whatsapp, email, observações).",
      correlation_id: ctx?.correlation_id,
    };
  }

  return execCrmEditContact(
    { id, phone_digits, email_lookup, name_lookup, updates },
    ctx,
  );
}
