// ============================================================================
// Handlers reais do módulo Assistente IA / IA Orquestradora
// ----------------------------------------------------------------------------
// Conecta capacidades do Catálogo Universal a operações reais no banco.
// Todas as capacidades destrutivas exigem `payload.confirm === true`.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import {
  registerActionHandler,
  type ActionHandler,
} from "../action-executor.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function requireConfirm(request: Parameters<ActionHandler>[0]) {
  const confirm = Boolean((request.payload as Record<string, unknown> | undefined)?.confirm);
  if (!confirm) {
    throw new Error(
      "confirmation_required: esta ação é destrutiva. Reenvie com payload.confirm = true após o usuário autorizar.",
    );
  }
}

// -------- consultar chat_assistente --------------------------------------
const listChats: ActionHandler = async (req) => {
  const limit = Number((req.payload as Record<string, unknown> | undefined)?.limit ?? 50);
  const { data, error } = await sb()
    .from("ai_chat_messages")
    .select("id, role, content, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return { message: `Encontradas ${data?.length ?? 0} mensagens no histórico.`, data };
};

// -------- consultar decisao_assistente -----------------------------------
const listDecisions: ActionHandler = async (req) => {
  const status = (req.payload as Record<string, unknown> | undefined)?.status as string | undefined;
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

// -------- excluir decisao_assistente -------------------------------------
const deleteDecision: ActionHandler = async (req) => {
  const id = (req.payload as Record<string, unknown> | undefined)?.id as string | undefined;
  if (!id) throw new Error("invalid_payload: informe payload.id da decisão a excluir.");
  requireConfirm(req);
  const { error, count } = await sb()
    .from("ai_insights")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (!count) throw new Error(`decisão ${id} não encontrada.`);
  return { message: `Decisão ${id} excluída.`, data: { id, deleted: count } };
};

// -------- excluir todas_decisoes_assistente ------------------------------
const deleteAllDecisions: ActionHandler = async (req) => {
  requireConfirm(req);
  const { error, count } = await sb()
    .from("ai_insights")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (error) throw new Error(error.message);
  return { message: `${count ?? 0} decisões excluídas.`, data: { deleted: count ?? 0 } };
};

// -------- consultar politica_assistente ----------------------------------
const listPolicies: ActionHandler = async () => {
  const { data, error } = await sb()
    .from("ai_policies")
    .select("id, area, autopilot, max_risk, updated_at")
    .order("area", { ascending: true });
  if (error) throw new Error(error.message);
  return { message: `Encontradas ${data?.length ?? 0} políticas.`, data };
};

// -------- consultar log_assistente ---------------------------------------
const listLogs: ActionHandler = async (req) => {
  const limit = Number((req.payload as Record<string, unknown> | undefined)?.limit ?? 100);
  const { data, error } = await sb()
    .from("ai_actions")
    .select("id, insight_id, action_type, status, result, created_at, executed_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return { message: `Encontrados ${data?.length ?? 0} logs de execução.`, data };
};

// -------- excluir todos_logs_assistente ----------------------------------
const clearLogs: ActionHandler = async (req) => {
  requireConfirm(req);
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
  registerActionHandler("consultar", "chat_assistente", listChats);
  registerActionHandler("consultar", "decisao_assistente", listDecisions);
  registerActionHandler("excluir",   "decisao_assistente", deleteDecision);
  registerActionHandler("excluir",   "todas_decisoes_assistente", deleteAllDecisions);
  registerActionHandler("consultar", "politica_assistente", listPolicies);
  registerActionHandler("consultar", "log_assistente", listLogs);
  registerActionHandler("excluir",   "todos_logs_assistente", clearLogs);
  _registered = true;
}
