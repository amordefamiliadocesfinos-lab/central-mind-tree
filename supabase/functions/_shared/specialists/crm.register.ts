// ============================================================================
// AUTO-REGISTRO DO ESPECIALISTA CRM
// ----------------------------------------------------------------------------
// Este arquivo é o único ponto que conecta o Especialista CRM ao Registro
// Universal de Especialistas. O Motor de Coordenação NUNCA importa este
// arquivo nem o Especialista diretamente; a conexão é feita pelo bootstrap
// de Especialistas.
// ============================================================================

import { SpecialistRegistry } from "../specialist-registry.ts";
import { crmCreateContact, crmEditContact, crmGetContact, crmListContacts } from "./crm.ts";

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
