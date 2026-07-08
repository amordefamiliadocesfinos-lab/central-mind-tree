// ============================================================================
// BOOTSTRAP DE ESPECIALISTAS
// ----------------------------------------------------------------------------
// Importa todos os módulos de auto-registro de Especialistas. Cada novo
// Especialista deve criar seu próprio "<modulo>.register.ts" e adicioná-lo
// a esta lista. O Motor de Coordenação NÃO precisa ser alterado.
// ============================================================================

import "./crm.register.ts";

// Futuros Especialistas — podem usar a Camada Universal Nível 1
// (../universal/level1.ts) para receber criar/listar/consultar/pesquisar/
// editar/excluir automaticamente via `registerLevel1Entity({...})`, sem
// implementar operação por operação. Exemplo:
//
//   import { registerLevel1Entity } from "../universal/level1.ts";
//   registerLevel1Entity({
//     specialist: "financeiro",
//     entity: "categoria",
//     table: "financial_categories",
//     primaryField: "name",
//     requiredFields: ["name"],
//     searchableFields: ["name"],
//     editableFields: ["name", "type", "color"],
//     activeField: "is_active",
//     softDelete: true,
//   });
//
// import "./financeiro.register.ts";
// import "./producao.register.ts";
// import "./digital.register.ts";
// import "./rotina.register.ts";
// import "./agenda.register.ts";
// import "./estoque.register.ts";
