// ============================================================================
// AUTO-REGISTRO DO ESPECIALISTA ROTINAS — FASE 04.2.2
// ----------------------------------------------------------------------------
// Conecta exclusivamente as entidades Nivel 1 de Rotinas a Camada Universal.
// Nao ha executor, resolvedor, confirmacao ou contexto proprios neste modulo.
// ============================================================================

import { registerLevel1Entity } from "../universal/level1.ts";
import { SpecialistRegistry } from "../specialist-registry.ts";
import { rotinaApplyMt, rotinaComplete, rotinaDiagnosticar, rotinaOrientar, rotinaPause, rotinaPlanejar, rotinaResumir, rotinaSkip, rotinaStart, rotinaUseTemplate } from "./rotinas.ts";

// Campos JSON permanecem atomicos: nao ha edicao conversacional granular.
registerLevel1Entity({
  specialist: "rotina",
  entity: "bloco_rotina",
  table: "routine_blocks",
  primaryField: "title",
  requiredFields: ["title", "date", "planned_start", "duration_minutes", "focus"],
  searchableFields: ["title", "notes"],
  editableFields: [
    "title", "date", "planned_start", "planned_end", "duration_minutes",
    "focus", "notes", "checklist", "assigned_user_id", "node_id", "task_id", "template_id",
  ],
  activeField: "is_active",
  softDelete: true,
  createDefaults: { is_active: true, status: "pendente", block_type: "foco" },
});

// Operações específicas ficam fora do registro Level 1 e reutilizam o
// resolvedor universal dentro do Especialista de Rotinas.
SpecialistRegistry.register({ module_id: "rotina", entity_id: "bloco_rotina", operation: "iniciar", handler: rotinaStart });
SpecialistRegistry.register({ module_id: "rotina", entity_id: "bloco_rotina", operation: "pausar", handler: rotinaPause });
SpecialistRegistry.register({ module_id: "rotina", entity_id: "bloco_rotina", operation: "concluir", handler: rotinaComplete });
SpecialistRegistry.register({ module_id: "rotina", entity_id: "bloco_rotina", operation: "pular", handler: rotinaSkip });
SpecialistRegistry.register({ module_id: "rotina", entity_id: "bloco_rotina", operation: "orientar", handler: rotinaOrientar });
SpecialistRegistry.register({ module_id: "rotina", entity_id: "bloco_rotina", operation: "resumir", handler: rotinaResumir });
SpecialistRegistry.register({ module_id: "rotina", entity_id: "bloco_rotina", operation: "diagnosticar", handler: rotinaDiagnosticar });
SpecialistRegistry.register({ module_id: "rotina", entity_id: "bloco_rotina", operation: "planejar", handler: rotinaPlanejar });
SpecialistRegistry.register({ module_id: "rotina", entity_id: "metodo_trabalho", operation: "aplicar", handler: rotinaApplyMt });
SpecialistRegistry.register({ module_id: "rotina", entity_id: "template_rotina", operation: "usar", handler: rotinaUseTemplate });

// O schema publicado exige area e name. blocks e priority_modules ficam fora.
registerLevel1Entity({
  specialist: "rotina",
  entity: "metodo_trabalho",
  table: "routine_mts",
  primaryField: "name",
  requiredFields: ["area", "name"],
  searchableFields: ["name"],
  editableFields: ["area", "name", "description", "target_role", "icon", "color", "is_default", "order_index"],
  activeField: "is_active",
  softDelete: true,
  createDefaults: { is_active: true },
});

// title e o unico campo obrigatorio; os demais valores possuem defaults reais.
registerLevel1Entity({
  specialist: "rotina",
  entity: "template_rotina",
  table: "routine_templates",
  primaryField: "title",
  requiredFields: ["title"],
  searchableFields: ["title"],
  editableFields: ["title", "block_type", "duration_minutes", "node_id", "start_time", "order_index", "focus"],
  activeField: "is_active",
  softDelete: true,
  createDefaults: { is_active: true },
});
