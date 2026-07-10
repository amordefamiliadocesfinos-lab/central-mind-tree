// ============================================================================
// AUTO-REGISTRO DO ESPECIALISTA CRM
// ----------------------------------------------------------------------------
// Este arquivo é o único ponto que conecta o Especialista CRM ao Registro
// Universal de Especialistas. O Motor de Coordenação NUNCA importa este
// arquivo nem o Especialista diretamente; a conexão é feita pelo bootstrap
// de Especialistas.
//
// FASE 03.1 — Toda pesquisa/desambiguação/escolha/confirmação/contexto
// pendente é responsabilidade EXCLUSIVA da Camada Universal Nível 1.
// Nenhum handler local deste módulo pode implementar essa lógica.
// ============================================================================

import { registerLevel1Entity } from "../universal/level1.ts";

// Configuração compartilhada — leads e contatos vivem na mesma tabela
// `contacts`. As diferenças ficam apenas nos defaults de criação e no
// rótulo da entidade exibido ao usuário. Toda a resolução de alvo,
// listagem, escolha e confirmação é da Camada Universal.
const CONTACTS_SHARED = {
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
  activeField: "is_active" as const,
  softDelete: true,
} as const;

// ---------------------------------------------------------------------------
// Entidade LEAD — homologada na Fase 03.
// ---------------------------------------------------------------------------
registerLevel1Entity({
  specialist: "crm",
  entity: "lead",
  ...CONTACTS_SHARED,
  createDefaults: {
    funnel_status: "novo_lead",
    type: "cliente",
    person_type: "fisica",
    is_active: true,
  },
});

// ---------------------------------------------------------------------------
// Entidade CONTATO — agora também gerenciada pela Camada Universal Nível 1.
// Removida toda a lógica local de pesquisa, edição, exclusão e confirmação.
// ---------------------------------------------------------------------------
registerLevel1Entity({
  specialist: "crm",
  entity: "contato",
  ...CONTACTS_SHARED,
  createDefaults: {
    type: "cliente",
    person_type: "fisica",
    funnel_status: "novo_lead",
    temperatura_lead: "morno",
    origem_lead: "IA Orquestradora",
    is_active: true,
  },
});
