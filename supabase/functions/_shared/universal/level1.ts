// ============================================================================
// CAMADA UNIVERSAL — NÍVEL 1 POR ENTIDADE
// ----------------------------------------------------------------------------
// Fábrica reutilizável de operações Nível 1 (criar, listar, consultar,
// pesquisar, editar, excluir) para qualquer entidade de qualquer Especialista.
//
// Modelo de referência (homologado): CRM / Contato.
//
// Fluxo respeitado (não altera arquitetura):
//   IA Orquestradora → Motor de Coordenação → Registro Universal →
//   Especialista (gerado por config) → Executor Base → Supabase
//
// Uso mínimo — em <modulo>.register.ts:
//
//   registerLevel1Entity({
//     specialist: "financeiro",
//     entity:     "categoria",
//     table:      "financial_categories",
//     primaryField:     "name",
//     requiredFields:   ["name"],
//     searchableFields: ["name"],
//     editableFields:   ["name", "type", "color"],
//     activeField:      "is_active", // opcional (arquivamento lógico)
//     softDelete:       true,        // opcional
//   });
//
// Isso cria e registra automaticamente as 6 capacidades Nível 1 no
// SpecialistRegistry, sem criar código por operação.
// ============================================================================

import {
  runBaseExecution,
  type BaseExecutionResult,
  type BaseOperationDefinition,
} from "../executors/base.ts";
import { SpecialistRegistry } from "../specialist-registry.ts";

// ---------- Configuração de entidade --------------------------------------

export interface Level1EntityConfig {
  /** Módulo/Especialista (ex.: "crm", "financeiro"). */
  specialist: string;
  /** Entidade lógica (ex.: "contato", "categoria"). */
  entity: string;
  /** Tabela no banco. */
  table: string;
  /** Campo principal exibido para o usuário (ex.: "name"). */
  primaryField: string;
  /** Campos obrigatórios para criar. */
  requiredFields: string[];
  /** Campos usados no `search` OR. */
  searchableFields: string[];
  /** Campos permitidos em `editar` e `criar`. */
  editableFields: string[];
  /** Campo de status/arquivamento (ex.: "is_active"). Opcional. */
  activeField?: string;
  /** Se true e activeField existir, `excluir` faz update do activeField=false. */
  softDelete?: boolean;
  /** Colunas retornadas em `consultar`. Default: "*". */
  selectColumns?: string;
  /** Colunas retornadas em `listar`. Default: `selectColumns` ou "*". */
  listColumns?: string;
  /** Defaults aplicados no `criar`. */
  createDefaults?: Record<string, unknown>;
  /** Limite máximo em `listar`. Default 100. */
  maxListLimit?: number;
}

// ---------- Utilidades -----------------------------------------------------

function pick(
  src: Record<string, unknown>,
  allowed: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    const v = src[k];
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
}

// ============================================================================
// FLUXO UNIVERSAL DE RESOLUÇÃO DE ALVO (Target Resolution)
// ----------------------------------------------------------------------------
// Primitiva única e obrigatória para toda operação Nível 1 que precise
// localizar UM registro antes de agir (consultar, editar, excluir e futuras
// operações semelhantes).
//
// Regras invioláveis:
//   1. Se NÃO encontrar → responde "none".
//   2. Se encontrar EXATAMENTE UM → define o alvo e devolve o registro.
//   3. Se encontrar MAIS DE UM → devolve lista resumida numerada.
//      - Nenhuma operação é executada.
//      - Nenhuma confirmação é solicitada.
//      - Somente após o usuário escolher (nova chamada com id) o fluxo segue.
//   4. Ambiguidade NUNCA é resolvida via confirmação.
//   5. Especialistas NÃO podem implementar sua própria lógica de resolução.
//
// Logs técnicos ficam apenas no console; a resposta ao usuário é formatada
// pela camada de apresentação a partir do payload padronizado retornado.
// ============================================================================

/**
 * Estados universais e ÚNICOS de qualquer operação Nível 1 que dependa
 * de localizar/confirmar um registro. Nenhum Especialista pode inventar
 * status próprios — toda a semântica passa por este enum.
 */
export const TargetStatus = {
  FOUND: "FOUND",
  NOT_FOUND: "NOT_FOUND",
  AMBIGUOUS: "AMBIGUOUS",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  CANCELLED: "CANCELLED",
  ERROR: "ERROR",
} as const;
export type TargetStatus = (typeof TargetStatus)[keyof typeof TargetStatus];

export type TargetResolution =
  | { status: "FOUND"; kind: "found"; targetId: string; row: any }
  | { status: "AMBIGUOUS"; kind: "ambiguous"; rows: any[] }
  | { status: "NOT_FOUND"; kind: "none" }
  | { status: "ERROR"; kind: "error"; error: string };

/** Campos incluídos no resumo de candidatos (não vaza JSON técnico ao usuário). */
const SUMMARY_HINT_FIELDS = [
  "name", "nome", "title",
  "phone", "telefone", "mobile", "whatsapp",
  "email",
  "city", "cidade", "state", "uf",
  "company", "empresa", "organization",
];

function summarizeRow(row: any, cfg: Level1EntityConfig): Record<string, unknown> {
  const summary: Record<string, unknown> = { id: row?.id };
  if (row && cfg.primaryField && row[cfg.primaryField] !== undefined) {
    summary[cfg.primaryField] = row[cfg.primaryField];
  }
  for (const f of SUMMARY_HINT_FIELDS) {
    if (row && row[f] !== undefined && row[f] !== null && row[f] !== "") {
      summary[f] = row[f];
    }
  }
  return summary;
}

/** Payload padronizado quando há ambiguidade — apenas dados de apresentação. */
function ambiguousResult(cfg: Level1EntityConfig, rows: any[], action: string) {
  const options = rows.map((r) => summarizeRow(r, cfg));
  return {
    ok: true as const,
    status: "ok" as const,
    message: `Encontrados ${rows.length} ${cfg.entity}s parecidos. Escolha um antes de ${action}.`,
    data: {
      ambiguous: true,
      specialist: cfg.specialist,
      entity: cfg.entity,
      match_count: rows.length,
      options,
    },
  };
}


/**
 * Fluxo Universal de Resolução de Alvo (Target Resolution).
 *
 * ÚNICA forma permitida de resolver um registro dentro das operações
 * Nível 1 de qualquer Especialista. Nenhum Especialista pode implementar
 * lógica própria de pesquisa/desambiguação/escolha.
 *
 * Retorna sempre um dos estados universais: FOUND | NOT_FOUND | AMBIGUOUS | ERROR.
 * (CONFIRMATION_REQUIRED e CANCELLED são estados operacionais posteriores,
 * emitidos pelas operações que dependem de confirmação — ex.: excluir.)
 */
export async function resolveEntityTarget(
  cfg: Level1EntityConfig,
  supabase: any,
  locator: Record<string, unknown>,
): Promise<TargetResolution> {
  try {
    const id = locator?.id as string | undefined;
    const selectCols = cfg.selectColumns ?? "*";

    if (id) {
      let q = supabase.from(cfg.table).select(selectCols).eq("id", id);
      if (cfg.activeField) q = q.eq(cfg.activeField, true);
      const { data, error } = await q.maybeSingle();
      if (error) {
        console.error("[TargetResolution] erro por id", { entity: cfg.entity, error });
        return { status: "ERROR", kind: "error", error: error.message };
      }
      if (!data) return { status: "NOT_FOUND", kind: "none" };
      return { status: "FOUND", kind: "found", targetId: data.id, row: data };
    }

    let query = supabase.from(cfg.table).select(selectCols).limit(10);
    if (cfg.activeField) query = query.eq(cfg.activeField, true);

    let applied = false;
    for (const field of cfg.searchableFields) {
      const v = locator?.[field];
      if (v === undefined || v === null || v === "") continue;
      query = query.ilike(field, `%${String(v)}%`);
      applied = true;
      break;
    }
    if (!applied) return { status: "NOT_FOUND", kind: "none" };

    const { data, error } = await query;
    if (error) {
      console.error("[TargetResolution] erro na busca", { entity: cfg.entity, error });
      return { status: "ERROR", kind: "error", error: error.message };
    }
    const rows = data ?? [];
    if (rows.length === 0) return { status: "NOT_FOUND", kind: "none" };
    if (rows.length === 1) return { status: "FOUND", kind: "found", targetId: rows[0].id, row: rows[0] };
    console.info("[TargetResolution] ambiguidade", { entity: cfg.entity, count: rows.length });
    return { status: "AMBIGUOUS", kind: "ambiguous", rows };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[TargetResolution] exceção", { entity: cfg.entity, msg });
    return { status: "ERROR", kind: "error", error: msg };
  }
}

/** Alias legado — mantém compatibilidade com chamadas antigas. */
export const resolveTarget = resolveEntityTarget;

/**
 * Traduz o resultado do Target Resolution para a resposta padrão do Base.
 * Devolve `null` apenas quando o alvo foi único (FOUND) e o chamador deve prosseguir.
 */
function targetToResult(
  res: TargetResolution,
  cfg: Level1EntityConfig,
  action: string,
): Partial<import("../executors/base.ts").BaseExecutionResult> | null {
  if (res.status === "ERROR")     return { status: "error", ok: false, error: `Falha: ${res.error}` };
  if (res.status === "NOT_FOUND") return { status: "not_found", ok: false, error: `${cfg.entity} não encontrado(a) para ${action}.` };
  if (res.status === "AMBIGUOUS") return ambiguousResult(cfg, res.rows, action);
  return null;
}

// ---------- Fábrica das operações -----------------------------------------

export function buildLevel1Operations(
  cfg: Level1EntityConfig,
): Record<string, BaseOperationDefinition> {
  const selectCols = cfg.selectColumns ?? "*";
  const listCols = cfg.listColumns ?? selectCols;

  return {
    // ---------------- CRIAR ---------------------------------------------
    criar: {
      requiredParams: cfg.requiredFields,
      handler: async (params, ctx) => {
        const payload = {
          ...(cfg.createDefaults ?? {}),
          ...pick(params, cfg.editableFields),
        };
        // Garante campos obrigatórios explicitamente
        for (const k of cfg.requiredFields) {
          if (payload[k] === undefined) payload[k] = params[k];
        }
        if (cfg.activeField && payload[cfg.activeField] === undefined) {
          payload[cfg.activeField] = true;
        }

        const { data, error } = await ctx.supabase
          .from(cfg.table)
          .insert(payload)
          .select(selectCols)
          .single();

        if (error) {
          return {
            status: "error",
            ok: false,
            error: `Falha ao criar ${cfg.entity}: ${error.message}`,
            details: error,
          };
        }
        return {
          ok: true,
          message: `${cfg.entity} "${data[cfg.primaryField]}" criado(a) com sucesso.`,
          entity_id: data.id,
          data,
        };
      },
    },

    // ---------------- LISTAR --------------------------------------------
    listar: {
      handler: async (params, ctx) => {
        const max = cfg.maxListLimit ?? 100;
        const limit = Math.max(1, Math.min(Number(params.limit) || 25, max));

        let query = ctx.supabase.from(cfg.table).select(listCols).limit(limit);
        if (cfg.activeField) query = query.eq(cfg.activeField, true);

        const search = params.search ? String(params.search).trim() : "";
        if (search) {
          const s = `%${search}%`;
          const orParts = cfg.searchableFields.map((f) => `${f}.ilike.${s}`).join(",");
          if (orParts) query = query.or(orParts);
        }

        // Filtros exatos (qualquer campo editável/pesquisável passado no params)
        const filterables = new Set([...cfg.editableFields, ...cfg.searchableFields]);
        for (const k of Object.keys(params)) {
          if (k === "search" || k === "limit") continue;
          if (!filterables.has(k)) continue;
          const v = params[k];
          if (v === undefined || v === null || v === "") continue;
          query = query.eq(k, v as any);
        }

        const { data, error } = await query;
        if (error) return { status: "error", ok: false, error: `Falha: ${error.message}` };
        return { ok: true, data: { count: data?.length ?? 0, items: data ?? [] } };
      },
    },

    // ---------------- CONSULTAR -----------------------------------------
    consultar: {
      handler: async (params, ctx) => {
        const locator = (params.locator ?? params) as Record<string, unknown>;
        const res = await resolveTarget(cfg, ctx.supabase, locator);
        const early = targetToResult(res, cfg, "consultar");
        if (early) return early;
        const found = res as Extract<TargetResolution, { kind: "found" }>;
        return { ok: true, entity_id: found.targetId, data: found.row };
      },
    },


    // ---------------- PESQUISAR (filtrada, distinta de listar) ----------
    pesquisar: {
      handler: async (params, ctx) => {
        const locator = (params.locator ?? params) as Record<string, unknown>;

        // Consolida qualquer critério informado em um único termo de busca
        // e/ou filtros exatos por campos pesquisáveis.
        const term =
          (params.search as string) ||
          (params.query as string) ||
          (params.q as string) ||
          (locator.search as string) ||
          "";

        const max = cfg.maxListLimit ?? 100;
        const limit = Math.max(1, Math.min(Number(params.limit) || 25, max));

        let query = ctx.supabase.from(cfg.table).select(listCols).limit(limit);
        if (cfg.activeField) query = query.eq(cfg.activeField, true);

        let hasCriteria = false;

        if (term && term.trim()) {
          const s = `%${term.trim()}%`;
          const orParts = cfg.searchableFields.map((f) => `${f}.ilike.${s}`).join(",");
          if (orParts) {
            query = query.or(orParts);
            hasCriteria = true;
          }
        }

        for (const field of cfg.searchableFields) {
          const v = locator[field] ?? (params as any)[field];
          if (v === undefined || v === null || v === "") continue;
          query = query.ilike(field, `%${String(v)}%`);
          hasCriteria = true;
        }

        if (!hasCriteria) {
          return {
            status: "validation_error",
            ok: false,
            error: `Informe ao menos um critério de pesquisa (${cfg.searchableFields.join(", ")}).`,
          };
        }

        const { data, error } = await query;
        if (error) return { status: "error", ok: false, error: `Falha: ${error.message}` };
        const rows = data ?? [];
        return {
          ok: true,
          message: rows.length === 0
            ? `Nenhum ${cfg.entity} encontrado.`
            : `${rows.length} ${cfg.entity}(s) encontrado(s).`,
          data: { count: rows.length, items: rows },
        };
      },
    },

    // ---------------- EDITAR --------------------------------------------
    editar: {
      handler: async (params, ctx) => {
        const locator = (params.locator ?? {}) as Record<string, unknown>;
        const updatesRaw = (params.updates ?? {}) as Record<string, unknown>;
        const updates = pick(updatesRaw, cfg.editableFields);

        if (Object.keys(updates).length === 0) {
          return {
            status: "validation_error",
            ok: false,
            error: `Nenhum campo válido para atualizar (permitidos: ${cfg.editableFields.join(", ")}).`,
          };
        }

        const res = await resolveTarget(cfg, ctx.supabase, locator);
        const early = targetToResult(res, cfg, "editar");
        if (early) return early;
        const found = res as Extract<TargetResolution, { kind: "found" }>;


        const patch: Record<string, unknown> = { ...updates };
        // updated_at é comum, mas só aplica se a tabela tiver a coluna;
        // deixamos a critério do Postgres (ignora se não existir? não — quebraria).
        // Preferimos NÃO setar updated_at aqui para manter genérico.

        const { data: updated, error: upErr } = await ctx.supabase
          .from(cfg.table)
          .update(patch)
          .eq("id", found.targetId)
          .select(selectCols)
          .maybeSingle();

        if (upErr) {
          return {
            status: "error",
            ok: false,
            error: `Falha ao atualizar ${cfg.entity}: ${upErr.message}`,
            details: upErr,
          };
        }
        return {
          ok: true,
          message: `${cfg.entity} "${updated?.[cfg.primaryField] ?? found.targetId}" atualizado(a) com sucesso.`,
          entity_id: found.targetId,
          data: { updated_fields: Object.keys(updates), record: updated },
        };
      },
    },

    // ---------------- EXCLUIR (com confirmação obrigatória) -------------
    // Regra invariante: ambiguidade NUNCA gera confirmação — o Target
    // Resolution devolve a lista de candidatos e a operação é abortada.
    excluir: {
      handler: async (params, ctx) => {
        const locator = (params.locator ?? params) as Record<string, unknown>;
        const confirm = params.confirm === true || params.confirmar === true;

        const res = await resolveTarget(cfg, ctx.supabase, locator);
        const early = targetToResult(res, cfg, "excluir");
        if (early) return early; // none | ambiguous | error → nada a confirmar
        const found = res as Extract<TargetResolution, { kind: "found" }>;

        if (!confirm) {
          return {
            ok: true,
            status: "ok",
            message: `Confirmação necessária: excluir ${cfg.entity} "${found.row[cfg.primaryField]}"? Reenvie com "confirm: true".`,
            data: {
              confirmation_required: true,
              specialist: cfg.specialist,
              entity: cfg.entity,
              target: summarizeRow(found.row, cfg),
            },
          };
        }

        // Soft delete se configurado
        if (cfg.softDelete && cfg.activeField) {
          const { error } = await ctx.supabase
            .from(cfg.table)
            .update({ [cfg.activeField]: false })
            .eq("id", found.targetId);
          if (error) {
            return {
              status: "error",
              ok: false,
              error: `Falha ao arquivar ${cfg.entity}: ${error.message}`,
              details: error,
            };
          }
          return {
            ok: true,
            message: `${cfg.entity} "${found.row[cfg.primaryField]}" arquivado(a) com sucesso.`,
            entity_id: found.targetId,
            data: { id: found.targetId, archived: true },
          };
        }

        // Hard delete
        const { error: delErr } = await ctx.supabase
          .from(cfg.table)
          .delete()
          .eq("id", found.targetId);
        if (delErr) {
          return {
            status: "error",
            ok: false,
            error: `Falha ao excluir ${cfg.entity}: ${delErr.message}. Pode haver vínculos impedindo a remoção.`,
            details: delErr,
          };
        }
        return {
          ok: true,
          message: `${cfg.entity} "${found.row[cfg.primaryField]}" excluído(a) com sucesso.`,
          entity_id: found.targetId,
          data: { id: found.targetId, deleted: true },
        };
      },
    },
  };
}


// ---------- Registro automático no SpecialistRegistry ---------------------

export const LEVEL1_OPERATIONS = [
  "criar",
  "listar",
  "consultar",
  "pesquisar",
  "editar",
  "excluir",
] as const;

export type Level1Operation = (typeof LEVEL1_OPERATIONS)[number];

/**
 * Registra as 6 operações Nível 1 para a entidade no Registro Universal.
 * Chame no arquivo <modulo>.register.ts do Especialista.
 *
 * `only` / `except` permitem sobrescrever operações que o Especialista
 * já implementa manualmente (ex.: CRM/Contato mantém suas versões próprias).
 */
export function registerLevel1Entity(
  cfg: Level1EntityConfig,
  opts?: { only?: Level1Operation[]; except?: Level1Operation[] },
): void {
  const ops = buildLevel1Operations(cfg);
  const allowed = new Set<string>(
    opts?.only ?? LEVEL1_OPERATIONS.filter((o) => !opts?.except?.includes(o)),
  );

  for (const [operation, def] of Object.entries(ops)) {
    if (!allowed.has(operation)) continue;
    SpecialistRegistry.register({
      module_id: cfg.specialist,
      entity_id: cfg.entity,
      operation,
      handler: async (params, ctx) => {
        const result = await runBaseExecution(
          {
            correlation_id: ctx?.correlation_id,
            requested_by: ctx?.requested_by,
            specialist: cfg.specialist,
            entity: cfg.entity,
            operation,
            params: (params ?? {}) as Record<string, unknown>,
          },
          { [operation]: def },
        );
        return toSpecialistResult(result);
      },
    });
  }
}

function toSpecialistResult(r: BaseExecutionResult) {
  return {
    ok: r.ok,
    entity_id: r.entity_id,
    data: r.data,
    error: r.ok ? undefined : (r.error ?? r.message),
    details: r.details,
    correlation_id: r.correlation_id,
  };
}
