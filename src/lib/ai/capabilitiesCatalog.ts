// ============================================================================
// CATÁLOGO UNIVERSAL DE CAPACIDADES DA IA ORQUESTRADORA
// ----------------------------------------------------------------------------
// Fonte oficial e única de verdade sobre o que cada módulo do Painel Central
// é capaz de fazer. NÃO armazena comandos específicos — registra apenas
// CAPACIDADES (verbos) por módulo.
//
// Status possíveis:
//   - "disponivel": há ferramenta/executor real conectado à IA.
//   - "planejada":  a funcionalidade existe (ou existirá) no sistema, mas a
//                   IA ainda não possui executor conectado a ela.
//
// Para crescer o catálogo: basta adicionar capacidades ao módulo apropriado
// ou registrar um novo módulo. A IA Orquestradora lerá automaticamente.
// ============================================================================

export type CapabilityStatus = "disponivel" | "planejada";

export type CapabilityVerb =
  | "criar"
  | "editar"
  | "excluir"
  | "consultar"
  | "mover"
  | "gerar"
  | "publicar"
  | "aprovar"
  | "enviar"
  | "concluir"
  | "agendar"
  | "importar"
  | "exportar";

export interface Capability {
  verb: CapabilityVerb;
  entity: string;              // ex: "tarefa", "contato", "lançamento_financeiro"
  description: string;         // frase curta do que a capacidade representa
  status: CapabilityStatus;
  synonyms?: string[];         // termos que o usuário costuma usar
}

export interface ModuleCapabilities {
  id: string;                  // slug interno do módulo
  name: string;                // nome apresentável
  purpose: string;             // 1 frase sobre a função do módulo
  capabilities: Capability[];
}

export const CAPABILITIES_CATALOG: ModuleCapabilities[] = [
  {
    id: "crm",
    name: "CRM / Contatos",
    purpose: "Gestão de contatos, leads, funil, atividades e histórico de relacionamento.",
    capabilities: [
      { verb: "criar",     entity: "contato",           description: "Cadastrar novo contato/lead.", status: "planejada", synonyms: ["novo contato","adicionar cliente","cadastrar lead"] },
      { verb: "editar",    entity: "contato",           description: "Editar dados de um contato existente.", status: "planejada" },
      { verb: "excluir",   entity: "contato",           description: "Remover contato do CRM.", status: "planejada", synonyms: ["deletar contato","apagar cliente"] },
      { verb: "consultar", entity: "contato",           description: "Buscar/listar contatos.", status: "planejada", synonyms: ["buscar cliente","procurar lead"] },
      { verb: "mover",     entity: "contato_no_funil",  description: "Mover contato entre etapas do funil.", status: "planejada", synonyms: ["mudar etapa","avançar funil"] },
      { verb: "gerar",     entity: "mensagem_whatsapp", description: "Gerar rascunho de mensagem personalizada para revisão humana.", status: "planejada" },
      { verb: "enviar",    entity: "mensagem_whatsapp", description: "Disparar mensagem no WhatsApp do contato.", status: "planejada" },
    ],
  },
  {
    id: "financeiro",
    name: "Financeiro",
    purpose: "Contas, lançamentos a pagar/receber, movimentações, categorias e precificação.",
    capabilities: [
      { verb: "criar",     entity: "lancamento_financeiro", description: "Criar lançamento a pagar ou a receber.", status: "planejada", synonyms: ["novo lançamento","adicionar conta"] },
      { verb: "editar",    entity: "lancamento_financeiro", description: "Editar lançamento existente.", status: "planejada" },
      { verb: "excluir",   entity: "lancamento_financeiro", description: "Remover lançamento.", status: "planejada" },
      { verb: "consultar", entity: "lancamento_financeiro", description: "Consultar lançamentos e saldos.", status: "planejada", synonyms: ["ver saldo","listar contas"] },
      { verb: "aprovar",   entity: "pagamento",             description: "Confirmar/registrar pagamento (baixa parcial ou total).", status: "planejada", synonyms: ["dar baixa","confirmar pagamento"] },
    ],
  },
  {
    id: "operacoes",
    name: "Operações / Pedidos",
    purpose: "Ciclo de pedidos, itens, entregas e integração com produção.",
    capabilities: [
      { verb: "criar",     entity: "pedido",   description: "Registrar novo pedido.", status: "planejada" },
      { verb: "editar",    entity: "pedido",   description: "Editar pedido existente.", status: "planejada" },
      { verb: "excluir",   entity: "pedido",   description: "Cancelar/excluir pedido.", status: "planejada" },
      { verb: "consultar", entity: "pedido",   description: "Listar/consultar pedidos.", status: "planejada" },
      { verb: "aprovar",   entity: "pedido",   description: "Confirmar/aprovar pedido.", status: "planejada" },
    ],
  },
  {
    id: "producao",
    name: "Produção",
    purpose: "Ordens de produção, processos, apontamentos e fechamento.",
    capabilities: [
      { verb: "criar",     entity: "ordem_producao", description: "Abrir nova OP.", status: "planejada" },
      { verb: "editar",    entity: "ordem_producao", description: "Editar OP existente.", status: "planejada" },
      { verb: "concluir",  entity: "ordem_producao", description: "Finalizar OP e dar entrada em estoque.", status: "planejada" },
      { verb: "consultar", entity: "ordem_producao", description: "Consultar OPs e status de produção.", status: "planejada" },
    ],
  },
  {
    id: "rotina",
    name: "Rotina",
    purpose: "Blocos de rotina, alertas, métodos de trabalho e execução diária.",
    capabilities: [
      { verb: "criar",     entity: "bloco_rotina", description: "Criar novo bloco de rotina.", status: "planejada" },
      { verb: "editar",    entity: "bloco_rotina", description: "Editar bloco existente.", status: "planejada" },
      { verb: "excluir",   entity: "bloco_rotina", description: "Remover bloco da rotina.", status: "planejada" },
      { verb: "consultar", entity: "bloco_rotina", description: "Consultar rotina do dia/semana.", status: "planejada" },
    ],
  },
  {
    id: "agenda",
    name: "Agenda / Tarefas",
    purpose: "Tarefas agendadas, foco, prazos e reuniões.",
    capabilities: [
      { verb: "criar",     entity: "tarefa",  description: "Criar nova tarefa.", status: "planejada", synonyms: ["nova tarefa","adicionar to-do"] },
      { verb: "editar",    entity: "tarefa",  description: "Editar tarefa existente.", status: "planejada" },
      { verb: "excluir",   entity: "tarefa",  description: "Remover tarefa.", status: "planejada", synonyms: ["apagar tarefa","deletar tarefa"] },
      { verb: "concluir",  entity: "tarefa",  description: "Marcar tarefa como concluída.", status: "planejada" },
      { verb: "agendar",   entity: "tarefa",  description: "Reagendar tarefa para outra data/hora.", status: "planejada" },
      { verb: "consultar", entity: "tarefa",  description: "Listar tarefas por filtro.", status: "planejada" },
      { verb: "criar",     entity: "reuniao", description: "Agendar nova reunião.", status: "planejada" },
    ],
  },
  {
    id: "digital",
    name: "Digital / Conteúdo",
    purpose: "Ideias, variações, mídias e publicações por plataforma.",
    capabilities: [
      { verb: "gerar",     entity: "conteudo_digital",  description: "Gerar rascunho de ideia/legenda/roteiro para revisão humana.", status: "planejada" },
      { verb: "criar",     entity: "ideia_digital",     description: "Registrar nova ideia de conteúdo.", status: "planejada" },
      { verb: "editar",    entity: "ideia_digital",     description: "Editar ideia existente.", status: "planejada" },
      { verb: "publicar",  entity: "variacao_conteudo", description: "Publicar variação em uma plataforma.", status: "planejada" },
      { verb: "agendar",   entity: "variacao_conteudo", description: "Programar publicação para data futura.", status: "planejada" },
    ],
  },
  {
    id: "estoque",
    name: "Estoque",
    purpose: "Movimentações, saldos, locais de armazenagem e ajustes.",
    capabilities: [
      { verb: "consultar", entity: "estoque",              description: "Consultar saldo de estoque.", status: "planejada" },
      { verb: "criar",     entity: "movimentacao_estoque", description: "Registrar entrada/saída/ajuste de estoque.", status: "planejada" },
    ],
  },
  {
    id: "rotas",
    name: "Rotas / Entregas",
    purpose: "Rotas de entrega, paradas e comprovantes.",
    capabilities: [
      { verb: "criar",     entity: "rota",          description: "Criar nova rota de entrega.", status: "planejada" },
      { verb: "editar",    entity: "rota",          description: "Editar rota/paradas.", status: "planejada" },
      { verb: "concluir",  entity: "parada_entrega",description: "Marcar parada como entregue.", status: "planejada" },
    ],
  },
  {
    id: "assistente",
    name: "Assistente IA / IA Orquestradora",
    purpose: "Gestão do próprio Assistente IA: histórico de chats, decisões propostas, políticas e logs de execução.",
    capabilities: [
      { verb: "consultar", entity: "chat_assistente",            description: "Listar mensagens do histórico de chat da IA.", status: "disponivel", synonyms: ["listar chats","ver conversas","histórico do assistente"] },
      { verb: "consultar", entity: "decisao_assistente",         description: "Listar decisões/insights propostos pela IA.", status: "disponivel", synonyms: ["listar decisões","ver insights","decisões da ia"] },
      { verb: "excluir",   entity: "decisao_assistente",         description: "Excluir uma decisão/insight específico (requer confirmação).", status: "disponivel", synonyms: ["deletar decisão","apagar insight","remover decisão"] },
      { verb: "excluir",   entity: "todas_decisoes_assistente",  description: "Excluir TODAS as decisões/insights da IA (requer confirmação).", status: "disponivel", synonyms: ["excluir todas decisões","limpar decisões","apagar todos insights"] },
      { verb: "consultar", entity: "politica_assistente",        description: "Listar políticas de autopilot da IA por área.", status: "disponivel", synonyms: ["listar políticas","ver autopilot"] },
      { verb: "consultar", entity: "log_assistente",             description: "Listar logs de execução de ações da IA.", status: "disponivel", synonyms: ["listar logs","ver logs da ia","histórico de ações"] },
      { verb: "excluir",   entity: "todos_logs_assistente",      description: "Limpar TODOS os logs de execução da IA (requer confirmação).", status: "disponivel", synonyms: ["limpar logs","apagar logs","zerar logs da ia"] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function renderCatalogForPrompt(): string {
  const lines: string[] = [];
  for (const mod of CAPABILITIES_CATALOG) {
    lines.push(`\n### Módulo: ${mod.name} (id: ${mod.id})`);
    lines.push(`Função: ${mod.purpose}`);
    for (const cap of mod.capabilities) {
      const syn = cap.synonyms?.length ? ` [sinônimos: ${cap.synonyms.join(", ")}]` : "";
      lines.push(`- ${cap.verb}_${cap.entity} — status: ${cap.status} — ${cap.description}${syn}`);
    }
  }
  return lines.join("\n");
}

export function findCapability(verb: string, entity: string): { module: ModuleCapabilities; capability: Capability } | null {
  const v = verb.toLowerCase();
  const e = entity.toLowerCase();
  for (const mod of CAPABILITIES_CATALOG) {
    const cap = mod.capabilities.find(
      (c) => c.verb === v && (c.entity === e || c.synonyms?.some((s) => s.toLowerCase() === e))
    );
    if (cap) return { module: mod, capability: cap };
  }
  return null;
}

export function listModules(): { id: string; name: string; purpose: string }[] {
  return CAPABILITIES_CATALOG.map(({ id, name, purpose }) => ({ id, name, purpose }));
}
