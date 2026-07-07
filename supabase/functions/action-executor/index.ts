// ============================================================================
// Endpoint HTTP do Executor Universal de Ações
// ----------------------------------------------------------------------------
// Fluxo único para toda ação da IA Orquestradora.
//
// POST /execute   -> executa uma ActionRequest (body JSON)
// GET  /snapshot  -> retorna o estado do executor (módulos + capacidades +
//                    disponibilidade real em runtime)
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  executeAction,
  snapshotExecutor,
  type ActionRequest,
} from "../_shared/action-executor.ts";
import { registerAssistenteHandlers } from "../_shared/handlers/assistente.ts";

// Registra handlers reais no boot da função (idempotente).
registerAssistenteHandlers();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/action-executor/, "") || "/";

  try {
    if (req.method === "GET" && path === "/snapshot") {
      return json({ ok: true, snapshot: snapshotExecutor() });
    }

    if (req.method === "POST" && (path === "/" || path === "/execute")) {
      let body: ActionRequest;
      try {
        body = (await req.json()) as ActionRequest;
      } catch {
        return json({ ok: false, error: "invalid_json" }, { status: 400 });
      }

      if (!body || typeof body.verb !== "string" || typeof body.entity !== "string") {
        return json(
          { ok: false, error: "invalid_request", detail: "Campos obrigatórios: verb, entity." },
          { status: 400 },
        );
      }

      const result = await executeAction(body);
      // Todos os casos retornam 200 com status semântico no corpo — o Executor
      // fala uma única linguagem estruturada para a IA, mesmo quando a
      // capacidade não está disponível ou o handler falha.
      return json({ ok: result.status === "ok" || result.status === "dry_run", result });
    }

    return json({ ok: false, error: "not_found", path }, { status: 404 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  }
});
