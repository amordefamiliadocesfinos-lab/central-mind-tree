// ============================================================================
// AUTO-REGISTRO DO ESPECIALISTA ORGANIZAÇÃO
// ----------------------------------------------------------------------------
// Camada Universal Nível 1 aplicada à árvore organizacional (nodes).
// Nenhuma lógica local — toda pesquisa/desambiguação/confirmação é da Camada
// Universal. Arquivamento lógico via is_active.
// ============================================================================

import { registerLevel1Entity } from "../universal/level1.ts";

registerLevel1Entity({
  specialist: "organizacao",
  entity: "no_organizacional",
  table: "nodes",
  primaryField: "title",
  requiredFields: ["title", "parent_id", "node_type"],
  searchableFields: ["title"],
  editableFields: ["title", "node_type", "responsible_user_id", "parent_id", "color"],
  activeField: "is_active",
  softDelete: true,
});
