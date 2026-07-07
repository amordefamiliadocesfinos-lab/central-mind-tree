// ============================================================================
// Handlers reais do módulo Assistente IA / IA Orquestradora
// ----------------------------------------------------------------------------
// Conecta (módulo=assistente, entidade, operação) a operações reais no banco.
// A confirmação de operações destrutivas é feita pelo Executor Universal.
// O escopo ("all" | "one") define entre operação em massa e alvo único.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import {
  registerActionHandler,
  type ActionHandler,
  type HandlerContext,
} from "../action-executor.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function payload(ctx: HandlerContext): Record<string, unknown> {
  return (ctx.request.payload as Record<string, unknown> | undefined) ?? {};
}

// -------- assistente / chat / listar --------------------------------------
const listChats: ActionHandler = async (ctx) => {
  const limit = Number(payload(ctx).limit ?? 50);
  const { data, error } = await sb()
    .from("ai_chat_messages")
    .select("id, role, content, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return { message: `Encontradas ${data?.length ?? 0} mensagens no histórico.`, data };
};

// -------- assistente / decisao / listar -----------------------------------
const listDecisions: ActionHandler = async (ctx) => {
  const status = payload(ctx).status as string | undefined;
  let q = sb()
    .from("ai_insights")
    .select("id, area, title, severity, confidence, impact, risk, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { message: `Encontradas ${data?.length ?? 0} decisões.`, data };
};

// -------- assistente / decisao / excluir ----------------------------------
// Escopo "all" → apaga todas; caso contrário exige payload.id.
const deleteDecision: ActionHandler = async (ctx) => {
  const scope = ctx.scope;
  if (scope === "all") {
    const { error, count } = await sb()
      .from("ai_insights")
      .delete({ count: "exact" })
      .not("id", "is", null);
    if (error) throw new Error(error.message);
    return { message: `${count ?? 0} decisões excluídas.`, data: { deleted: count ?? 0, scope: "all" } };
  }
  const id = payload(ctx).id as string | undefined;
  if (!id) throw new Error("invalid_payload: informe payload.id da decisão a excluir ou scope='all'.");
  const { error, count } = await sb()
    .from("ai_insights")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (!count) throw new Error(`decisão ${id} não encontrada.`);
  return { message: `Decisão ${id} excluída.`, data: { id, deleted: count } };
};

// -------- assistente / politica / listar ----------------------------------
const listPolicies: ActionHandler = async () => {
  const { data, error } = await sb()
    .from("ai_policies")
    .select("id, area, autopilot, max_risk, updated_at")
    .order("area", { ascending: true });
  if (error) throw new Error(error.message);
  return { message: `Encontradas ${data?.length ?? 0} políticas.`, data };
};

// -------- assistente / log / listar ---------------------------------------
const listLogs: ActionHandler = async (ctx) => {
  const limit = Number(payload(ctx).limit ?? 100);
  const { data, error } = await sb()
    .from("ai_actions")
    .select("id, insight_id, action_type, status, result, created_at, executed_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return { message: `Encontrados ${data?.length ?? 0} logs de execução.`, data };
};

// -------- assistente / log / limpar ---------------------------------------
const clearLogs: ActionHandler = async () => {
  const { error, count } = await sb()
    .from("ai_actions")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (error) throw new Error(error.message);
  return { message: `${count ?? 0} logs de execução removidos.`, data: { deleted: count ?? 0 } };
};

// -------- Registro --------------------------------------------------------
let _registered = false;
export function registerAssistenteHandlers() {
  if (_registered) return;
  // Chat
  registerActionHandler("assistente", "chat",     "listar",    listChats);
  registerActionHandler("assistente", "chat",     "consultar", listChats);
  // Decisão
  registerActionHandler("assistente", "decisao",  "listar",    listDecisions);
  registerActionHandler("assistente", "decisao",  "consultar", listDecisions);
  registerActionHandler("assistente", "decisao",  "excluir",   deleteDecision);
  // Política
  registerActionHandler("assistente", "politica", "listar",    listPolicies);
  registerActionHandler("assistente", "politica", "consultar", listPolicies);
  // Log
  registerActionHandler("assistente", "log",      "listar",    listLogs);
  registerActionHandler("assistente", "log",      "consultar", listLogs);
  registerActionHandler("assistente", "log",      "limpar",    clearLogs);
  _registered = true;
}
