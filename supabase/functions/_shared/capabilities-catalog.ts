// ============================================================================
// CATÁLOGO UNIVERSAL DE CAPACIDADES DA IA ORQUESTRADORA
// ----------------------------------------------------------------------------
// Estrutura: MÓDULO → ENTIDADE → OPERAÇÕES PERMITIDAS.
//
// O catálogo NÃO registra comandos específicos ("excluir todas as decisões").
// Ele declara APENAS que cada entidade de um módulo aceita um conjunto de
// operações genéricas. O interpretador da IA transforma o pedido do usuário
// em (módulo, entidade, operação, escopo) e o Executor Universal despacha
// para o handler real.
//
// Para crescer o catálogo: adicione entidades/operações no módulo alvo ou
// registre um novo módulo. Nenhuma outra alteração é necessária.
// ============================================================================

export type Operation =
  | "criar"
  | "listar"
  | "consultar"{ id: "bloco_rotina", name: "Bloco de Rotina", operations: ["criar","listar","consultar","editar","excluir"], destructive: ["excluir"], status: "planejada" },
  | "pesquisar"
  | "editar"
  | "excluir"
  | "limpar"
  | "mover"
  | "gerar"
  | "publicar"
  | "aprovar"
  | "enviar"
  | "concluir"
  | "agendar"
  | "importar"
  | "exportar";

export type EntityStatus = "disponivel" | "planejada";

export interface EntityDef {
  /** Slug interno da entidade (ex.: "decisao", "tarefa"). */
  id: string;
  /** Nome apresentável (ex.: "Decisão"). */
  name: string;
  /** Operações genéricas suportadas pela entidade. */
  operations: Operation[];
  /** Subconjunto de operações destrutivas que exigem confirmação explícita. */
  destructive?: Operation[];
  /** Termos que o usuário costuma usar para se referir à entidade. */
  synonyms?: string[];
  /**
   * Status declarado no catálogo:
   *   - "disponivel": há intenção de ter execução real (handler pode estar
   *                   registrado no runtime).
   *   - "planejada":  entidade existe conceitualmente, sem executor conectado.
   * O runtime (handler registrado) tem prioridade sobre o valor declarado.
   */
  status?: EntityStatus;
}

export interface ModuleCapabilities {
  id: string;
  name: string;
  purpose: string;
  entities: EntityDef[];
}

// ---------------------------------------------------------------------------
// Aliases legados (verbo/entidade antigos → novo mapa)
// Preservam compatibilidade com chamadas anteriores ao refactor.
// ---------------------------------------------------------------------------

interface LegacyAlias {
  module: string;
  entity: string;
  operation?: Operation;    // sobrescreve o verbo, se necessário
  scope?: "all" | "one";
}

const LEGACY_ENTITY_ALIASES: Record<string, LegacyAlias> = {
  chat_assistente:            { module: "assistente", entity: "chat" },
  decisao_assistente:         { module: "assistente", entity: "decisao" },
  todas_decisoes_assistente:  { module: "assistente", entity: "decisao", scope: "all" },
  politica_assistente:        { module: "assistente", entity: "politica" },
  log_assistente:             { module: "assistente", entity: "log" },
  todos_logs_assistente:      { module: "assistente", entity: "log", operation: "limpar", scope: "all" },
};

const LEGACY_VERB_ALIASES: Record<string, Operation> = {
  // formas antigas do "verb" já batem com Operation, mas normalizamos aqui:
  ver: "consultar",
  buscar: "consultar",
  pesquisar: "pesquisar",
  procurar: "listar",
  filtrar: "listar",
  listar_tudo: "listar",
  atualizar: "editar",
  alterar: "editar",
  modificar: "editar",
  remover: "excluir",
  deletar: "excluir",
  apagar: "excluir",
};


// ---------------------------------------------------------------------------
// CATÁLOGO
// ---------------------------------------------------------------------------

export const CAPABILITIES_CATALOG: ModuleCapabilities[] = [
  {
    id: "crm",
    name: "CRM / Contatos",
    purpose: "Gestão de contatos, leads, funil, atividades e histórico de relacionamento.",
    entities: [
      { id: "contato", name: "Contato", operations: ["criar","listar","consultar","pesquisar","editar","excluir"], destructive: ["excluir"], synonyms: ["cliente"], status: "disponivel" },
      { id: "lead",    name: "Lead",    operations: ["criar","listar","consultar","pesquisar","editar","excluir"], destructive: ["excluir"], synonyms: ["prospect","oportunidade"], status: "disponivel" },
      { id: "funil",   name: "Funil",   operations: ["consultar","mover"], status: "planejada" },
      { id: "mensagem_whatsapp", name: "Mensagem WhatsApp", operations: ["gerar","enviar"], status: "planejada" },
    ],
  },
  {
    id: "financeiro",
    name: "Financeiro",
    purpose: "Contas, lançamentos a pagar/receber, movimentações, categorias e precificação.",
    entities: [
      { id: "lancamento_financeiro", name: "Lançamento Financeiro", operations: ["criar","listar","consultar","editar","excluir"], destructive: ["excluir"], synonyms: ["conta","lançamento"], status: "planejada" },
      { id: "pagamento",             name: "Pagamento",             operations: ["aprovar","consultar"], status: "planejada" },
    ],
  },
  {
    id: "operacoes",
    name: "Operações / Pedidos",
    purpose: "Ciclo de pedidos, itens, entregas e integração com produção.",
    entities: [
      { id: "pedido", name: "Pedido", operations: ["criar","listar","consultar","editar","excluir","aprovar"], destructive: ["excluir"], status: "planejada" },
    ],
  },
  {
    id: "producao",
    name: "Produção",
    purpose: "Ordens de produção, processos, apontamentos e fechamento.",
    entities: [
      { id: "ordem_producao", name: "Ordem de Produção", operations: ["criar","listar","consultar","editar","concluir"], synonyms: ["op"], status: "planejada" },
    ],
  },
  {
    id: "rotina",
    name: "Rotina",
    purpose: "Blocos de rotina, alertas, métodos de trabalho e execução diária.",
    entities: [
      { id: "bloco_rotina",    name: "Bloco de Rotina",     operations: ["criar","listar","consultar","pesquisar","editar","excluir"], destructive: ["excluir"], synonyms: ["bloco","rotina","compromisso","agenda","atividade da rotina"], status: "disponivel" },
      { id: "metodo_trabalho", name: "Método de Trabalho",  operations: ["criar","listar","consultar","pesquisar","editar","excluir"], destructive: ["excluir"], synonyms: ["mt","método de trabalho","metodo de trabalho"], status: "disponivel" },
      { id: "template_rotina", name: "Template de Rotina",  operations: ["criar","listar","consultar","pesquisar","editar","excluir"], destructive: ["excluir"], synonyms: ["template","modelo de rotina","modelo"], status: "disponivel" },
    ],
  },
  {
    id: "agenda",
    name: "Agenda / Tarefas",
    purpose: "Tarefas agendadas, foco, prazos e reuniões.",
    entities: [
      { id: "tarefa",  name: "Tarefa",  operations: ["criar","listar","consultar","editar","excluir","concluir","agendar"], destructive: ["excluir"], status: "planejada" },
      { id: "reuniao", name: "Reunião", operations: ["criar","listar","consultar","editar"], status: "planejada" },
    ],
  },
  {
    id: "digital",
    name: "Digital / Conteúdo",
    purpose: "Ideias, variações, mídias e publicações por plataforma.",
    entities: [
      { id: "ideia_digital",     name: "Ideia Digital",     operations: ["criar","listar","consultar","editar","gerar"], status: "planejada" },
      { id: "variacao_conteudo", name: "Variação",          operations: ["publicar","agendar","consultar"], status: "planejada" },
    ],
  },
  {
    id: "estoque",
    name: "Estoque",
    purpose: "Movimentações, saldos, locais de armazenagem e ajustes.",
    entities: [
      { id: "saldo_estoque",         name: "Saldo",        operations: ["consultar","listar"], status: "planejada" },
      { id: "movimentacao_estoque",  name: "Movimentação", operations: ["criar","listar","consultar"], status: "planejada" },
    ],
  },
  {
    id: "rotas",
    name: "Rotas / Entregas",
    purpose: "Rotas de entrega, paradas e comprovantes.",
    entities: [
      { id: "rota",            name: "Rota",           operations: ["criar","listar","consultar","editar"], status: "planejada" },
      { id: "parada_entrega",  name: "Parada",         operations: ["concluir","consultar"], status: "planejada" },
    ],
  },
  {
    id: "assistente",
    name: "Assistente IA / IA Orquestradora",
    purpose: "Gestão do próprio Assistente IA: histórico de chats, decisões propostas, políticas e logs de execução.",
    entities: [
      { id: "chat",     name: "Chat",     operations: ["listar","consultar"], synonyms: ["conversa","histórico do assistente"], status: "disponivel" },
      { id: "decisao",  name: "Decisão",  operations: ["listar","consultar","excluir"], destructive: ["excluir"], synonyms: ["insight","proposta"], status: "disponivel" },
      { id: "politica", name: "Política", operations: ["listar","consultar"], synonyms: ["autopilot"], status: "disponivel" },
      { id: "log",      name: "Log",      operations: ["listar","consultar","limpar"], destructive: ["limpar"], synonyms: ["registro de execução"], status: "disponivel" },
    ],
  },
  {
    id: "organizacao",
    name: "Organização",
    purpose: "Gestão da estrutura hierárquica e dos responsáveis do Painel Central.",
    entities: [
      { id: "no_organizacional", name: "Nó Organizacional", operations: ["criar","listar","consultar","pesquisar","editar","excluir"], destructive: ["excluir"], synonyms: ["nó","area","área","setor","equipe","função","funcao"], status: "disponivel" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers de resolução
// ---------------------------------------------------------------------------

export interface ResolvedCapability {
  module: ModuleCapabilities;
  entity: EntityDef;
  operation: Operation;
  /** true se a operação é destrutiva na entidade e requer confirmação. */
  requires_confirmation: boolean;
  /** escopo inferido a partir de aliases legados (opcional). */
  inferred_scope?: "all" | "one";
}

function normalizeOperation(op: string): Operation | null {
  const lower = op.toLowerCase() as Operation;
  const aliased = LEGACY_VERB_ALIASES[lower];
  const finalOp = (aliased ?? lower) as Operation;
  const valid: Operation[] = [
    "criar","listar","consultar","pesquisar","editar","excluir","limpar","mover","gerar",
    "publicar","aprovar","enviar","concluir","agendar","importar","exportar",
  ];
  return valid.includes(finalOp) ? finalOp : null;
}

/**
 * Resolve (moduleId?, entity, operation) → capacidade válida no catálogo.
 * Também aceita aliases legados de entidade (ex.: "todas_decisoes_assistente").
 */
export function resolveCapability(input: {
  moduleId?: string;
  entity: string;
  operation: string;
}): ResolvedCapability | null {
  const rawEntity = input.entity.toLowerCase();
  const alias = LEGACY_ENTITY_ALIASES[rawEntity];
  const entityId = alias?.entity ?? rawEntity;
  const moduleId = input.moduleId ?? alias?.module;
  const op = normalizeOperation(alias?.operation ?? input.operation);
  if (!op) return null;

  const modules = moduleId
    ? CAPABILITIES_CATALOG.filter((m) => m.id === moduleId)
    : CAPABILITIES_CATALOG;

  for (const mod of modules) {
    const entities = Array.isArray(mod.entities) ? mod.entities : [];
    const ent = entities.find(
      (e) => e.id === entityId || e.synonyms?.some((s) => s.toLowerCase() === entityId),
    );
    if (!ent) continue;
    const operations = Array.isArray(ent.operations) ? ent.operations : [];
    if (!operations.includes(op)) continue;
    return {
      module: mod,
      entity: ent,
      operation: op,
      requires_confirmation: Boolean(ent.destructive?.includes(op)),
      inferred_scope: alias?.scope,
    };
  }
  return null;
}

/**
 * Compat: mantém a assinatura antiga usada por código legado.
 * Ainda é usada por snapshots e prompts que iteram capacidades.
 */
export function findCapability(
  verb: string,
  entity: string,
): { module: ModuleCapabilities; capability: { verb: string; entity: string; status: EntityStatus; description: string } } | null {
  const resolved = resolveCapability({ entity, operation: verb });
  if (!resolved) return null;
  return {
    module: resolved.module,
    capability: {
      verb: resolved.operation,
      entity: resolved.entity.id,
      status: resolved.entity.status ?? "planejada",
      description: `${resolved.operation} ${resolved.entity.name} em ${resolved.module.name}`,
    },
  };
}

export function renderCatalogForPrompt(): string {
  const lines: string[] = [];
  for (const mod of CAPABILITIES_CATALOG) {
    lines.push(`\n### Módulo: ${mod.name} (id: ${mod.id})`);
    lines.push(`Função: ${mod.purpose}`);
    const entities = Array.isArray(mod.entities) ? mod.entities : [];
    for (const ent of entities) {
      const operations = Array.isArray(ent.operations) ? ent.operations : [];
      const ops = operations.join(", ");
      const destr = ent.destructive?.length ? ` [destrutivas: ${ent.destructive.join(", ")}]` : "";
      const syn = ent.synonyms?.length ? ` [sinônimos: ${ent.synonyms.join(", ")}]` : "";
      const st = ent.status ?? "planejada";
      lines.push(`- Entidade: ${ent.name} (id: ${ent.id}) — operações: ${ops}${destr} — status: ${st}${syn}`);
    }
  }
  return lines.join("\n");
}

export function listModules(): { id: string; name: string; purpose: string }[] {
  return CAPABILITIES_CATALOG.map(({ id, name, purpose }) => ({ id, name, purpose }));
}
