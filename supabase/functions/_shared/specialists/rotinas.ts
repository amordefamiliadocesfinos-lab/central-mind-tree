// Operações específicas do Especialista de Rotinas — FASE 04.2.3.
// Reutiliza o resolvedor universal e o Executor Base; não cria fluxo paralelo.
import { runBaseExecution } from "../executors/base.ts";
import { resolveEntityTarget, type Level1EntityConfig } from "../universal/level1.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

type Params = Record<string, unknown>;
type Ctx = { correlation_id?: string; requested_by?: string };

export async function rotinaOrientar(_raw: Params | undefined, callCtx?: Ctx) {
  const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return { ok: false, error: "Contexto de leitura de Rotinas indisponível." };
  const supabase = createClient(url, key);
  const date = new Date().toISOString().slice(0, 10);
  let query = supabase.from("routine_blocks").select("id,title,status,date,planned_start,created_at,duration_minutes,focus")
    .eq("is_active", true).eq("date", date).in("status", ["andamento", "pausado", "pendente"]);
  // O usuário vem exclusivamente do contexto autenticado; texto conversacional não o substitui.
  query = callCtx?.requested_by ? query.eq("assigned_user_id", callCtx.requested_by) : query.is("assigned_user_id", null);
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  const blocks = (data ?? []).sort((a: any, b: any) => String(a.planned_start ?? "").localeCompare(String(b.planned_start ?? "")) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || String(a.id).localeCompare(String(b.id)));
  const pick = (status: string) => blocks.filter((b: any) => b.status === status);
  const active = pick("andamento"); const paused = pick("pausado");
  const now = new Date().toTimeString().slice(0, 5);
  const pending = pick("pendente"); const overdue = pending.filter((b: any) => b.planned_start && b.planned_start <= now);
  const candidates = active.length ? active : paused.length ? paused : overdue.length ? overdue : pending;
  if (!candidates.length) return { ok: true, data: { guidance: { kind: "nenhum", message: "Não há blocos ativos, pendentes ou pausados para hoje." } } };
  const chosen = candidates[0]; const suggestion = chosen.status === "andamento" ? "concluir ou pausar" : chosen.status === "pausado" ? "continuar (usar iniciar)" : "iniciar";
  return { ok: true, entity_id: chosen.id, data: { guidance: { kind: chosen.status, suggestion, block: chosen, alternatives: candidates.slice(0, 3) } } };
}

// Visão operacional: consulta isolada do usuário autenticado, sem executor e sem escrita.
// Concluídos são lidos independentemente de is_active porque concluir não altera esse campo.
export async function rotinaResumir(raw: Params | undefined, callCtx?: Ctx) {
  if (!callCtx?.requested_by) {
    return { ok: false, error: "Contexto autenticado indisponível para resumir as rotinas." };
  }

  const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return { ok: false, error: "Contexto de leitura de Rotinas indisponível." };

  const requestedDate = typeof raw?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
    ? raw.date
    : new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("routine_blocks")
    .select("id,title,status,date,planned_start,created_at,is_active")
    .eq("date", requestedDate)
    .eq("assigned_user_id", callCtx.requested_by)
    .in("status", ["andamento", "pausado", "pendente", "concluido"]);
  if (error) return { ok: false, error: error.message };

  const rows = data ?? [];
  const activeRows = rows.filter((block: any) => block.is_active === true);
  const byStatus = (status: string) => activeRows.filter((block: any) => block.status === status);
  const pending = byStatus("pendente").sort((a: any, b: any) =>
    String(a.planned_start ?? "").localeCompare(String(b.planned_start ?? "")) ||
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
    String(a.id).localeCompare(String(b.id)));
  const overdue = pending.filter((block: any) => block.planned_start && block.planned_start <= now);
  const next = pending[0] ?? null;
  // A conclusão vigente preserva is_active=true; o filtro abaixo também cobre históricos concluídos arquivados.
  const completed = rows.filter((block: any) => block.status === "concluido");

  if (!byStatus("andamento").length && !byStatus("pausado").length && !pending.length && !completed.length) {
    return { ok: true, data: { summary: { kind: "nenhum", message: "Não há blocos relevantes nas suas rotinas para esta data." } } };
  }

  return {
    ok: true,
    data: {
      summary: {
        kind: "resumo",
        date: requestedDate,
        ongoing_count: byStatus("andamento").length,
        paused_count: byStatus("pausado").length,
        overdue_count: overdue.length,
        completed_count: completed.length,
        next_pending: next ? { id: next.id, title: next.title, planned_start: next.planned_start } : null,
      },
    },
  };
}

// Diagnóstico operacional somente-leitura. O limiar de quatro pausados é local,
// conservador e não representa uma regra persistente ou definitiva do sistema.
export async function rotinaDiagnosticar(raw: Params | undefined, callCtx?: Ctx) {
  if (!callCtx?.requested_by) {
    return { ok: false, error: "Contexto autenticado indisponível para diagnosticar as rotinas." };
  }

  const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return { ok: false, error: "Contexto de leitura de Rotinas indisponível." };

  const requestedDate = typeof raw?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
    ? raw.date
    : new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("routine_blocks")
    .select("id,title,status,date,planned_start,created_at,is_active")
    .eq("date", requestedDate)
    .eq("assigned_user_id", callCtx.requested_by)
    .in("status", ["andamento", "pausado", "pendente", "concluido", "pulado"]);
  if (error) return { ok: false, error: error.message };

  const rows = data ?? [];
  const activeRows = rows.filter((block: any) => block.is_active === true);
  const byStatus = (status: string) => activeRows.filter((block: any) => block.status === status);
  const ongoing = byStatus("andamento");
  const paused = byStatus("pausado");
  const pending = byStatus("pendente");
  const overdue = pending.filter((block: any) => block.planned_start && block.planned_start <= now);
  const completed = rows.filter((block: any) => block.status === "concluido");
  const skipped = byStatus("pulado");
  const duplicatedTimes = new Map<string, any[]>();
  for (const block of activeRows) {
    if (!block.planned_start) continue;
    const group = duplicatedTimes.get(block.planned_start) ?? [];
    group.push(block);
    duplicatedTimes.set(block.planned_start, group);
  }
  const conflicts = [...duplicatedTimes.entries()].filter(([, blocks]) => blocks.length >= 2);
  const alerts: Array<{ kind: string; message: string; suggested_operation?: string }> = [];

  if (ongoing.length >= 2) alerts.push({
    kind: "multiple_ongoing",
    message: `Há ${ongoing.length} blocos em andamento; conclua ou pause um deles para evitar execução concorrente.`,
    suggested_operation: "pausar",
  });
  if (overdue.length) alerts.push({
    kind: "overdue",
    message: `Há ${overdue.length} bloco${overdue.length === 1 ? "" : "s"} pendente${overdue.length === 1 ? "" : "s"} com horário vencido; escolha o próximo passo com calma.`,
    suggested_operation: "iniciar",
  });
  if (paused.length >= 4) alerts.push({
    kind: "many_paused",
    message: `Há ${paused.length} blocos pausados; vale escolher um para continuar.`,
    suggested_operation: "iniciar",
  });
  if (!rows.length) alerts.push({
    kind: "no_blocks",
    message: "Não há blocos planejados para esta data; você pode criar um bloco ou usar um Template.",
    suggested_operation: "usar",
  });
  if (!completed.length && overdue.length) alerts.push({
    kind: "none_completed",
    message: "Ainda não há blocos concluídos apesar de horários vencidos; revise o que já foi realmente finalizado.",
    suggested_operation: "concluir",
  });
  if (skipped.length) alerts.push({
    kind: "skipped",
    message: `Há ${skipped.length} bloco${skipped.length === 1 ? "" : "s"} pulado${skipped.length === 1 ? "" : "s"}; isso pode ser apenas um ponto de revisão do planejamento.`,
  });
  if (conflicts.length) alerts.push({
    kind: "time_conflicts",
    message: `Há ${conflicts.length} horário${conflicts.length === 1 ? "" : "s"} com blocos sobrepostos; revise o planejamento quando for oportuno.`,
    suggested_operation: "editar",
  });

  if (!alerts.length) {
    return { ok: true, data: { diagnosis: { kind: "normal", message: "Suas rotinas não apresentam problemas relevantes nesta data." } } };
  }
  return { ok: true, data: { diagnosis: { kind: "alerts", alerts: alerts.slice(0, 3) } } };
}

// Planejamento assistido somente-leitura: sugere uma sequência, sem executá-la.
export async function rotinaPlanejar(raw: Params | undefined, callCtx?: Ctx) {
  if (!callCtx?.requested_by) return { ok: false, error: "Contexto autenticado indisponível para planejar as rotinas." };
  const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return { ok: false, error: "Contexto de leitura de Rotinas indisponível." };

  const requestedDate = typeof raw?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
    ? raw.date
    : new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);
  const supabase = createClient(url, key);
  const { data, error } = await supabase.from("routine_blocks")
    .select("id,title,status,date,planned_start,created_at,is_active")
    .eq("date", requestedDate)
    .eq("assigned_user_id", callCtx.requested_by)
    .in("status", ["andamento", "pausado", "pendente", "concluido", "pulado"]);
  if (error) return { ok: false, error: error.message };

  const sortBlocks = (blocks: any[]) => [...blocks].sort((a, b) =>
    String(a.planned_start ?? "").localeCompare(String(b.planned_start ?? "")) ||
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
    String(a.id).localeCompare(String(b.id)));
  const rows = data ?? [];
  const activeRows = rows.filter((block: any) => block.is_active === true);
  const byStatus = (status: string) => sortBlocks(activeRows.filter((block: any) => block.status === status));
  const ongoing = byStatus("andamento");
  const paused = byStatus("pausado");
  const pending = byStatus("pendente");
  const overdue = pending.filter((block: any) => block.planned_start && block.planned_start <= now);
  const future = pending.filter((block: any) => !block.planned_start || block.planned_start > now);
  const skippedCount = byStatus("pulado").length;
  const steps: Array<{ id: string; title: string; operation: "iniciar" | "pausar" | "concluir"; label: string; reason: string }> = [];
  const chosen = new Set<string>();
  const add = (block: any, operation: "iniciar" | "pausar" | "concluir", label: string, reason: string) => {
    if (steps.length >= 5 || chosen.has(block.id)) return;
    chosen.add(block.id); steps.push({ id: block.id, title: block.title, operation, label, reason });
  };

  if (ongoing.length > 1) {
    // Mantém o primeiro como foco pela ordenação determinística e pausa os demais antes dele.
    for (const block of ongoing.slice(1, 5)) add(block, "pausar", "Pausar", "há mais de um bloco em andamento");
    add(ongoing[0], "concluir", "Concluir", "é o bloco em andamento mantido como foco");
  } else if (ongoing.length === 1) {
    add(ongoing[0], "concluir", "Concluir", "está em andamento");
  }
  for (const block of paused) add(block, "iniciar", "Continuar", "está pausado");
  for (const block of overdue) add(block, "iniciar", "Iniciar", "está com horário vencido");
  for (const block of future) add(block, "iniciar", "Iniciar", "é o próximo pendente no planejamento");

  if (!steps.length) return { ok: true, data: { plan: { kind: "none", message: "Não há ações disponíveis para montar o plano nesta data." } } };
  return { ok: true, data: { plan: { kind: "steps", steps, skipped_count: skippedCount } } };
}

const blockCfg: Level1EntityConfig = {
  specialist: "rotina", entity: "bloco_rotina", table: "routine_blocks", primaryField: "title",
  requiredFields: [], searchableFields: ["title", "notes"], editableFields: [], activeField: "is_active", ownerField: "assigned_user_id", softDelete: true,
};
const mtCfg: Level1EntityConfig = {
  specialist: "rotina", entity: "metodo_trabalho", table: "routine_mts", primaryField: "name",
  requiredFields: [], searchableFields: ["name"], editableFields: [], activeField: "is_active", softDelete: true,
};
const templateCfg: Level1EntityConfig = {
  specialist: "rotina", entity: "template_rotina", table: "routine_templates", primaryField: "title",
  requiredFields: [], searchableFields: ["title"], editableFields: [], activeField: "is_active", softDelete: true,
};

const locatorOf = (params: Params) => (params.locator && typeof params.locator === "object" ? params.locator : params) as Params;

function targetFailure(res: any, entity: string, action: string) {
  if (res.status === "AMBIGUOUS") return { ok: true, data: { ambiguous: true, options: res.rows.map((r: any) => ({ id: r.id, title: r.title, name: r.name })) } };
  if (res.status === "NOT_FOUND") return { ok: false, error: `${entity} não encontrado para ${action}.` };
  return res.status === "ERROR" ? { ok: false, error: res.error } : null;
}

async function execute(operation: string, params: Params | undefined, ctx: Ctx | undefined, handler: any) {
  const result = await runBaseExecution({ correlation_id: ctx?.correlation_id, requested_by: ctx?.requested_by, specialist: "rotina", entity: "rotina", operation, params }, { [operation]: { handler } });
  return { ok: result.ok, entity_id: result.entity_id, data: result.data, error: result.error, correlation_id: result.correlation_id };
}

async function resolve(cfg: Level1EntityConfig, params: Params, ctx: any, action: string) {
  const resolution = await resolveEntityTarget(cfg, ctx.supabase, locatorOf(params), ctx.requested_by);
  const failed = targetFailure(resolution, cfg.entity, action);
  return failed ? { failed } : { row: (resolution as any).row };
}

export async function rotinaStart(raw: Params | undefined, callCtx?: Ctx) {
  return execute("iniciar", raw, callCtx, async (params: Params, ctx: any) => {
    const r = await resolve(blockCfg, params, ctx, "iniciar"); if (r.failed) return r.failed;
    const block = r.row;
    if (!["pendente", "pausado"].includes(block.status)) return { ok: false, error: "Somente bloco pendente ou pausado pode ser iniciado." };
    const now = new Date().toISOString();
    const { data, error } = await ctx.supabase.from("routine_blocks").update({ status: "andamento", actual_start: block.actual_start || now }).eq("id", block.id).in("status", ["pendente", "pausado"]).select("*").single();
    if (error) return { ok: false, error: error.message };
    const { data: timer } = await ctx.supabase.from("timer_state").select("id, remaining_seconds, status").limit(1).maybeSingle();
    if (timer) await ctx.supabase.from("timer_state").update({ status: "running", remaining_seconds: timer.status === "paused" ? timer.remaining_seconds : block.duration_minutes * 60, last_update: now }).eq("id", timer.id);
    return { ok: true, entity_id: block.id, data: { record: data } };
  });
}

export async function rotinaPause(raw: Params | undefined, callCtx?: Ctx) {
  return execute("pausar", raw, callCtx, async (params: Params, ctx: any) => {
    const r = await resolve(blockCfg, params, ctx, "pausar"); if (r.failed) return r.failed;
    const block = r.row;
    if (block.status !== "andamento") return { ok: false, error: "Somente bloco em andamento pode ser pausado." };
    const now = new Date();
    const { data: timer } = await ctx.supabase.from("timer_state").select("id, remaining_seconds, last_update").eq("status", "running").limit(1).maybeSingle();
    const elapsed = timer ? Math.max(0, Math.floor((now.getTime() - new Date(timer.last_update).getTime()) / 1000)) : 0;
    const { data, error } = await ctx.supabase.from("routine_blocks").update({ status: "pausado" }).eq("id", block.id).eq("status", "andamento").select("*").single();
    if (error) return { ok: false, error: error.message };
    if (timer) await ctx.supabase.from("timer_state").update({ status: "paused", remaining_seconds: Math.max(0, timer.remaining_seconds - elapsed), last_update: now.toISOString() }).eq("id", timer.id);
    return { ok: true, entity_id: block.id, data: { record: data } };
  });
}

export async function rotinaComplete(raw: Params | undefined, callCtx?: Ctx) {
  return execute("concluir", raw, callCtx, async (params: Params, ctx: any) => {
    const r = await resolve(blockCfg, params, ctx, "concluir"); if (r.failed) return r.failed;
    const block = r.row;
    if (["concluido", "pulado"].includes(block.status)) return { ok: false, error: "Bloco já está finalizado." };
    const now = new Date().toISOString();
    const { data, error } = await ctx.supabase.from("routine_blocks").update({ status: "concluido", actual_end: now }).eq("id", block.id).neq("status", "concluido").select("*").single();
    if (error) return { ok: false, error: error.message };
    const { data: stats } = await ctx.supabase.from("routine_stats").select("*").eq("date", block.date).maybeSingle();
    const deep = block.focus === "trabalho_profundo" ? block.duration_minutes : 0;
    const atendimento = block.focus === "atendimento" ? block.duration_minutes : 0;
    if (stats) await ctx.supabase.from("routine_stats").update({ done_min: stats.done_min + block.duration_minutes, deep_work_min: stats.deep_work_min + deep, atendimento_min: stats.atendimento_min + atendimento }).eq("id", stats.id);
    else await ctx.supabase.from("routine_stats").insert({ date: block.date, planned_min: block.duration_minutes, done_min: block.duration_minutes, deep_work_min: deep, atendimento_min: atendimento, context_switches: 0 });
    await ctx.supabase.from("timer_state").update({ status: "stopped", remaining_seconds: 0, last_update: now }).eq("status", "running");
    if (block.recurrence) {
      const base = new Date(`${block.date}T${block.planned_start || "08:00"}`); const next = new Date(base);
      if (block.recurrence === "daily") next.setDate(next.getDate() + 1); else if (block.recurrence === "weekly") next.setDate(next.getDate() + 7); else if (block.recurrence === "monthly") next.setMonth(next.getMonth() + 1); else next.setTime(next.getTime() + Number(String(block.recurrence).replace("h", "")) * 3600000);
      const nextDate = next.toISOString().slice(0, 10); const nextTime = next.toTimeString().slice(0, 5);
      await ctx.supabase.from("routine_blocks").upsert({ date: nextDate, planned_start: nextTime, title: block.title, block_type: block.block_type, focus: block.focus, duration_minutes: block.duration_minutes, node_id: block.node_id, task_id: block.task_id, template_id: block.template_id, notes: block.notes, recurrence: block.recurrence, recurrence_parent_id: block.recurrence_parent_id || block.id, assigned_user_id: block.assigned_user_id, status: "pendente" }, { onConflict: "recurrence_parent_id,date,planned_start", ignoreDuplicates: true });
    }
    return { ok: true, entity_id: block.id, data: { record: data } };
  });
}

export async function rotinaSkip(raw: Params | undefined, callCtx?: Ctx) {
  return execute("pular", raw, callCtx, async (params: Params, ctx: any) => {
    const r = await resolve(blockCfg, params, ctx, "pular"); if (r.failed) return r.failed;
    const block = r.row;
    if (!["pendente", "pausado", "andamento"].includes(block.status)) return { ok: false, error: "Bloco não pode ser pulado." };
    const { data, error } = await ctx.supabase.from("routine_blocks").update({ status: "pulado" }).eq("id", block.id).select("*").single();
    if (error) return { ok: false, error: error.message };
    if (block.status === "andamento") await ctx.supabase.from("timer_state").update({ status: "stopped", remaining_seconds: 0, last_update: new Date().toISOString() }).eq("status", "running");
    return { ok: true, entity_id: block.id, data: { record: data } };
  });
}

export async function rotinaUseTemplate(raw: Params | undefined, callCtx?: Ctx) {
  return execute("usar", raw, callCtx, async (params: Params, ctx: any) => {
    if (!params.date) return { ok: false, error: "Informe a data para usar o template." };
    const r = await resolve(templateCfg, params, ctx, "usar"); if (r.failed) return r.failed;
    const t = r.row;
    const { data, error } = await ctx.supabase.from("routine_blocks").insert({ date: String(params.date), title: t.title, block_type: t.block_type, focus: t.focus, duration_minutes: t.duration_minutes, planned_start: t.start_time, node_id: t.node_id, template_id: t.id, status: "pendente", assigned_user_id: params.assigned_user_id ?? null }).select("*").single();
    return error ? { ok: false, error: error.message } : { ok: true, entity_id: data.id, data: { record: data } };
  });
}

export async function rotinaApplyMt(raw: Params | undefined, callCtx?: Ctx) {
  return execute("aplicar", raw, callCtx, async (params: Params, ctx: any) => {
    if (!params.date) return { ok: false, error: "Informe a data para aplicar o Método de Trabalho." };
    const r = await resolve(mtCfg, params, ctx, "aplicar"); if (r.failed) return r.failed;
    const mt = r.row;
    if (!params.confirm) return { ok: true, data: { confirmation_required: true, target: { id: mt.id, name: mt.name } } };
    const date = String(params.date);
    const assignedUserId = typeof params.assigned_user_id === "string" ? params.assigned_user_id : null;
    const instanceId = `mt:${mt.id}:${date}:${assignedUserId ?? "sem-usuario"}`;
    const blocks = Array.isArray(mt.blocks) ? mt.blocks : [];
    if (!blocks.length) return { ok: false, error: "Este Método de Trabalho não possui blocos válidos." };

    // Arquiva somente o planejamento automático pendente da mesma data/usuário.
    // Não toca blocos manuais, externos/legados, concluídos ou já arquivados.
    let archive = ctx.supabase.from("routine_blocks")
      .update({ is_active: false })
      .eq("date", date)
      .eq("status", "pendente")
      .eq("is_active", true)
      .eq("generated_by_type", "mt");
    archive = assignedUserId ? archive.eq("assigned_user_id", assignedUserId) : archive.is("assigned_user_id", null);
    const { error: archiveError } = await archive;
    if (archiveError) return { ok: false, error: archiveError.message };

    const rows = blocks.map((b: any) => ({
      date,
      title: b.title,
      block_type: b.block_type || "foco",
      focus: b.focus || "trabalho_profundo",
      duration_minutes: b.duration_minutes,
      planned_start: b.start,
      planned_end: b.end,
      notes: b.notes ? `${b.notes}\nMT: ${mt.name}` : `MT: ${mt.name}`,
      checklist: b.checklist || [],
      status: "pendente",
      assigned_user_id: assignedUserId,
      generated_by_type: "mt",
      generated_by_id: mt.id,
      generated_instance_id: instanceId,
    }));
    const { data, error } = await ctx.supabase.from("routine_blocks").insert(rows).select("id");
    if (error) return { ok: false, error: error.message };
    if (!data || data.length !== rows.length) return { ok: false, error: "Persistência incompleta dos blocos do Método de Trabalho." };
    return { ok: true, entity_id: mt.id, data: { record: { id: mt.id, name: mt.name }, created_ids: data.map((b: any) => b.id), generated_instance_id: instanceId } };
  });
}
