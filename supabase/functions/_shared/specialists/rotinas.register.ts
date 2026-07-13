// ============================================================================
// AUTO-REGISTRO DO ESPECIALISTA ROTINAS
// ----------------------------------------------------------------------------
// Camada Universal Nível 1 aplicada a Blocos de Rotina, Métodos de Trabalho
// e Templates de Rotina. Arquivamento lógico via is_active.
// ============================================================================

import { registerLevel1Entity } from "../universal/level1.ts";

registerLevel1Entity({
  specialist: "rotina",
  entity: "bloco_rotina",
  table: "routine_blocks",
  primaryField: "title",
  requiredFields: ["title", "date", "planned_start", "duration_minutes", "focus"],
  searchableFields: ["title", "notes"],
  editableFields: [
    "title",
    "date",
    "planned_start",
    "planned_end",
    "duration_minutes",
    "focus",
    "notes",
    "checklist",
    "assigned_user_id",
    "node_id",
    "task_id",
    "template_id",
  ],
  activeField: "is_active",
  softDelete: true,
  createDefaults: { is_active: true, status: "pendente", block_type: "foco" },
});

registerLevel1Entity({
  specialist: "rotina",
  entity: "metodo_trabalho",
  table: "routine_mts",
  primaryField: "name",
  requiredFields: ["area", "name"],
  searchableFields: ["name"],
  editableFields: [
    "area",
    "name",
    "description",
    "target_role",
    "icon",
    "color",
    "is_default",
    "order_index",
  ],
  activeField: "is_active",
  softDelete: true,
  createDefaults: { is_active: true },
});

registerLevel1Entity({
  specialist: "rotina",
  entity: "template_rotina",
  table: "routine_templates",
  primaryField: "title",
  requiredFields: ["title"],
  searchableFields: ["title"],
  editableFields: [
    "title",
    "block_type",
    "duration_minutes",
    "node_id",
    "start_time",
    "order_index",
    "focus",
  ],
  activeField: "is_active",
  softDelete: true,
  createDefaults: { is_active: true },
});
