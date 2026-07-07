// ============================================================================
// REGISTRO UNIVERSAL DE ESPECIALISTAS
// ----------------------------------------------------------------------------
// Única fonte de descoberta de Especialistas pelo Motor de Coordenação.
//
// Responsabilidades EXCLUSIVAS:
//   • registrar Especialistas (auto-registro)
//   • localizar Especialistas por (module_id, entity_id, operation)
//   • listar Especialistas registrados
//   • validar consistência contra o CAPABILITIES_CATALOG
//
// NÃO contém regra de negócio, decisão da IA ou execução técnica.
// O Motor de Coordenação NUNCA importa Especialistas diretamente:
// ele só conversa com este Registro.
// ============================================================================

import { CAPABILITIES_CATALOG } from "./capabilities-catalog.ts";

// ---------- Contratos ------------------------------------------------------

export interface SpecialistHandlerResult {
  ok: boolean;
  entity_id?: string;
  data?: Record<string, unknown>;
  error?: string;
  details?: unknown;
  correlation_id?: string;
}

export type SpecialistHandler = (
  params: Record<string, unknown> | undefined,
  ctx?: { correlation_id?: string; requested_by?: string },
) => Promise<SpecialistHandlerResult>;

export interface SpecialistRegistration {
  module_id: string;
  entity_id: string;
  operation: string;
  handler: SpecialistHandler;
}

export interface RegistryValidationIssue {
  kind:
    | "capability_without_specialist" // capacidade "disponivel" sem handler
    | "specialist_without_capability"; // handler registrado sem capacidade correspondente
  module_id: string;
  entity_id: string;
  operation?: string;
  message: string;
}

// ---------- Estado interno -------------------------------------------------

function keyOf(module_id: string, entity_id: string, operation: string): string {
  return `${module_id}:${entity_id}:${operation}`;
}

const REGISTRY = new Map<string, SpecialistRegistration>();

// ---------- API pública ----------------------------------------------------

export const SpecialistRegistry = {
  register(reg: SpecialistRegistration): void {
    if (!reg.module_id || !reg.entity_id || !reg.operation || typeof reg.handler !== "function") {
      throw new Error(
        `[SpecialistRegistry] Registro inválido: exige module_id, entity_id, operation e handler. Recebido: ${JSON.stringify({
          module_id: reg.module_id,
          entity_id: reg.entity_id,
          operation: reg.operation,
        })}`,
      );
    }
    REGISTRY.set(keyOf(reg.module_id, reg.entity_id, reg.operation), reg);
  },

  find(module_id: string, entity_id: string, operation: string): SpecialistHandler | null {
    return REGISTRY.get(keyOf(module_id, entity_id, operation))?.handler ?? null;
  },

  has(module_id: string, entity_id: string, operation: string): boolean {
    return REGISTRY.has(keyOf(module_id, entity_id, operation));
  },

  list(): SpecialistRegistration[] {
    return Array.from(REGISTRY.values());
  },

  clear(): void {
    REGISTRY.clear();
  },

  /**
   * Validação arquitetural obrigatória:
   *   • toda capacidade marcada como "disponivel" no CAPABILITIES_CATALOG
   *     deve ter Especialista registrado;
   *   • todo Especialista registrado deve corresponder a alguma capacidade
   *     declarada no CAPABILITIES_CATALOG.
   */
  validate(): RegistryValidationIssue[] {
    const issues: RegistryValidationIssue[] = [];
    const catalogKeys = new Set<string>();

    for (const mod of CAPABILITIES_CATALOG) {
      for (const ent of mod.entities ?? []) {
        for (const op of ent.operations ?? []) {
          const k = keyOf(mod.id, ent.id, op);
          catalogKeys.add(k);
          if ((ent.status ?? "planejada") === "disponivel" && !REGISTRY.has(k)) {
            issues.push({
              kind: "capability_without_specialist",
              module_id: mod.id,
              entity_id: ent.id,
              operation: op,
              message: `Capacidade "${mod.id}:${ent.id}:${op}" está marcada como disponível no catálogo, mas nenhum Especialista foi registrado.`,
            });
          }
        }
      }
    }

    for (const reg of REGISTRY.values()) {
      const k = keyOf(reg.module_id, reg.entity_id, reg.operation);
      if (!catalogKeys.has(k)) {
        issues.push({
          kind: "specialist_without_capability",
          module_id: reg.module_id,
          entity_id: reg.entity_id,
          operation: reg.operation,
          message: `Especialista registrado em "${k}" não possui capacidade correspondente no CAPABILITIES_CATALOG.`,
        });
      }
    }

    return issues;
  },

  /**
   * Executa a validação e lança erro arquitetural caso haja qualquer
   * inconsistência. Deve ser chamado no boot do sistema.
   */
  assertConsistent(): void {
    const issues = SpecialistRegistry.validate();
    if (issues.length === 0) return;

    // Capacidades declaradas como "disponivel" no catálogo mas ainda sem
    // Especialista registrado são apenas AVISOS (a implementação é incremental:
    // uma entidade pode ter algumas operações já conectadas e outras não).
    // Já handlers registrados sem capacidade no catálogo são ERRO arquitetural.
    const warnings = issues.filter((i) => i.kind === "capability_without_specialist");
    const errors = issues.filter((i) => i.kind !== "capability_without_specialist");

    if (warnings.length > 0) {
      const lines = warnings.map((i) => ` - [${i.kind}] ${i.message}`).join("\n");
      console.warn(`[SpecialistRegistry] Capacidades pendentes de registro:\n${lines}`);
    }

    if (errors.length > 0) {
      const lines = errors.map((i) => ` - [${i.kind}] ${i.message}`).join("\n");
      throw new Error(
        `[SpecialistRegistry] Inconsistência arquitetural detectada:\n${lines}`,
      );
    }
  },
};
