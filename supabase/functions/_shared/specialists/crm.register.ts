// ============================================================================
// AUTO-REGISTRO DO ESPECIALISTA CRM
// ----------------------------------------------------------------------------
// Este arquivo é o único ponto que conecta o Especialista CRM ao Registro
// Universal de Especialistas. O Motor de Coordenação NUNCA importa este
// arquivo nem o Especialista diretamente; a conexão é feita pelo bootstrap
// de Especialistas.
// ============================================================================

import { SpecialistRegistry } from "../specialist-registry.ts";
import { registerLevel1Entity } from "../universal/level1.ts";
import { crmCreateContact, crmDeleteContact, crmEditContact, crmGetContact, crmListContacts } from "./crm.ts";

// ---------------------------------------------------------------------------
// Entidade LEAD — usa a tabela `contacts` (leads são contatos com
// funnel_status ativo no pipeline comercial). Registrada via Camada
// Universal Nível 1 — sem CRUD manual.
// ---------------------------------------------------------------------------
registerLevel1Entity({
  specialist: "crm",
  entity: "lead",
  table: "contacts",
  primaryField: "name",
  requiredFields: ["name"],
  searchableFields: ["name", "email", "phone", "whatsapp", "mobile"],
  editableFields: [
    "name",
    "email",
    "phone",
    "whatsapp",
    "mobile",
    "notes",
    "funnel_status",
    "lead_temperature",
    "lead_source",
    "client_classification",
    "city",
    "state",
  ],
  activeField: "is_active",
  softDelete: true,
  createDefaults: { funnel_status: "novo_lead" },
});

SpecialistRegistry.register({
  module_id: "crm",
  entity_id: "contato",
  operation: "criar",
  handler: (params, ctx) => crmCreateContact(params as any, ctx),
});

SpecialistRegistry.register({
  module_id: "crm",
  entity_id: "contato",
  operation: "consultar",
  handler: (params, ctx) => crmGetContact(params as any, ctx),
});

SpecialistRegistry.register({
  module_id: "crm",
  entity_id: "contato",
  operation: "listar",
  handler: (params, ctx) => crmListContacts(params as any, ctx),
});

SpecialistRegistry.register({
  module_id: "crm",
  entity_id: "contato",
  operation: "editar",
  handler: (params, ctx) => crmEditContact(params as any, ctx),
});

SpecialistRegistry.register({
  module_id: "crm",
  entity_id: "contato",
  operation: "excluir",
  handler: (params, ctx) => crmDeleteContact(params as any, ctx),
});
