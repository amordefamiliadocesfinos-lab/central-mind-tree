import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Brain,
  BookOpen,
  Eye,
  Building2,
  TrendingUp,
  Activity,
  Plus,
  Trash2,
  FileText,
  Save,
  Search,
  ChevronRight,
  History,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Types ----------

type AreaId = "biblioteca" | "consciencia" | "arquitetura" | "evolucao" | "estado-atual";

interface AreaMeta {
  id: AreaId;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

interface PageVersion {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  label?: string;
}

interface DocPage {
  id: string;
  areaId: AreaId;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  versions: PageVersion[];
}

// ---------- Config ----------

const AREAS: AreaMeta[] = [
  {
    id: "biblioteca",
    title: "Biblioteca do Projeto",
    description: "Documentos, referências e materiais de apoio.",
    icon: BookOpen,
    color: "#3B82F6",
  },
  {
    id: "consciencia",
    title: "Consciência",
    description: "Propósito, missão, visão e princípios do projeto.",
    icon: Eye,
    color: "#8B5CF6",
  },
  {
    id: "arquitetura",
    title: "Arquitetura",
    description: "Estrutura, módulos, fluxos e decisões técnicas.",
    icon: Building2,
    color: "#F59E0B",
  },
  {
    id: "evolucao",
    title: "Evolução do Projeto",
    description: "Marcos, aprendizados e histórico de mudanças.",
    icon: TrendingUp,
    color: "#10B981",
  },
  {
    id: "estado-atual",
    title: "Estado Atual do Sistema",
    description: "Documentação da arquitetura existente do Painel Central.",
    icon: Activity,
    color: "#EF4444",
  },
];

const STORAGE_KEY = "nucleo_painel_central_pages_v3";
const SEED_FLAG_KEY = "nucleo_biblioteca_seed_v1";
const CONSCIENCIA_SEED_FLAG_KEY = "nucleo_consciencia_seed_v1";

const CONSCIENCIA_SEED: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Diretrizes Operacionais da Consciência",
    tags: ["diretrizes", "operacional", "consciência", "fundamento"],
    content:
      "Diretrizes Operacionais da Consciência\n\n" +
      "Este documento reúne as diretrizes que orientam o funcionamento da Consciência do Painel Central — a camada responsável por integrar Memória, Aprendizagem, Personalidade, Regras e Especialistas em uma inteligência coerente e alinhada ao propósito do sistema.\n\n" +
      "1. Propósito\n" +
      "— Definir como a Consciência interpreta contexto, prioriza decisões e responde ao ambiente.\n\n" +
      "2. Princípios Operacionais\n" +
      "— Coerência com o Manifesto e a Constituição.\n" +
      "— Transparência das decisões e rastreabilidade das ações.\n" +
      "— Respeito às Regras e aos limites definidos.\n\n" +
      "3. Estrutura Futura\n" +
      "Esta área receberá progressivamente documentos específicos de:\n" +
      "• Memória — o que a Consciência lembra e como recupera.\n" +
      "• Aprendizagem — como evolui com base em experiência.\n" +
      "• Personalidade — tom, estilo e postura.\n" +
      "• Regras — limites, permissões e obrigações.\n" +
      "• Especialistas — perfis e domínios de conhecimento.\n" +
      "• Demais componentes da Inteligência Artificial.\n\n" +
      "— Escreva aqui as diretrizes completas conforme evoluírem.",
  },
];

const ARQUITETURA_SEED_FLAG_KEY = "nucleo_arquitetura_seed_v1";

const ARQUITETURA_SEED: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Visão Geral da Arquitetura",
    tags: ["arquitetura", "visão-geral", "plataforma"],
    content:
      "Visão Geral da Arquitetura\n\n" +
      "Documento-mãe da área de Arquitetura. Descreve, em alto nível, como o Painel Central está estruturado e como suas camadas se conectam.\n\n" +
      "— Escreva aqui a visão geral da plataforma.",
  },
  {
    title: "Arquitetura dos Módulos",
    tags: ["módulos", "estrutura"],
    content:
      "Arquitetura dos Módulos\n\n" +
      "Como cada módulo do Painel Central (CRM, Financeiro, Operações, Digital, Rotina, etc.) é organizado, suas responsabilidades e limites.\n\n" +
      "— Documente aqui a arquitetura de cada módulo.",
  },
  {
    title: "Arquitetura dos Agentes de IA",
    tags: ["ia", "agentes"],
    content:
      "Arquitetura dos Agentes de IA\n\n" +
      "Estrutura dos agentes de IA: papéis, contexto, ferramentas, memória, políticas de decisão e integração com a Consciência.\n\n" +
      "— Documente aqui cada agente e sua arquitetura.",
  },
  {
    title: "Banco de Dados",
    tags: ["banco-de-dados", "schema"],
    content:
      "Banco de Dados\n\n" +
      "Modelagem, tabelas, relacionamentos, políticas de acesso (RLS) e convenções do banco de dados.\n\n" +
      "— Documente aqui o schema e as regras de dados.",
  },
  {
    title: "Fluxos",
    tags: ["fluxos", "processos"],
    content:
      "Fluxos\n\n" +
      "Fluxos de dados, de usuário e de automações que atravessam o sistema (ex.: lead → venda → produção → entrega).\n\n" +
      "— Documente aqui cada fluxo relevante.",
  },
  {
    title: "APIs",
    tags: ["api", "endpoints"],
    content:
      "APIs\n\n" +
      "Endpoints internos e externos, contratos, autenticação, versionamento e exemplos de uso.\n\n" +
      "— Documente aqui as APIs expostas e consumidas.",
  },
  {
    title: "Integrações",
    tags: ["integrações", "terceiros"],
    content:
      "Integrações\n\n" +
      "Integrações com serviços externos (WhatsApp, provedores de IA, pagamentos, e-mail, etc.): configuração, limites e falhas conhecidas.\n\n" +
      "— Documente aqui cada integração ativa.",
  },
  {
    title: "Estrutura Geral da Plataforma",
    tags: ["plataforma", "infraestrutura"],
    content:
      "Estrutura Geral da Plataforma\n\n" +
      "Camadas de frontend, backend, banco, storage, edge functions, autenticação e deploy. Como tudo se encaixa.\n\n" +
      "— Documente aqui a estrutura geral.",
  },
];

const EVOLUCAO_SEED_FLAG_KEY = "nucleo_evolucao_seed_v1";

const EVOLUCAO_SEED: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Roadmap",
    tags: ["roadmap", "planejamento"],
    content:
      "Roadmap do Painel Central\n\n" +
      "Visão de curto, médio e longo prazo do que será construído.\n\n" +
      "• Próximos 30 dias — \n• Próximos 90 dias — \n• Longo prazo — \n\n" +
      "— Atualize conforme o projeto evolui.",
  },
  {
    title: "Melhorias",
    tags: ["melhorias", "backlog"],
    content:
      "Melhorias\n\n" +
      "Lista viva de ajustes e refinamentos em módulos existentes.\n\n" +
      "• Melhoria — módulo — impacto — status\n\n" +
      "— Registre aqui cada melhoria proposta.",
  },
  {
    title: "Ideias",
    tags: ["ideias", "exploração"],
    content:
      "Ideias\n\n" +
      "Espaço aberto para capturar ideias, mesmo que ainda não priorizadas.\n\n" +
      "• Ideia — contexto — potencial\n\n" +
      "— Não filtre: registre primeiro, avalie depois.",
  },
  {
    title: "Decisões Importantes",
    tags: ["decisões", "adr"],
    content:
      "Decisões Importantes\n\n" +
      "Registro de decisões estratégicas e técnicas que moldam o Painel Central.\n\n" +
      "Formato sugerido:\n" +
      "• Data — Decisão — Contexto — Alternativas consideradas — Consequências\n\n" +
      "— Toda decisão relevante deve ser documentada aqui.",
  },
  {
    title: "Histórico de Alterações",
    tags: ["changelog", "histórico"],
    content:
      "Histórico de Alterações\n\n" +
      "Changelog cronológico das mudanças significativas na plataforma.\n\n" +
      "Formato sugerido:\n" +
      "• [AAAA-MM-DD] Módulo — descrição da alteração\n\n" +
      "— Mantenha em ordem cronológica inversa (mais recente no topo).",
  },
];

const ESTADO_ATUAL_SEED_FLAG_KEY = "nucleo_estado_atual_seed_v1";

const ESTADO_ATUAL_TITLES: Array<{ title: string; tags: string[] }> = [
  { title: "Mapa Geral do Sistema", tags: ["mapa", "visão-geral"] },
  { title: "Arquitetura Atual", tags: ["arquitetura", "atual"] },
  { title: "Banco de Dados", tags: ["banco-de-dados"] },
  { title: "Integrações", tags: ["integrações"] },
  { title: "Agentes de IA", tags: ["ia", "agentes"] },
  { title: "Fluxos do Sistema", tags: ["fluxos"] },
  { title: "Funcionalidades Implementadas", tags: ["funcionalidades", "implementadas"] },
  { title: "Funcionalidades Incompletas", tags: ["funcionalidades", "incompletas"] },
  { title: "Pontos Fortes", tags: ["pontos-fortes"] },
  { title: "Pontos de Melhoria", tags: ["melhorias"] },
  { title: "Dívida Técnica", tags: ["dívida-técnica"] },
  { title: "Resumo Executivo", tags: ["resumo", "executivo"] },
];

const MAPA_GERAL_CONTENT =
  "Mapa Geral do Sistema — Painel Central\n" +
  "Snapshot da estrutura atual da plataforma. Documento descritivo — nenhuma funcionalidade foi alterada.\n\n" +
  "==============================================\n" +
  "1. VISÃO GERAL\n" +
  "==============================================\n" +
  "Painel Central – Cérebro é uma plataforma web (React 18 + Vite + TypeScript + Tailwind + shadcn/ui) que funciona como organograma interativo e hub operacional. Backend em Lovable Cloud (Supabase: Postgres + Auth + Storage + Edge Functions). Estado global via Zustand, dados remotos via TanStack Query e cliente Supabase.\n\n" +
  "==============================================\n" +
  "2. MÓDULOS EXISTENTES\n" +
  "==============================================\n" +
  "• Núcleo — Fonte oficial de conhecimento (Biblioteca, Consciência, Arquitetura, Evolução, Estado Atual).\n" +
  "• Organograma / Node Tree — Árvore hierárquica de nós, múltiplas visualizações (Padrão, Linhas, CEO, Horizontal, Spreadsheet).\n" +
  "• Foco — Fila de execução prioritária com cronômetro (time tracking).\n" +
  "• Planejamento — Drag-and-drop de tarefas sincronizado com Foco.\n" +
  "• Calendário — Hub anual unificando tarefas, pedidos, reuniões, conteúdo digital e datas sazonais.\n" +
  "• Rotina — Blocos de foco, MTs (Métodos de Trabalho), alertas globais e checklists.\n" +
  "• Operações — Pedidos (estoque/produção), OPs, produção semanal, MRP, inventário multi-local, custos.\n" +
  "• Digital — Ideias, variações por plataforma, calendário editorial, mídia, tendências, atendimento.\n" +
  "• Financeiro — Contas, categorias, entradas, pagamentos parciais, faturas, precificação hierárquica (V2), dashboard.\n" +
  "• CRM / Contatos — Funil Kommo, leads, timeline, tags, atividades, tarefas agendadas, inbox de conversas.\n" +
  "• Reuniões — Roteiro estruturado, agenda, action items, sincronização com calendário.\n" +
  "• Assistente (IA CEO) — Chat com contexto amplo, execução de comandos, histórico persistente.\n" +
  "• Planilhas — Editor de planilhas com engine de fórmulas próprio.\n" +
  "• Rotas — Planejamento de entregas, navegação, prova de entrega.\n" +
  "• Minha Área — Dashboard personalizado por usuário ativo.\n" +
  "• Dashboard Panorâmico — KPIs cross-módulo.\n" +
  "• Metas / Oportunidades / Academia — Áreas complementares.\n\n" +
  "==============================================\n" +
  "3. ROTAS (src/App.tsx — React Router)\n" +
  "==============================================\n" +
  "/                     → Index (Organograma principal)\n" +
  "/dashboard            → Dashboard panorâmico\n" +
  "/foco                 → Fila de execução\n" +
  "/planejamento         → Planejamento drag-and-drop\n" +
  "/calendario           → Calendário anual unificado\n" +
  "/rotina               → Rotina e blocos de foco\n" +
  "/operacoes            → Operações (pedidos, produção, estoque)\n" +
  "/digital              → Marketing digital\n" +
  "/planilhas            → Planilhas\n" +
  "/reunioes             → Lista de reuniões\n" +
  "/reunioes/:id         → Detalhe da reunião\n" +
  "/minha-area           → Área pessoal do usuário ativo\n" +
  "/financeiro           → Financeiro\n" +
  "/assistente           → Assistente IA (CEO)\n" +
  "/contatos             → CRM / contatos\n" +
  "/contatos/inbox       → Inbox de conversas\n" +
  "/contatos/tarefas     → Tarefas agendadas do CRM\n" +
  "/rotas                → Rotas de entrega\n" +
  "/academia             → Academia\n" +
  "/metas                → Metas\n" +
  "/oportunidades        → Oportunidades\n" +
  "/nucleo               → Núcleo (base de conhecimento)\n" +
  "/task/:id             → Edição de tarefa\n" +
  "*                     → NotFound\n\n" +
  "==============================================\n" +
  "4. PÁGINAS (src/pages)\n" +
  "==============================================\n" +
  "Index, Dashboard, Foco, Planejamento, Calendario, Rotina, Operacoes, Digital, Planilhas, Reunioes, ReuniaoDetalhe, MinhaArea, Financeiro, Assistente, Contatos, ContatosInbox, TarefasAgendadas, Rotas, Academia, Metas, Oportunidades, Nucleo, TaskEdit, NotFound.\n\n" +
  "==============================================\n" +
  "5. MENUS E NAVEGAÇÃO GLOBAL\n" +
  "==============================================\n" +
  "• GlobalSearchBar — barra de busca superior global.\n" +
  "• GlobalFooterBar — rodapé com toolbar integrada, contadores de tarefas e seletor de modo de visualização.\n" +
  "• Dock flutuante (canto inferior direito): NucleoLauncherButton, ActiveUserPicker, RoutineAlertsToggleButton, AssistantPanel.\n" +
  "• SwipeNavigationWrapper — navegação por gestos (mobile).\n" +
  "• OperationsBottomNav / OperationsTopTabs — navegação interna do módulo Operações.\n" +
  "• Bottom nav mobile e sticky headers com safe-area em todas as páginas.\n\n" +
  "==============================================\n" +
  "6. COMPONENTES PRINCIPAIS (src/components)\n" +
  "==============================================\n" +
  "Raiz:\n" +
  "• NodeTree, NodeBox, NodeEditDialog, MoveNodeDialog, NodeConnectionsOverlay, NodesSpreadsheetView, HorizontalOrgChart, MultiView, CEOLegend.\n" +
  "• TaskBar, TasksDialog, TaskMergeDialog, DayTasksModal, DueDateBanner, DueDatePill, OnHoldBadge, OnHoldDialog.\n" +
  "• PlanningConfirmationDialog, ReplanningBanner, ReplanningModal, ReplanningWizard.\n" +
  "• GlobalSearchBar, GlobalFooterBar, NavLink, SwipeNavigationWrapper, ActiveUserPicker, NucleoLauncherButton.\n" +
  "• MediaUploader, ProductGallery, ProductMovementHistory, BOMEditor, MRPPanel, InventoryMovementDialog.\n" +
  "• SheetList, SheetTabsBar, SpreadsheetEditor, FunnelView, CollaboratorsPanel, ContactHistoryDialog, FollowUpBanner.\n\n" +
  "Assistente (IA):\n" +
  "• AssistantPanel, CEOChat.\n\n" +
  "Automação:\n" +
  "• AutomationRulesPanel.\n\n" +
  "CRM (src/components/crm):\n" +
  "• BulkWhatsAppDispatch, ContactActivitiesPanel, ContactAvatar, ContactCard, ContactChatPanel, ContactOrdersList, ContactTagsManager, ContactTasksPanel, ContactTimeline, FunnelAutomationsPanel, KommoFunnelView, LeadDetailDrawer, LeadImportDialog, LeadOriginPicker, LeadsNeedContactPanel, LostReasonDialog, MergeDuplicatesDialog, NextBestAction, PosVendaPanel, QuickConversationDialog, QuickConversationFAB, WhatsAppAttachments, WhatsAppMessageSelector.\n\n" +
  "Dashboard:\n" +
  "• BottleneckCard, CampaignResults, CommercialDashboard, CompanyStatus, DailyPerformance, DailyPriorities, DailySummary, NextActionsCard, QuickFinance.\n\n" +
  "Digital (src/components/digital):\n" +
  "• AIVariationsGenerator, AllVariationsSpreadsheetView, BatchVariationDialog, CustomFieldsDefinition, CustomFieldsRenderer, DigitalCalendar, DigitalDashboard, DigitalPrioritiesPanel, HierarchicalPlatformSelector, IdeaCard, IdeaEditor, IdeaTypesManager, IdeasSpreadsheetView, InteractionsPanel, KanbanBoard, KnowledgeBasePanel, MediaEditor, MediaFolderSidebar, MediaLibrary, MediaThumbnail, MetricsChart, NextStepHint, PlatformHierarchicalPicker, PlatformReplicaRenderer, PlatformsHealthPanel, PlatformsManager, ProductSelector, QuickActionWizard, ScheduleCalendar, ServicePanel, TrendsPanel, VariationEditor, VariationsSpreadsheetView.\n\n" +
  "Financeiro (src/components/financial):\n" +
  "• AccountsManager, AdvancedPaymentDialog, AvatarCropEditor, CategoriesManager, ContactFormDialog, ContactOrderHistory, ContactsManager, FinancialDashboard, FinancialEntriesList, FinancialEntryForm, InvoiceValidationDialog, InvoicesManager, IssuedInvoiceDetails, MobileFinancialView, PaymentDialog, PricingManager, PricingManagerV2.\n\n" +
  "Foco:\n" +
  "• TasksSpreadsheetView.\n\n" +
  "Operações (src/components/operations):\n" +
  "• ContactAutocomplete, KPICards, LateProductionBadge, LegacyProductionReport, LocationsManager, MRPTab, MultiLocationMovementDialog, OperationsBottomNav, OperationsCalendarTab, OperationsSearchBar, OperationsTopTabs, OrderCard, OrderEditDialog, OrderGridCard, OrderPriorityBadge, OrdersDateFilter, ProcessesManager, ProductCard, ProductCategoriesManager, ProductCostEditor, ProductDeleteDialog, ProductionClosingTab, ProductionLogForm, ProductionOrdersTab, ProductionPlanningView, ProductionTab, ProductionWeekView, ProductivityCharts, ProductsSubFilters.\n\n" +
  "Planejamento:\n" +
  "• SelectionSpreadsheetView.\n\n" +
  "Rotas (src/components/routes):\n" +
  "• AddStopDialog, ContactAddressPicker, DeliveryProofDialog, RouteEditor, SignaturePad, StopSortableItem.\n\n" +
  "Rotina (src/components/routine):\n" +
  "• AddToRoutineButton, AddToRoutineDialog, BlockEditDialog, CustomAlarmsPanel, MTManagerDialog, MTPickerDialog, MTWorkspaceBar, RoutineAlertOverlay, RoutineAlertsToggleButton, RoutineDayView, RoutineMonthView, RoutineWeekView.\n\n" +
  "Sazonais:\n" +
  "• SeasonalBadge, SeasonalDayModal, SeasonalDaysList, SeasonalEventDialog.\n\n" +
  "Verificação de estoque:\n" +
  "• StockCheckAlert, StockCheckWizard.\n\n" +
  "Time reports:\n" +
  "• TimeReportsPanel.\n\n" +
  "Lightbox global:\n" +
  "• LightboxProvider, LightboxRoot, LightboxImage, LightboxVideo (montado no App root).\n\n" +
  "UI base:\n" +
  "• src/components/ui — biblioteca shadcn/ui completa (button, card, dialog, popover, tabs, toast, sonner, etc.).\n\n" +
  "==============================================\n" +
  "7. PROVIDERS GLOBAIS (src/App.tsx)\n" +
  "==============================================\n" +
  "QueryClientProvider → TooltipProvider → UndoRedoProvider → LinesModeProvider → LightboxProvider → Toaster + Sonner + AppContent + LightboxRoot.\n" +
  "Hooks globais no AppContent: useScheduledTaskPromotion, useKeyboardAware.\n\n" +
  "==============================================\n" +
  "8. HOOKS PRINCIPAIS (src/hooks)\n" +
  "==============================================\n" +
  "Dados/CRM: useContacts, useContactsWithOrders, useContactActivities, useContactChecklist, useContactConversations, useContactHistory, useContactNextTasks, useContactTags, useLeadScore, useNoResponseDetection, useAllConversationsSummary.\n" +
  "Operações/Produção: useOrders, useProductionOrders, useProductionLogs, useProductionClosing, useProductsList, useProductCategories, useProductCosts, useBOM, useMRP, useInventoryMovements, useMultiLocationInventory, useStorageLocations, useProcesses.\n" +
  "Financeiro: useFinancial, usePricing, usePricingV2.\n" +
  "Digital: useDigital, useDigitalInteractions, useDigitalTrends, useIdeaActions, useIdeaTypes, useMediaFolders, usePlatformGroups, usePlatforms, usePosts, useProductIdeas, useKnowledgeBase.\n" +
  "Rotina/Foco/Calendário: useRoutine, useRoutineBlocks, useActiveMT, useCalendarService, useSeasonalDays, useScheduledTaskPromotion, useReplanningReminder, useReplanningWizard, useTimeTracking, useOnHold, useTaskMerge.\n" +
  "Sistema: useActiveUser, useNotifications, useSpreadsheet, useSwipeNavigation, useUndoRedo, useKeyboardAware, use-mobile, use-toast, useDailyMetrics, useMeetings, useDeliveryRoutes, useServiceChat, useWhatsAppWithLog, useAICEO.\n\n" +
  "==============================================\n" +
  "9. STATE / STORES (src/stores)\n" +
  "==============================================\n" +
  "• appStore.ts — estado global principal (Zustand).\n" +
  "• selectors.ts — seletores derivados.\n" +
  "• stockCheckStore.ts — estado do assistente de verificação de estoque.\n\n" +
  "==============================================\n" +
  "10. CONTEXTOS (src/contexts)\n" +
  "==============================================\n" +
  "• UndoRedoContext — pilha global de desfazer/refazer.\n" +
  "• LinesModeContext — modo de visualização de linhas do organograma.\n" +
  "• LightboxContext (em components/lightbox) — visualização global de mídia.\n\n" +
  "==============================================\n" +
  "11. BIBLIOTECAS UTILITÁRIAS (src/lib)\n" +
  "==============================================\n" +
  "dateUtils, decimal, formulaEngine, invoiceSync, invoiceValidation, utils, whatsapp, whatsappShare, whatsappTemplates.\n\n" +
  "==============================================\n" +
  "12. BACKEND — LOVABLE CLOUD\n" +
  "==============================================\n" +
  "Cliente: src/integrations/supabase/client.ts (auto-gerado, não editar).\n" +
  "Tipos: src/integrations/supabase/types.ts (auto-gerado).\n\n" +
  "Edge Functions (supabase/functions):\n" +
  "• ai-ceo — Assistente CEO com contexto amplo.\n" +
  "• contact-from-media — Extração de contato a partir de mídia.\n" +
  "• contact-summary — Resumo de contato via IA.\n" +
  "• digital-content-ai — Geração de conteúdo digital.\n" +
  "• digital-trends — Análise de tendências.\n" +
  "• enhance-image / media-enhance — Melhoria de imagem/mídia.\n" +
  "• smart-whatsapp-message — Sugestão inteligente de mensagens WhatsApp.\n\n" +
  "==============================================\n" +
  "13. OBSERVAÇÕES\n" +
  "==============================================\n" +
  "• Timezone obrigatório: America/Sao_Paulo. Parsing sempre com parseISO (date-fns).\n" +
  "• Datas exibidas em DD/MM/YYYY; armazenadas em YYYY-MM-DD.\n" +
  "• Precisão decimal: numeric(20,10) para custos, preços e quantidades.\n" +
  "• Mobile-first: sticky headers com safe-area, bottom nav, ResponsiveDialog fullscreen, framer-motion.\n" +
  "• Todo nó do organograma deve conectar-se ao nó raiz 'Deividi' (ID: d7c76db8-b7e0-4ce1-87ca-21275c346326).\n" +
  "• Documento vivo — atualize conforme o sistema evoluir.";

const MAPA_GERAL_FILL_FLAG = "nucleo_estado_atual_mapa_geral_fill_v1";

const ARQUITETURA_ATUAL_CONTENT =
  "Arquitetura Atual — Painel Central\n" +
  "Snapshot descritivo de como o sistema está organizado hoje. Nenhum código foi alterado.\n\n" +
  "==============================================\n" +
  "1. STACK E ORGANIZAÇÃO GERAL\n" +
  "==============================================\n" +
  "• Frontend: React 18 + Vite 5 + TypeScript 5 + Tailwind CSS v3 + shadcn/ui.\n" +
  "• Estado global: Zustand (src/stores). Dados remotos: TanStack Query.\n" +
  "• Roteamento: React Router (BrowserRouter) com transições via framer-motion (AnimatePresence).\n" +
  "• Backend: Lovable Cloud (Supabase) — Postgres + Auth + Storage + Edge Functions (Deno).\n" +
  "• Cliente Supabase: src/integrations/supabase/client.ts (auto-gerado, imutável).\n" +
  "• Tipos gerados: src/integrations/supabase/types.ts (auto-gerado).\n" +
  "• Design system: tokens semânticos em src/index.css + variantes shadcn em src/components/ui.\n" +
  "• Timezone forçado America/Sao_Paulo, datas parseISO/date-fns ptBR, DD/MM/YYYY na UI.\n\n" +
  "==============================================\n" +
  "2. ESTRUTURA DE PASTAS (raiz)\n" +
  "==============================================\n" +
  ".env, .lovable/, README.md, components.json, eslint.config.js, index.html\n" +
  "package.json, postcss.config.js, tailwind.config.ts, tsconfig*.json, vite.config.ts\n" +
  "public/          → assets estáticos (placeholder.svg, robots.txt)\n" +
  "supabase/        → config.toml + functions/ (edge functions)\n" +
  "src/             → código da aplicação\n\n" +
  "==============================================\n" +
  "3. ESTRUTURA DE PASTAS (src/)\n" +
  "==============================================\n" +
  "src/\n" +
  "├── App.tsx                → Providers globais + rotas + dock flutuante\n" +
  "├── main.tsx               → Bootstrap React\n" +
  "├── App.css / index.css    → Estilos globais e tokens de design\n" +
  "├── vite-env.d.ts\n" +
  "│\n" +
  "├── pages/                 → Uma página por rota (Index, Dashboard, Foco, ...)\n" +
  "├── components/            → Componentes de UI, organizados por domínio\n" +
  "│   ├── ui/                → shadcn/ui base (button, dialog, popover, ...)\n" +
  "│   ├── assistant/         → Assistente CEO (IA)\n" +
  "│   ├── automation/        → Regras de automação\n" +
  "│   ├── crm/               → CRM / contatos / WhatsApp\n" +
  "│   ├── dashboard/         → Widgets do dashboard panorâmico\n" +
  "│   ├── digital/           → Marketing digital / ideias / mídia\n" +
  "│   ├── financial/         → Financeiro (contas, entradas, faturas, pricing)\n" +
  "│   ├── foco/              → Fila de execução\n" +
  "│   ├── lightbox/          → Visualização global de mídia\n" +
  "│   ├── operations/        → Pedidos, produção, estoque, MRP\n" +
  "│   ├── planejamento/      → Planejamento drag-and-drop\n" +
  "│   ├── routes/            → Rotas de entrega\n" +
  "│   ├── routine/           → Rotina, blocos, MTs, alertas\n" +
  "│   ├── seasonal/          → Datas sazonais\n" +
  "│   ├── stock-check/       → Verificação de estoque\n" +
  "│   ├── time-reports/      → Relatórios de tempo\n" +
  "│   └── (raiz)             → Componentes transversais: NodeTree, TaskBar, GlobalSearchBar, ...\n" +
  "│\n" +
  "├── hooks/                 → Hooks de dados e comportamento (useContacts, useOrders, ...)\n" +
  "├── stores/                → Zustand: appStore, selectors, stockCheckStore\n" +
  "├── contexts/              → UndoRedoContext, LinesModeContext\n" +
  "├── lib/                   → Utilitários puros (dateUtils, decimal, formulaEngine, ...)\n" +
  "└── integrations/supabase/ → client.ts + types.ts (auto-gerados)\n\n" +
  "==============================================\n" +
  "4. ORGANIZAÇÃO DOS MÓDULOS\n" +
  "==============================================\n" +
  "Cada módulo funcional segue o mesmo padrão em 3 camadas:\n\n" +
  "  1) Página em src/pages/<Modulo>.tsx  → orquestra layout + estado local + rotas internas.\n" +
  "  2) Componentes em src/components/<modulo>/  → UI específica (dialogs, cards, painéis, editors, spreadsheets).\n" +
  "  3) Hooks em src/hooks/use<Modulo>*.ts  → acesso a dados (Supabase + React Query) e regras de negócio.\n\n" +
  "Módulos mapeados hoje:\n" +
  "• Núcleo               → pages/Nucleo.tsx (estrutura de conhecimento, sem pasta de componentes própria).\n" +
  "• Organograma          → components/NodeTree, NodeBox, NodesSpreadsheetView, HorizontalOrgChart, MultiView.\n" +
  "• Foco                 → pages/Foco.tsx + components/foco/ + hooks/useTimeTracking, useOnHold, useTaskMerge.\n" +
  "• Planejamento         → pages/Planejamento.tsx + components/planejamento/.\n" +
  "• Calendário           → pages/Calendario.tsx + hooks/useCalendarService, useSeasonalDays.\n" +
  "• Rotina               → pages/Rotina.tsx + components/routine/ + hooks/useRoutine, useRoutineBlocks, useActiveMT.\n" +
  "• Operações            → pages/Operacoes.tsx + components/operations/ + hooks/useOrders, useProductionOrders, useMRP, useMultiLocationInventory.\n" +
  "• Digital              → pages/Digital.tsx + components/digital/ + hooks/useDigital*, useIdea*, usePlatform*, useMediaFolders.\n" +
  "• Financeiro           → pages/Financeiro.tsx + components/financial/ + hooks/useFinancial, usePricing, usePricingV2.\n" +
  "• CRM / Contatos       → pages/Contatos*.tsx, TarefasAgendadas.tsx + components/crm/ + hooks/useContact*, useLeadScore, useNoResponseDetection.\n" +
  "• Reuniões             → pages/Reunioes.tsx, ReuniaoDetalhe.tsx + hooks/useMeetings.\n" +
  "• Assistente (IA)      → pages/Assistente.tsx + components/assistant/ + hooks/useAICEO + edge function ai-ceo.\n" +
  "• Planilhas            → pages/Planilhas.tsx + components/SpreadsheetEditor, SheetList, SheetTabsBar + hooks/useSpreadsheet + lib/formulaEngine.\n" +
  "• Rotas de entrega     → pages/Rotas.tsx + components/routes/ + hooks/useDeliveryRoutes.\n" +
  "• Minha Área           → pages/MinhaArea.tsx + hooks/useActiveUser.\n" +
  "• Dashboard            → pages/Dashboard.tsx + components/dashboard/ + hooks/useDailyMetrics.\n" +
  "• Metas / Oportunidades / Academia → páginas independentes complementares.\n\n" +
  "==============================================\n" +
  "5. CAMADA DE APRESENTAÇÃO (App.tsx)\n" +
  "==============================================\n" +
  "Cadeia de providers, de fora para dentro:\n" +
  "  QueryClientProvider\n" +
  "  └── TooltipProvider\n" +
  "      └── UndoRedoProvider\n" +
  "          └── LinesModeProvider\n" +
  "              └── LightboxProvider\n" +
  "                  ├── Toaster + Sonner (notificações globais)\n" +
  "                  ├── AppContent\n" +
  "                  │   ├── Dock flutuante (Núcleo, ActiveUser, Alertas, Assistente)\n" +
  "                  │   ├── GlobalSearchBar (topo)\n" +
  "                  │   ├── SwipeNavigationWrapper → AnimatedRoutes\n" +
  "                  │   ├── GlobalFooterBar (rodapé com toolbar)\n" +
  "                  │   ├── QuickConversationFAB (CRM)\n" +
  "                  │   ├── StockCheckAlert + StockCheckWizard\n" +
  "                  │   └── RoutineAlertOverlay\n" +
  "                  └── LightboxRoot\n\n" +
  "Hooks globais montados em AppContent: useScheduledTaskPromotion, useKeyboardAware.\n\n" +
  "==============================================\n" +
  "6. COMPONENTES PRINCIPAIS (transversais)\n" +
  "==============================================\n" +
  "• Navegação: GlobalSearchBar, GlobalFooterBar, NavLink, SwipeNavigationWrapper, ActiveUserPicker, NucleoLauncherButton.\n" +
  "• Organograma: NodeTree, NodeBox, NodeEditDialog, MoveNodeDialog, NodeConnectionsOverlay, HorizontalOrgChart, MultiView, CEOLegend, NodesSpreadsheetView.\n" +
  "• Tarefas: TaskBar, TasksDialog, TaskMergeDialog, DayTasksModal, DueDateBanner, DueDatePill, OnHoldBadge, OnHoldDialog.\n" +
  "• Replanejamento: PlanningConfirmationDialog, ReplanningBanner, ReplanningModal, ReplanningWizard.\n" +
  "• Mídia global: LightboxProvider, LightboxRoot, LightboxImage, LightboxVideo, MediaUploader, ProductGallery.\n" +
  "• Assistente IA: AssistantPanel, CEOChat.\n" +
  "• Estoque/Produção: BOMEditor, MRPPanel, InventoryMovementDialog, ProductMovementHistory.\n" +
  "• CRM: FunnelView, KommoFunnelView, LeadDetailDrawer, ContactCard, ContactTimeline, QuickConversationFAB, BulkWhatsAppDispatch.\n" +
  "• Financeiro: FinancialDashboard, FinancialEntriesList, FinancialEntryForm, PricingManagerV2, InvoicesManager.\n" +
  "• Rotina: RoutineAlertOverlay, MTWorkspaceBar, RoutineDay/Week/MonthView, CustomAlarmsPanel.\n" +
  "• Verificação de estoque: StockCheckAlert, StockCheckWizard.\n" +
  "• UI base: src/components/ui — todos os primitivos shadcn.\n\n" +
  "==============================================\n" +
  "7. CAMADA DE DADOS\n" +
  "==============================================\n" +
  "• Todo acesso ao backend passa por hooks em src/hooks/, que usam o cliente Supabase importado de @/integrations/supabase/client.\n" +
  "• React Query gerencia cache, invalidação e sincronização otimista.\n" +
  "• RLS (Row Level Security) obrigatório em todas as tabelas públicas + GRANTs explícitos.\n" +
  "• Roles armazenados em tabela separada (user_roles) com função SECURITY DEFINER has_role.\n" +
  "• Precisão decimal: numeric(20,10) para custos, preços e quantidades — nunca arredondar antes de exibir.\n" +
  "• Datas: armazenadas YYYY-MM-DD, sempre lidas com parseISO (nunca new Date()).\n\n" +
  "==============================================\n" +
  "8. EDGE FUNCTIONS (supabase/functions)\n" +
  "==============================================\n" +
  "• ai-ceo                 → Assistente CEO com contexto amplo.\n" +
  "• contact-from-media     → Extração de contato a partir de mídia.\n" +
  "• contact-summary        → Resumo de contato via IA.\n" +
  "• digital-content-ai     → Geração de conteúdo digital.\n" +
  "• digital-trends         → Análise de tendências.\n" +
  "• enhance-image          → Melhoria de imagem.\n" +
  "• media-enhance          → Melhoria genérica de mídia.\n" +
  "• smart-whatsapp-message → Sugestão inteligente de mensagens WhatsApp.\n\n" +
  "==============================================\n" +
  "9. PADRÕES ARQUITETURAIS EM VIGOR\n" +
  "==============================================\n" +
  "• Mobile-first: sticky headers com safe-area, bottom nav, ResponsiveDialog fullscreen no mobile, framer-motion para transições.\n" +
  "• Lazy-loading e divisão de componentes para módulos pesados (ver memory: module-lazy-loading-architecture).\n" +
  "• Spreadsheet implementado com HTML/Tailwind custom (react-data-grid é proibido).\n" +
  "• LightboxProvider único no App root (nunca local) para evitar conflitos de contexto.\n" +
  "• Download de mídia via fetch-to-blob; substituição atualiza registro existente (preserva links).\n" +
  "• Nós do organograma sempre conectados ao root 'Deividi' (ID d7c76db8-b7e0-4ce1-87ca-21275c346326); evitar ciclos em parent_id.\n" +
  "• Autonomia do usuário: campos, categorias, canais e plataformas são dinâmicos — nada hardcoded rígido.\n" +
  "• Segurança: nunca guardar roles no profile; nunca validar admin via localStorage/hardcoded.\n\n" +
  "==============================================\n" +
  "10. FLUXO DE UMA REQUISIÇÃO TÍPICA\n" +
  "==============================================\n" +
  "Usuário → Página (src/pages) → Componentes (src/components/<modulo>) → Hook (src/hooks/use*) →\n" +
  "Cliente Supabase (@/integrations/supabase/client) → Postgres/Edge Function → resposta cacheada por React Query →\n" +
  "UI re-renderiza com transições framer-motion.\n\n" +
  "Documento vivo — atualize conforme a arquitetura evoluir.";

const ARQUITETURA_ATUAL_FILL_FLAG = "nucleo_estado_atual_arquitetura_atual_fill_v1";

const AGENTES_IA_CONTENT =
  "Agentes de IA — Estado Atual\n" +
  "=========================================\n\n" +
  "Inventário dos agentes de IA operando hoje no Painel Central. Todos rodam em Edge Functions Deno (supabase/functions/*), consomem o Lovable AI Gateway (https://ai.gateway.lovable.dev/v1/chat/completions) e usam o modelo padrão google/gemini-2.5-flash (variações indicadas). Documento descritivo — não altera comportamento.\n\n" +
  "1. CEO IA (ai-ceo)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: assistente executivo com autonomia operacional. Analisa contexto global do painel, gera decisões/insights e executa CRUD em múltiplas entidades sob governança (ai_policies).\n" +
  "• Fluxo: recebe request do frontend (chat ou geração de insights) → carrega contexto amplo via SUPABASE_SERVICE_ROLE_KEY (tarefas, contatos, financeiro, produção, digital) → monta systemPrompt executivo → chama Gemini 2.5 Flash → parseia decisões/ações e executa CRUD → registra em ai_chat_messages, ai_insights, ai_insight_messages e ai_actions.\n" +
  "• Ferramentas/Ações suportadas: task_create/update/delete, node_create/update/delete, order_*, financial_create/update/delete/pay, contact_*, product_*, routine_*, post_*, notification.\n" +
  "• Governança: políticas em ai_policies (max_risk, escopos) — respeita autopilot definido pelo usuário.\n" +
  "• Modelo: google/gemini-2.5-flash.\n" +
  "• Limitações atuais: não faz streaming (resposta unitária); autonomia depende de max_risk configurado; não valida efeitos colaterais de negócio (ex.: impacto financeiro real de uma exclusão); histórico armazenado sem sumarização automática — contexto pode ficar caro em conversas longas.\n\n" +
  "2. Extrator de Contatos por Mídia (contact-from-media)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: extrair dados de contato (CRM) a partir de imagem/vídeo — cartão de visita, print de WhatsApp, perfil social, identidade, etc.\n" +
  "• Fluxo: recebe { mediaUrl, mimeType } → monta prompt multimodal (image_url ou video_url) → chama Gemini 2.5 Flash com tool calling estruturado → retorna JSON com campos identificados (nome, telefone, whatsapp, email, empresa, person_type, notes).\n" +
  "• Ferramentas: tool call schema para normalizar saída (telefones BR só dígitos, WhatsApp com DDI 55, pessoa física vs jurídica).\n" +
  "• Modelo: google/gemini-2.5-flash (multimodal).\n" +
  "• Limitações atuais: qualidade da extração depende da nitidez/idioma da mídia; não valida existência prévia do contato (deduplicação fica no frontend); vídeos longos podem exceder janela de contexto; não persiste o contato — apenas devolve o payload.\n\n" +
  "3. Resumo/Briefing de Contato (contact-summary)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: gerar briefing consolidado de um contato para uso comercial/atendimento.\n" +
  "• Fluxo: recebe { contact_id } → busca contato, histórico (contact_history), pedidos e conversas via service role → monta systemPrompt de analista comercial → chama Gemini 2.5 Flash → devolve resumo em texto/markdown.\n" +
  "• Ferramentas: apenas leitura direta no banco (sem tool calling).\n" +
  "• Modelo: google/gemini-2.5-flash.\n" +
  "• Limitações atuais: verify_jwt = false (chamada pública, controle apenas por RLS de leitura da service role); resumo não é armazenado — reprocessado a cada chamada; não cita fontes/eventos específicos com IDs.\n\n" +
  "4. IA de Mensagens WhatsApp (smart-whatsapp-message)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: gerar mensagem personalizada de WhatsApp com tom humanizado brasileiro, adaptada ao estágio do funil e histórico do cliente.\n" +
  "• Fluxo: recebe contexto do contato (funnel_status, LTV, último contato, produtos, motivo do envio) → monta systemPrompt de especialista em vendas por WhatsApp → chama Gemini 2.5 Flash → retorna texto pronto para revisão antes do envio.\n" +
  "• Ferramentas: nenhuma — geração pura de texto (envio é via deep link wa.me / api.whatsapp.com no frontend).\n" +
  "• Modelo: google/gemini-2.5-flash.\n" +
  "• Limitações atuais: não envia — apenas sugere; sem A/B testing embutido; não conhece o histórico literal de mensagens já trocadas na conversa (apenas metadados do CRM).\n\n" +
  "5. Especialista em Conteúdo Digital (digital-content-ai)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: equipe de especialistas de marketing digital — gera objetivos, público-alvo, mensagens-chave, KPIs, descrições, captions, CTAs, hashtags, checklists, estruturas de plataforma e adaptação de variações por canal (Instagram, TikTok, Shopee, Mercado Livre, etc.).\n" +
  "• Fluxo: recebe { field, platform, ideaContext, variations, mediaUrls } → seleciona prompt correspondente (buildSingleFieldPrompt, buildVariationsPrompt ou engenharia reversa de UI via prints) → chama Gemini 2.5 Flash (texto ou multimodal) → devolve conteúdo pronto para preencher digital_ideas / digital_variations.\n" +
  "• Ferramentas: prompts especializados por tipo de campo + análise multimodal de screenshots para reconstruir estruturas de plataforma.\n" +
  "• Modelo: google/gemini-2.5-flash.\n" +
  "• Limitações atuais: qualidade cai em nichos muito específicos sem contexto de marca; não valida políticas específicas de cada plataforma (limites de caracteres, termos proibidos); reconstrução de UI via prints depende da qualidade das imagens.\n\n" +
  "6. Radar de Tendências Digitais (digital-trends)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: identificar tendências de marketing digital por nicho e sugerir ganchos criativos, além de gerar respostas de atendimento e sugestões de FAQ.\n" +
  "• Fluxo: recebe { query, niche, type } → escolhe prompt (trends | reply | faq) → chama Gemini 2.5 Flash pedindo saída JSON estruturada (trends[], reply, faq[]) → retorna ao frontend.\n" +
  "• Ferramentas: prompt-engineering para saída JSON (sem tool calling formal).\n" +
  "• Modelo: google/gemini-2.5-flash.\n" +
  "• Limitações atuais: sem acesso a fontes externas em tempo real (dados baseados no conhecimento do modelo, que tem cutoff); JSON pode falhar em prompts complexos — parsing precisa ser defensivo.\n\n" +
  "7. Enhancer de Foto de Perfil (enhance-image)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: melhorar nitidez/resolução de fotos de perfil preservando 100% da identidade (mesmo rosto, expressão, roupa, fundo).\n" +
  "• Fluxo: recebe { imageUrl } → prompt fixo instruindo preservação de identidade → chama modelo de geração/edição de imagem via Gateway → retorna imagem melhorada.\n" +
  "• Ferramentas: geração de imagem (modality image).\n" +
  "• Modelo: modelo de imagem do Gateway (fallback interno via callModel).\n" +
  "• Limitações atuais: risco de leve deriva da identidade em rostos difíceis; sem controle explícito de resolução final; não faz upscale ilimitado.\n\n" +
  "8. Enhancer de Mídia Digital (media-enhance)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: reprocessar mídias do módulo Digital (fotos de produto, capas, imagens de post) para uso publicitário/comercial.\n" +
  "• Fluxo: recebe imagem + instrução → chama google/gemini-2.5-flash-image → devolve nova mídia.\n" +
  "• Ferramentas: geração/edição de imagem multimodal.\n" +
  "• Modelo: google/gemini-2.5-flash-image.\n" +
  "• Limitações atuais: pode alterar detalhes visuais do produto se a instrução não for específica; não versiona automaticamente a mídia original (a substituição/preservação é regra do frontend — memória media-download-and-replace-pattern).\n\n" +
  "9. Padrões e Restrições Globais dos Agentes\n" +
  "-----------------------------------------\n" +
  "• Todas as chamadas passam obrigatoriamente pelo Lovable AI Gateway com header Authorization: Bearer ${LOVABLE_API_KEY} — chave nunca exposta ao browser.\n" +
  "• Nenhuma função exige segredo de provider externo além de LOVABLE_API_KEY + chaves Supabase padrão.\n" +
  "• Erros 429 (rate limit) e 402 (créditos esgotados) devem ser tratados no frontend com mensagem clara ao usuário.\n" +
  "• Nenhum agente ainda usa streaming (todas as respostas são unitárias/JSON).\n" +
  "• Persistência de histórico/insights fica em ai_chat_messages, ai_insights, ai_insight_messages, ai_actions, ai_policies e service_ai_logs — memória chat-history-persistence-v21.\n" +
  "• Governança: antes de novo agente ou nova capacidade, consultar o Princípio Mestre do Núcleo e ai_policies para checar alinhamento estratégico e limites de risco.\n\n" +
  "10. Limitações Gerais Conhecidas\n" +
  "-----------------------------------------\n" +
  "• Sem streaming de tokens — respostas curtas parecem instantâneas, longas parecem travar.\n" +
  "• Sem observabilidade centralizada de custo por agente (só métricas do Gateway).\n" +
  "• Sem testes automatizados de regressão dos prompts.\n" +
  "• Sem cache semântico — perguntas repetidas geram novas chamadas pagas.\n" +
  "• Contexto de conversas longas cresce linearmente (não há sumarização automática).\n\n" +
  "Documento vivo — atualize sempre que um agente for adicionado, aposentado ou tiver responsabilidades/modelo alterados.";

const AGENTES_IA_FILL_FLAG = "nucleo_estado_atual_agentes_ia_fill_v1";

const FLUXOS_SISTEMA_CONTENT = `# Fluxos do Sistema — Estado Atual

Documentação dos principais fluxos operacionais do Painel Central. Cada fluxo descreve o caminho real percorrido pelo usuário e pelos dados, incluindo páginas envolvidas, tabelas afetadas e integrações acionadas. Nenhum fluxo foi alterado — este é apenas um mapa do comportamento atual.

---

## 1. Login e Autenticação

**Rota:** \`/auth\` (público) → redireciona para \`/\` após sessão válida.

**Passos:**
1. Usuário acessa \`/auth\` (\`src/pages/Auth.tsx\`).
2. Informa e-mail e senha; front chama \`supabase.auth.signInWithPassword\` (client em \`src/integrations/supabase/client.ts\`).
3. Supabase Auth valida credenciais e devolve sessão JWT (armazenada em localStorage pelo SDK).
4. \`AuthProvider\` (\`src/contexts/AuthContext.tsx\`) escuta \`onAuthStateChange\` e propaga \`user\` / \`session\` para o app.
5. \`ProtectedRoute\` libera as rotas internas; sem sessão, redireciona novamente para \`/auth\`.
6. Papéis são resolvidos via \`user_roles\` + função \`has_role(uid, role)\` (SECURITY DEFINER).
7. Perfil operacional é lido de \`app_users\` para nome, avatar e permissões de módulo.

**Observações:** não há sign-up anônimo, não há confirmação automática de e-mail, e o Google provider só é ativo se configurado explicitamente.

---

## 2. Financeiro (Contas a Pagar / Receber / Conciliação)

**Rota:** \`/financeiro\` (\`src/pages/Financeiro.tsx\` + subcomponentes em \`src/components/financial/\`).

**Fluxo típico de lançamento:**
1. Usuário abre o Financeiro e escolhe o período (Popover de calendário duplo, fuso America/Sao_Paulo).
2. Cria entrada em \`financial_entries\` (tipo: a_pagar / a_receber, categoria, contato, vencimento, valor com \`numeric(20,10)\`).
3. Se recorrente, sistema aplica regra de recorrência configurável e gera parcelas futuras.
4. Pagamentos parciais são registrados em tabela dedicada, mantendo desconto/juros e recalculando saldo.
5. KPIs (a vencer, vencidos, recebidos, pagos, DRE do período) são calculados no cliente sobre o dataset filtrado.
6. Entradas ligadas a pedidos são criadas automaticamente pelo módulo Operações (ver fluxo Vendas).

**Integrações:** apenas banco (Lovable Cloud). Nenhum gateway de pagamento ativo.

---

## 3. CRM (Lead → Cliente → Recorrência)

**Rota:** \`/crm\` (\`src/pages/CRM.tsx\` + \`src/components/crm/\`).

**Fluxo de atendimento:**
1. Lead entra manualmente ou via Atendimento (\`/atendimento\`), gravado em \`contacts\` + \`crm_leads\`.
2. Origem multi-canal é armazenada como JSONB ordenado (jornada de aquisição).
3. Sistema calcula **Lead Score** (4 níveis) e **prioridade** (3 tiers visuais) automaticamente.
4. Ordenação por urgência: pontuação + tempo sem resposta + agendamentos vencidos.
5. Timeline (\`crm_timeline\`) registra cada interação (mensagem, ligação, reunião, mudança de etapa) — editável e auditável.
6. Follow-ups automáticos sugerem templates 1-clique conforme inatividade.
7. Envio de WhatsApp usa deep links (\`api.whatsapp.com\` / \`wa.me\`) via \`useWhatsAppWithLog\`, que grava evento na timeline.
8. Conversão em pedido dispara fluxo bidirecional (dados do lead preenchem a venda; venda atualiza health do cliente).
9. Dashboard e listas atualizam via eventos otimistas (padrão descrito em \`crm-optimistic-sync-pattern\`).

**IA envolvida:** \`smart-whatsapp-message\` (sugestão personalizada), \`contact-summary\`, \`contact-from-media\`.

---

## 4. Atendimento Multiplataforma

**Rota:** \`/atendimento\`.

**Fluxo:**
1. Conversas ficam em \`service_conversations\` + \`service_messages\`, agrupadas por contato e plataforma.
2. Novo contato dispara \`auto_create_service_conversation\` (trigger PL/pgSQL).
3. IA classifica intenção e sugere próxima ação; agente humano confirma ou edita.
4. Toda troca é espelhada na timeline do CRM (sincronização descrita em \`atendimento-sync\`).
5. Envio efetivo ocorre via WhatsApp deep link (não há API oficial conectada ainda).

---

## 5. Estoque (Inventário Unificado)

**Rota:** \`/estoque\` / \`/operacoes\` (componentes em \`src/components/inventory/\` e \`src/components/operations/\`).

**Fluxo:**
1. Cada movimento é atômico e vinculado a um local (\`inventory_locations\`) em \`inventory_movements\`.
2. Tipos: entrada (compra/produção), saída (venda/consumo), ajuste (wizard em 4 passos), transferência entre locais.
3. Saldo por SKU/local é derivado da soma dos movimentos (nunca sobrescrito).
4. KPI global de valor de estoque calcula em tempo real usando \`numeric(20,10)\` (sem arredondamento prematuro).
5. Produção consome insumos do local configurado na OP e devolve produto acabado ao local de destino.
6. Vendas geram baixa automática ao confirmar expedição (fluxo Vendas).

---

## 6. Compras (Aquisição de Insumos)

**Fluxo atual (embutido em Operações/Financeiro):**
1. Necessidade identificada manualmente ou por produção planejada.
2. Registro do pedido de compra como entrada futura de estoque + lançamento em \`financial_entries\` (a_pagar).
3. Recebimento gera movimento de entrada em \`inventory_movements\` no local escolhido.
4. Baixa financeira ocorre no pagamento (parcial ou total) via módulo Financeiro.

**Observação:** não existe módulo "Compras" isolado — o processo é composto por Operações + Estoque + Financeiro.

---

## 7. Vendas / Pedidos

**Rota:** \`/operacoes\` (aba Pedidos) — componentes em \`src/components/operations/\`.

**Fluxo:**
1. Pedido criado a partir do CRM ou diretamente na tela de Pedidos (\`orders\` + \`order_items\`).
2. Tipo do pedido define o caminho:
   - **Estoque:** reserva imediata → separação → expedição → entrega.
   - **Produção:** gera Ordem de Produção (\`production_orders\`), consome insumos, finaliza estoque, depois expede.
3. Prioridade é calculada automaticamente em 5 níveis (data de entrega, tipo, cliente).
4. Ajustes de venda (desconto, frete) são persistidos dinamicamente nas notas do pedido.
5. Confirmação da venda cria automaticamente a entrada "A Receber" no Financeiro.
6. Ao mudar de etapa, dispara \`apply_funnel_automations\` e sincroniza health do cliente no CRM.
7. Entrega segue para o módulo Rotas quando aplicável.

---

## 8. Produção (Ordens de Produção)

**Rota:** \`/producao\` / dentro de Operações.

**Fluxo:**
1. OP criada a partir de pedido (produção) ou reposição de estoque.
2. Custo do produto usa modelo de 3 camadas: BOM + processos + logística opcional.
3. Kanban semanal permite drag-and-drop para reagendar OPs.
4. Ao iniciar, consome insumos do local configurado (\`inventory_movements\` saída).
5. Ao finalizar, gera entrada de produto acabado no local de destino.
6. Alertas visuais pulsantes indicam OPs atrasadas (\`due_date\` vencido).

---

## 9. Rotas / Entregas

**Rota:** \`/rotas\`.

**Fluxo:**
1. Pedidos prontos para expedir entram no planejador de rotas.
2. Sistema organiza paradas por proximidade e prioridade.
3. Motorista navega pelo app; comprovante de entrega é anexado no bucket \`delivery-proof\`.
4. Confirmação atualiza status do pedido e dispara baixa final se necessário.

---

## 10. Agenda / Calendário Unificado

**Rota:** \`/calendario\` / \`/agenda\`.

**Fluxo:**
1. Hub anual consolida tarefas, pedidos (entregas), reuniões, conteúdos digitais e dias sazonais.
2. Sincronização em 3 camadas para o Digital (planejado, agendado, publicado).
3. Dias sazonais recorrentes exibem preparo e urgência visual.
4. Reuniões geram roteiro estruturado, pauta e itens de ação (fluxo Reuniões).
5. Eventos alimentam a "Minha Área" filtrando por usuário ativo.

---

## 11. Digital (Marketing / Conteúdo)

**Rota:** \`/digital\`.

**Fluxo:**
1. "Ideia" estratégica é o núcleo; cada plataforma vira uma variação conectada (JSONB de campos custom).
2. Vincular uma ideia a um SKU preenche automaticamente título e mídias (padrão \`product-link-auto-fill\`).
3. Kanban de cards visuais permite ações diretas (agendar, publicar, duplicar, gerar variação com IA).
4. Agendamento multi-datas por variação; status derivado no filtro (\`platform-specific-status-logic\`).
5. IA (\`digital-content-ai\`, \`digital-trends\`, \`enhance-image\`) gera copies, tendências e melhora imagens.
6. Automações orientadas a objetivo conectam Digital ao CRM (leads gerados por campanha).

---

## 12. Rotina / Foco / Planejamento

**Rotas:** \`/rotina\`, \`/foco\`, \`/planejamento\`.

**Fluxo:**
1. **Planejamento:** drag-and-drop organiza tarefas do dia; sincroniza fila via localStorage.
2. **Foco:** consome a fila; iniciar tarefa cria \`time_entries.started_at\`; encerrar fecha o intervalo.
3. **Rotina:** Métodos de Trabalho (MT) por área, alertas globais interativos, snooze, checklists.
4. Multi-usuário: cada operador vê apenas seus alertas e rotinas (isolamento por sessão).
5. Hub central de execução integra tarefas de todos os módulos.

---

## 13. Reuniões

**Rota:** \`/reunioes\`.

**Fluxo:**
1. Criação com roteiro estruturado e pauta.
2. Durante a reunião, itens de ação são registrados e viram tarefas.
3. Sincronização com o calendário e com a "Minha Área" do participante.

---

## 14. IA (CEO IA e assistentes)

**Rota:** \`/assistente\` (e widgets embutidos em vários módulos).

**Fluxo:**
1. Usuário envia mensagem; front chama edge function \`ai-ceo\` (\`supabase/functions/ai-ceo/\`).
2. Edge function consulta o Lovable AI Gateway (\`google/gemini-2.5-flash\`) com contexto amplo.
3. Ações executáveis são gravadas em \`ai_actions\` e podem rodar em autopilot conforme \`ai_policies.max_risk\`.
4. Histórico persiste em \`ai_chat_sessions\` + \`ai_chat_messages\`; insights em \`ai_insights\`.
5. Outras edges (\`smart-whatsapp-message\`, \`contact-summary\`, etc.) seguem o mesmo padrão de gateway.

---

## 15. Núcleo (Documentação Estratégica)

**Rota:** \`/nucleo\`.

**Fluxo:**
1. Repositório oficial de conhecimento (princípios, arquitetura, estado atual, roadmap).
2. Consultado antes de qualquer novo módulo, agente ou automação.
3. Estritamente estratégico — não interfere na operação.

---

## Observações Gerais

- Todos os fluxos usam o cliente único do backend em \`src/integrations/supabase/client.ts\`.
- Datas seguem SEMPRE America/Sao_Paulo e são parseadas com \`parseISO\`; exibição em DD/MM/YYYY.
- Precisão decimal global \`numeric(20,10)\` em custos, preços e quantidades.
- RLS habilitada em todas as tabelas públicas relevantes; papéis via \`has_role\`.
- Nenhum fluxo foi alterado nesta documentação.
`;

const FLUXOS_SISTEMA_FILL_FLAG = "nucleo_estado_atual_fluxos_sistema_fill_v1";

const INTEGRACOES_CONTENT =
  "Integrações — Estado Atual\n" +
  "=========================================\n\n" +
  "Inventário das integrações existentes no Painel Central. Documento descritivo — não altera nem configura nenhuma integração.\n\n" +
  "1. Backend Principal — Lovable Cloud (Supabase)\n" +
  "-----------------------------------------\n" +
  "• Cliente único: src/integrations/supabase/client.ts (auto-gerado, não editar).\n" +
  "• Data API (PostgREST): CRUD em todas as tabelas do schema public com RLS.\n" +
  "• Realtime: canais postgres_changes em tasks, contacts, service_conversations, service_messages, digital_knowledge_base, financial_entries, entre outras.\n" +
  "• Storage: buckets públicos 'media', 'contact-avatars', 'delivery-proof'.\n" +
  "• Edge Functions (Deno) — todas em supabase/functions/, deploy gerenciado pelo Lovable Cloud.\n" +
  "• Segredos disponíveis no runtime: LOVABLE_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY(S), SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, SUPABASE_JWKS, SUPABASE_SECRET_KEYS.\n\n" +
  "2. Autenticação\n" +
  "-----------------------------------------\n" +
  "• Provider: Supabase Auth (via Lovable Cloud).\n" +
  "• Identidade de colaborador operacional consolidada em public.app_users; nunca vincular FKs diretas para auth.users.\n" +
  "• Papéis/roles: devem viver em tabela separada (padrão user_roles + has_role) — não usar profiles/contacts.\n" +
  "• Frontend: sessão obtida via supabase.auth (import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).\n" +
  "• Timezone padrão de exibição: America/Sao_Paulo.\n\n" +
  "3. Inteligência Artificial — Lovable AI Gateway\n" +
  "-----------------------------------------\n" +
  "• Endpoint único: https://ai.gateway.lovable.dev/v1/chat/completions.\n" +
  "• Header: Authorization: Bearer ${LOVABLE_API_KEY} (server-side, nunca exposto ao browser).\n" +
  "• Modelo padrão do projeto: google/gemini-2.5-flash (com variações em algumas funções).\n" +
  "• Edge Functions que chamam a IA:\n" +
  "  – ai-ceo — Assistente executivo (CEO IA); processa contexto amplo do painel, gera insights, dispara ações e sugestões.\n" +
  "  – contact-summary — Resumo automatizado do contato/lead.\n" +
  "  – contact-from-media — Extração de contato a partir de mídia (imagem/áudio).\n" +
  "  – smart-whatsapp-message — Geração personalizada de mensagens WhatsApp por contexto do cliente.\n" +
  "  – digital-content-ai — Geração de ideias, títulos, roteiros e variações de conteúdo (persona de marketing).\n" +
  "  – digital-trends — Consulta e sintetiza tendências para o módulo Digital.\n" +
  "  – enhance-image / media-enhance — Melhoria e reprocessamento de imagens/mídia.\n" +
  "• Logs de sugestões e execuções ficam em public.ai_chat_messages, ai_insights, ai_insight_messages, ai_actions, ai_policies e service_ai_logs.\n" +
  "• Governança: políticas de autopilot em ai_policies (max_risk, escopos permitidos).\n\n" +
  "4. Edge Functions (visão de integração)\n" +
  "-----------------------------------------\n" +
  "• Padrão: cada função vive em supabase/functions/<nome>/index.ts, exposta em https://<project>.supabase.co/functions/v1/<nome>.\n" +
  "• Consumo no frontend: supabase.functions.invoke('<nome>', { body }).\n" +
  "• Nenhuma função exige atualmente segredo de provider externo além de LOVABLE_API_KEY e as chaves Supabase padrão.\n\n" +
  "5. WhatsApp\n" +
  "-----------------------------------------\n" +
  "• Integração via deep links oficiais (não é API oficial da Meta/Cloud API):\n" +
  "  – Mobile: https://api.whatsapp.com/send?phone=...&text=...\n" +
  "  – Desktop: https://wa.me/<numero>?text=...\n" +
  "• Utilitários: src/lib/whatsapp.ts, src/lib/whatsappShare.ts, src/lib/whatsappTemplates.ts.\n" +
  "• Componentes: BulkWhatsAppDispatch, WhatsAppMessageSelector, WhatsAppAttachments, QuickConversationDialog.\n" +
  "• Toda ação de envio é registrada automaticamente na timeline do contato (contact_history) via useWhatsAppWithLog.\n" +
  "• Anexos: estratégia multi-tier (link, arquivo, mídia da biblioteca) — ver memória whatsapp-file-sharing-strategy.\n\n" +
  "6. Upload e Gestão de Arquivos\n" +
  "-----------------------------------------\n" +
  "• Uploads via Supabase Storage (supabase.storage.from(<bucket>).upload).\n" +
  "• Buckets em uso:\n" +
  "  – media — mídia do módulo Digital, produtos e biblioteca unificada.\n" +
  "  – contact-avatars — fotos e avatares de contatos (com AvatarCropEditor).\n" +
  "  – delivery-proof — comprovantes/assinaturas de entrega (SignaturePad, DeliveryProofDialog).\n" +
  "• Componentes centrais: MediaUploader, ProductGallery, digital media library.\n" +
  "• Download: padrão fetch-to-blob para preservar navegação (memória media-download-and-replace-pattern).\n\n" +
  "7. Atendimento Multiplataforma\n" +
  "-----------------------------------------\n" +
  "• Estrutura pronta para receber mensagens de plataformas externas via service_conversations + service_messages + digital_platforms.\n" +
  "• Vinculação automática de conversa ↔ contato (auto_link_conversation_contact) por email/telefone.\n" +
  "• Não há hoje conector oficial ativo com APIs externas (Meta/WhatsApp Business, Instagram Graph, etc.) — as mensagens externas chegam por importação/registro manual ou via IA.\n\n" +
  "8. Webhooks\n" +
  "-----------------------------------------\n" +
  "• Não há webhooks públicos expostos atualmente no Painel Central.\n" +
  "• As Edge Functions podem receber POST (comportamento HTTP normal), mas nenhum endpoint específico está configurado como webhook receiver de terceiros no momento.\n" +
  "• Automações internas rodam via triggers PL/pgSQL + tabela automation_rules (não são webhooks externos).\n\n" +
  "9. Conectores (MCP / App Connectors)\n" +
  "-----------------------------------------\n" +
  "• Nenhum MCP Connector ou App Connector externo (Slack, Notion, Gmail, Stripe, etc.) está conectado ao projeto atualmente.\n" +
  "• Quando ativados, ficam expostos ao runtime como variáveis (secret ou VITE_LOVABLE_CONNECTOR_*) e são chamados via https://connector-gateway.lovable.dev/{connector_id}/... — ver memória de integrações futuras.\n\n" +
  "10. Bibliotecas de Terceiros com papel de integração\n" +
  "-----------------------------------------\n" +
  "• @supabase/supabase-js — cliente oficial (data, auth, storage, realtime, functions).\n" +
  "• @tanstack/react-query — cache/reatividade das consultas ao backend.\n" +
  "• date-fns (+ ptBR) — parsing/format DD/MM/YYYY, respeitando America/Sao_Paulo.\n" +
  "• sonner — toasts de feedback (inclui erros de integração).\n" +
  "• framer-motion — transições da UI (não é integração externa, mas parte da camada de apresentação).\n" +
  "• react-router-dom — navegação; consumo do consent redirect e rotas /nucleo.\n\n" +
  "11. Variáveis de Ambiente Expostas ao Frontend\n" +
  "-----------------------------------------\n" +
  "• VITE_SUPABASE_URL — endpoint público do projeto.\n" +
  "• VITE_SUPABASE_PUBLISHABLE_KEY — chave anon pública.\n" +
  "• VITE_SUPABASE_PROJECT_ID — ref do projeto (para composição de URLs de auth/OAuth).\n" +
  "• Nenhuma chave server-side (LOVABLE_API_KEY, SERVICE_ROLE_KEY, DB_URL) é exposta ao browser.\n\n" +
  "12. Observações e Riscos\n" +
  "-----------------------------------------\n" +
  "• Todas as chamadas à IA passam obrigatoriamente pelo Lovable AI Gateway — não há fallback direto para OpenAI/Google/Anthropic.\n" +
  "• WhatsApp é integração por link, não API oficial: mensagens dependem do dispositivo do operador e não retornam status de entrega.\n" +
  "• Buckets de Storage são públicos; qualquer URL vazada é acessível — sensibilidade dos arquivos deve considerar isso.\n" +
  "• Antes de adicionar nova integração externa (webhook, conector, API oficial), consultar o Núcleo (Princípio Mestre) para checar alinhamento estratégico.\n\n" +
  "Documento vivo — atualize sempre que uma nova integração for adicionada, removida ou reconfigurada.";

const INTEGRACOES_FILL_FLAG = "nucleo_estado_atual_integracoes_fill_v1";

const BANCO_DE_DADOS_CONTENT =
  "Banco de Dados — Estado Atual\n" +
  "=========================================\n\n" +
  "Documento descritivo do banco de dados do Painel Central. Não altera schema, não executa migrações — apenas registra a estrutura existente para consulta.\n\n" +
  "1. Visão Geral\n" +
  "-----------------------------------------\n" +
  "• Motor: PostgreSQL gerenciado via Lovable Cloud (Supabase).\n" +
  "• Acesso do frontend: PostgREST (Data API) + Realtime, através de @/integrations/supabase/client.\n" +
  "• Segurança: RLS habilitado em todas as tabelas do schema public; políticas por tabela; funções SECURITY DEFINER para regras específicas.\n" +
  "• Armazenamento de arquivos: Supabase Storage — buckets 'media', 'contact-avatars' e 'delivery-proof' (públicos).\n" +
  "• Padrões globais: timestamps com timezone (America/Sao_Paulo na apresentação), IDs uuid (gen_random_uuid), colunas created_at/updated_at, precisão numeric(20,10) para valores monetários e quantidades.\n\n" +
  "2. Entidades Principais (agrupadas por domínio)\n" +
  "-----------------------------------------\n\n" +
  "A) Organograma / Núcleo Operacional\n" +
  "• nodes — Árvore hierárquica de nós do painel (raiz obrigatória 'Deividi' id d7c76db8-b7e0-4ce1-87ca-21275c346326). Campos típicos: title, parent_id, type, color, order_index.\n" +
  "• tasks — Tarefas vinculadas a nós. Campos: title, description, status (estrutural|andamento|pendente|concluído), node_id, dependency_id, progress, order_index, contact_id, scheduled_date, due_date, scheduled_time, assigned_to, on_hold_*.\n" +
  "• on_hold_log — Log de mudanças de status 'em espera' das tarefas.\n" +
  "• task_merge_history — Histórico de mesclagem de tarefas duplicadas.\n" +
  "• time_entries — Apontamentos de tempo por tarefa (started_at, ended_at, duration).\n" +
  "• timer_state — Estado atual do timer ativo do Foco.\n\n" +
  "B) Rotina & Metas\n" +
  "• routine_blocks — Blocos de rotina com horário, duração e vinculação a MT/template.\n" +
  "• routine_templates — Modelos reutilizáveis de rotina.\n" +
  "• routine_mts — Métodos de Trabalho (MT) por área operacional.\n" +
  "• routine_prefs — Preferências de rotina por usuário/operador.\n" +
  "• routine_stats — Estatísticas agregadas de execução.\n" +
  "• monthly_goals — Metas mensais (valor, categoria, progresso).\n" +
  "• seasonal_days — Dias sazonais recorrentes com dias de preparo e urgência.\n" +
  "• meetings, meeting_items, meeting_participants — Reuniões, pauta/itens e participantes.\n\n" +
  "C) CRM / Contatos\n" +
  "• contacts — Cadastro central de contatos (81 colunas): dados pessoais, canais (phone, whatsapp, mobile, email), endereço, funil (funnel_status), classificação (client_classification), lifetime_value, paid_orders_count, last_purchase_date, last_payment_date, ultimo_contato, is_active, photo_url, etc.\n" +
  "• contact_tags + contact_tag_assignments — Tags aplicáveis a contatos (many-to-many).\n" +
  "• contact_activities — Atividades registradas (ligações, follow-ups).\n" +
  "• contact_history — Timeline auditável de eventos (event_type, interaction_type, description, interaction_date, old_value/new_value).\n\n" +
  "D) Atendimento (Multicanal)\n" +
  "• service_conversations — Conversas por plataforma; vincula contact_id, contact_handle, funnel_stage, status, unread_count, auto_reply_enabled.\n" +
  "• service_messages — Mensagens da conversa (sender, content, is_ai_suggested, logged_to_history).\n" +
  "• service_ai_logs — Logs de sugestões/execuções de IA no atendimento.\n\n" +
  "E) Operações / Produção / Estoque\n" +
  "• products — SKUs (nome, sku, cover_image_url, price, cost, category, dimensões, peso, media_urls, is_active, deleted_at).\n" +
  "• product_categories, product_components (BOM), product_processes, product_optional_costs — Estrutura de composição do produto.\n" +
  "• processes — Cadastro de processos produtivos.\n" +
  "• production_orders + production_order_processes — Ordens de produção e etapas.\n" +
  "• production_entries, production_logs — Apontamentos de produção.\n" +
  "• production_closings + production_closing_items — Fechamentos periódicos de produção.\n" +
  "• inventory + inventory_movements — Estoque por local e movimentações atômicas.\n" +
  "• storage_locations — Locais de armazenamento.\n" +
  "• orders + order_items — Pedidos (order_number, contact_id, status, order_date, delivery_date, priority, notes).\n" +
  "• invoices — Notas fiscais associadas a pedidos/contatos.\n\n" +
  "F) Rotas / Entregas\n" +
  "• delivery_routes — Roteiros de entrega (data, motorista, status).\n" +
  "• delivery_stops — Paradas da rota com endereço, contato, comprovante, ordem.\n\n" +
  "G) Financeiro\n" +
  "• financial_accounts — Contas (caixa, banco, cartão) com saldo inicial e corrente.\n" +
  "• financial_categories — Categorias (pagar, receber, ambos).\n" +
  "• financial_entries — Lançamentos a pagar/receber; recorrência, competência, contact_id, order_id, value/value_paid, is_conciliated.\n" +
  "• financial_movements — Movimentações de pagamento por lançamento e conta (dispara triggers de saldo e value_paid).\n" +
  "• price_params, price_param_fees, price_param_history, price_fee_fields, price_channels, price_stores, price_simulations, price_simulation_items — Sistema de precificação hierárquica V2.\n\n" +
  "H) Digital / Marketing\n" +
  "• digital_platforms + digital_platform_groups — Plataformas e agrupamentos (hierárquico).\n" +
  "• digital_ideas — Ideias estratégicas (núcleo do conteúdo).\n" +
  "• digital_variations — Variações por plataforma (40 colunas, campos customizados em JSONB).\n" +
  "• digital_idea_types — Tipos configuráveis de ideia.\n" +
  "• digital_media + digital_media_folders — Biblioteca de mídia unificada.\n" +
  "• digital_templates — Templates de conteúdo.\n" +
  "• digital_interactions — Interações registradas (engajamento).\n" +
  "• digital_trends — Tendências detectadas/importadas.\n" +
  "• digital_knowledge_base — Base de FAQs por plataforma (question, answer, keywords, usage_count).\n" +
  "• posts — Posts publicados/agendados.\n\n" +
  "I) IA / Automação / Assistente\n" +
  "• ai_actions — Ações executáveis pela IA.\n" +
  "• ai_chat_messages — Histórico do chat do assistente.\n" +
  "• ai_insights + ai_insight_messages — Insights gerados e conversas relacionadas.\n" +
  "• ai_policies — Políticas de governança (max_risk, escopos).\n" +
  "• automation_rules — Regras (trigger_type, trigger_config, action_type, action_config, is_active).\n" +
  "• automation_logs — Execuções (status success|error, trigger_data, action_result).\n\n" +
  "J) Planilhas & Diversos\n" +
  "• sheets, sheet_tabs, sheet_cells — Planilhas customizadas.\n" +
  "• wizard_steps — Estado de assistentes multi-etapas.\n" +
  "• app_users — Usuários/colaboradores centralizados.\n\n" +
  "3. Chaves e Relacionamentos Estruturais\n" +
  "-----------------------------------------\n" +
  "• PK padrão: uuid gerada por gen_random_uuid().\n" +
  "• FKs principais:\n" +
  "  – tasks.node_id → nodes.id; tasks.dependency_id → tasks.id; tasks.contact_id → contacts.id.\n" +
  "  – contact_history.contact_id, contact_activities.contact_id, contact_tag_assignments.contact_id, service_conversations.contact_id, delivery_stops.contact_id, invoices.contact_id, orders.contact_id, financial_entries.contact_id → contacts.id.\n" +
  "  – contact_tag_assignments.tag_id → contact_tags.id (par único contact_id+tag_id).\n" +
  "  – service_messages.conversation_id → service_conversations.id.\n" +
  "  – order_items.order_id → orders.id; production_orders → orders/products; product_components → products (BOM).\n" +
  "  – financial_entries.category_id → financial_categories.id; financial_entries.account_id → financial_accounts.id; financial_entries.order_id → orders.id.\n" +
  "  – financial_movements.entry_id → financial_entries.id; financial_movements.account_id → financial_accounts.id.\n" +
  "  – digital_variations.idea_id → digital_ideas.id; digital_variations.platform_id → digital_platforms.id; digital_platforms.parent_id → digital_platforms.id.\n" +
  "  – sheet_tabs.sheet_id → sheets.id; sheet_cells.tab_id → sheet_tabs.id.\n" +
  "  – automation_logs.rule_id → automation_rules.id.\n" +
  "• Constraint global: NUNCA criar FK para auth.users; identidade de usuário fica em app_users.\n\n" +
  "4. Funções e Triggers\n" +
  "-----------------------------------------\n" +
  "Funções SECURITY DEFINER relevantes (schema public):\n" +
  "• update_updated_at_column / update_tasks_updated_at — Mantêm updated_at.\n" +
  "• log_service_message_to_history — Loga mensagens de atendimento na timeline do contato.\n" +
  "• update_account_balance — Ajusta saldo de financial_accounts a cada movimento.\n" +
  "• update_entry_value_paid — Recalcula value_paid do lançamento após inserção/edição/remoção de movimento.\n" +
  "• apply_funnel_automations — Executa automation_rules do tipo 'funnel_stage_changed' (cria tarefa, muda estágio, alerta).\n" +
  "• sync_funnel_contact_to_conversations / sync_funnel_conversation_to_contact — Sincronizam funil entre contatos e conversas.\n" +
  "• map_conv_to_contact_funnel / map_contact_to_conv_funnel — Mapeiam estágios entre os dois vocabulários.\n" +
  "• sync_contact_on_order_change — Atualiza classificação e datas de compra quando pedido é entregue/cancelado.\n" +
  "• sync_contact_on_payment — Incrementa lifetime_value, paid_orders_count e promove a VIP quando pagamento é confirmado.\n" +
  "• sync_contact_to_service_conversations — Propaga edições do contato para conversas.\n" +
  "• auto_create_service_conversation — Cria conversa automaticamente para novos contatos ativos.\n" +
  "• auto_link_conversation_contact — Vincula conversa a contato existente por email/telefone.\n" +
  "• merge_contacts(primary_id, duplicate_id) — Mescla contatos, reapontando FKs e agregando métricas.\n" +
  "• create_default_sheet_tab — Cria aba padrão em nova planilha.\n\n" +
  "5. Segurança (RLS) e Acessos\n" +
  "-----------------------------------------\n" +
  "• Todas as tabelas do schema public têm RLS habilitado e ao menos uma política ativa.\n" +
  "• GRANTs explícitos por tabela para authenticated e service_role; anon apenas quando a política permite leitura pública.\n" +
  "• Funções sensíveis marcadas com SECURITY DEFINER + search_path = public para evitar escalonamento via schema hijacking.\n" +
  "• Papéis de usuário devem ficar sempre em tabela separada (padrão user_roles + has_role), nunca em profiles/contacts.\n\n" +
  "6. Storage (Buckets)\n" +
  "-----------------------------------------\n" +
  "• media — Mídia geral do Digital e produtos (público).\n" +
  "• contact-avatars — Avatares e fotos de contatos (público).\n" +
  "• delivery-proof — Comprovantes/assinaturas de entrega (público).\n\n" +
  "7. Realtime\n" +
  "-----------------------------------------\n" +
  "Canais postgres_changes usados no frontend para: tasks, contacts, service_conversations, service_messages, digital_knowledge_base, financial_entries, entre outros — mantendo listas e painéis reativos sem refetch manual.\n\n" +
  "8. Convenções e Restrições Globais\n" +
  "-----------------------------------------\n" +
  "• Precisão numeric(20,10) para custos, preços e quantidades — nunca arredondar prematuramente.\n" +
  "• Datas armazenadas como YYYY-MM-DD ou timestamptz; exibição sempre DD/MM/YYYY em America/Sao_Paulo.\n" +
  "• Nunca alterar schemas auth/storage/realtime/supabase_functions/vault.\n" +
  "• Nunca editar src/integrations/supabase/client.ts nem types.ts (gerados).\n" +
  "• Toda nova tabela em public exige: CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY, nessa ordem.\n\n" +
  "Documento vivo — atualize sempre que novas tabelas, funções ou políticas forem criadas.";

const BANCO_DE_DADOS_FILL_FLAG = "nucleo_estado_atual_banco_de_dados_fill_v1";


const BIBLIOTECA_SEED: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Princípio Mestre do Painel Central",
    tags: ["princípio", "mestre", "governança", "ia"],
    content:
      "Princípio Mestre do Painel Central\n\n" +
      "O Núcleo do Painel Central é a fonte oficial de conhecimento da plataforma.\n\n" +
      "Antes de desenvolver novas funcionalidades, módulos, agentes de IA, automações ou alterações, a Inteligência Artificial deverá consultar o Núcleo para verificar se a proposta está alinhada com a filosofia, a arquitetura e as diretrizes do projeto.\n\n" +
      "Escopo do Núcleo\n" +
      "— Área estratégica e administrativa.\n" +
      "— Orienta a evolução da plataforma e o comportamento da Inteligência Artificial.\n" +
      "— Não interfere no funcionamento operacional do Painel Central.\n\n" +
      "Compromisso da Inteligência Artificial\n" +
      "— Continua executando normalmente todas as tarefas solicitadas pelos usuários.\n" +
      "— Usa o Núcleo como contexto, regras e base de conhecimento para manter consistência com a identidade do projeto.\n" +
      "— Ao identificar conflito entre um pedido e o Núcleo, sinaliza o conflito antes de prosseguir.\n\n" +
      "Áreas de consulta\n" +
      "• Biblioteca do Projeto — Cartas fundadoras (Teoria, Manifesto, Constituição, Consciência, Filosofia, Arquitetura).\n" +
      "• Consciência — Diretrizes operacionais, memória, aprendizagem, personalidade, regras, especialistas.\n" +
      "• Arquitetura — Módulos, agentes de IA, banco de dados, fluxos, APIs, integrações, estrutura da plataforma.\n" +
      "• Evolução do Projeto — Roadmap, melhorias, ideias, decisões importantes, histórico de alterações.",
  },
  {
    title: "Carta Zero — A Teoria do Painel Central",
    tags: ["carta", "teoria", "fundamento"],
    content:
      "Carta Zero — A Teoria do Painel Central\n\n" +
      "Documento fundacional que apresenta a teoria por trás do Painel Central: a razão de existir, o problema que resolve e a visão que sustenta todo o sistema.\n\n" +
      "— Escreva aqui a teoria completa.",
  },
  {
    title: "Carta I — Manifesto",
    tags: ["carta", "manifesto"],
    content:
      "Carta I — Manifesto\n\n" +
      "Declaração pública dos princípios, crenças e compromissos que guiam o Painel Central.\n\n" +
      "— Escreva aqui o manifesto.",
  },
  {
    title: "Carta II — Constituição",
    tags: ["carta", "constituição", "regras"],
    content:
      "Carta II — Constituição\n\n" +
      "Conjunto de regras, direitos e deveres que estruturam o funcionamento do Painel Central.\n\n" +
      "— Escreva aqui a constituição.",
  },
  {
    title: "Carta III — Consciência",
    tags: ["carta", "consciência"],
    content:
      "Carta III — Consciência\n\n" +
      "Reflexão sobre a consciência do sistema: propósito, autopercepção e responsabilidade.\n\n" +
      "— Escreva aqui a carta da consciência.",
  },
  {
    title: "Carta IV — Filosofia da Experiência",
    tags: ["carta", "filosofia", "experiência"],
    content:
      "Carta IV — Filosofia da Experiência\n\n" +
      "Como o Painel Central entende, projeta e entrega experiência ao usuário.\n\n" +
      "— Escreva aqui a filosofia da experiência.",
  },
  {
    title: "Carta V — Arquitetura da Inteligência",
    tags: ["carta", "arquitetura", "inteligência"],
    content:
      "Carta V — Arquitetura da Inteligência\n\n" +
      "Como a inteligência do sistema é estruturada: dados, decisões, automações e IA.\n\n" +
      "— Escreva aqui a arquitetura da inteligência.",
  },
];

// ---------- Persistence ----------

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadPages(): DocPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let pages: DocPage[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        pages = parsed.map((p) => ({
          ...p,
          versions: Array.isArray(p.versions) ? p.versions : [],
          tags: Array.isArray(p.tags) ? p.tags : [],
        }));
      }
    }
    // Seed biblioteca once
    if (!localStorage.getItem(SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "biblioteca").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = BIBLIOTECA_SEED.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "biblioteca",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...seeded, ...pages];
      localStorage.setItem(SEED_FLAG_KEY, "1");
    }
    // Seed consciência once
    if (!localStorage.getItem(CONSCIENCIA_SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "consciencia").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = CONSCIENCIA_SEED.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "consciencia",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...seeded, ...pages];
      localStorage.setItem(CONSCIENCIA_SEED_FLAG_KEY, "1");
    }
    // Seed arquitetura once
    if (!localStorage.getItem(ARQUITETURA_SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "arquitetura").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = ARQUITETURA_SEED.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "arquitetura",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...seeded, ...pages];
      localStorage.setItem(ARQUITETURA_SEED_FLAG_KEY, "1");
    }
    // Seed evolução once
    if (!localStorage.getItem(EVOLUCAO_SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "evolucao").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = EVOLUCAO_SEED.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "evolucao",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...seeded, ...pages];
      localStorage.setItem(EVOLUCAO_SEED_FLAG_KEY, "1");
    }
    // Seed estado atual do sistema once
    if (!localStorage.getItem(ESTADO_ATUAL_SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "estado-atual").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = ESTADO_ATUAL_TITLES.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "estado-atual",
        title: s.title,
        content: "",
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...pages, ...seeded];
      localStorage.setItem(ESTADO_ATUAL_SEED_FLAG_KEY, "1");
    }
    // Fill "Mapa Geral do Sistema" content once (safe: only if page is empty)
    if (!localStorage.getItem(MAPA_GERAL_FILL_FLAG)) {
      const now = new Date().toISOString();
      let mapaExists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Mapa Geral do Sistema") {
          mapaExists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: MAPA_GERAL_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!mapaExists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Mapa Geral do Sistema",
            content: MAPA_GERAL_CONTENT,
            tags: ["mapa", "visão-geral"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(MAPA_GERAL_FILL_FLAG, "1");
    }
    // Fill "Arquitetura Atual" content once (safe: only if page is empty)
    if (!localStorage.getItem(ARQUITETURA_ATUAL_FILL_FLAG)) {
      const now = new Date().toISOString();
      let exists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Arquitetura Atual") {
          exists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: ARQUITETURA_ATUAL_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!exists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Arquitetura Atual",
            content: ARQUITETURA_ATUAL_CONTENT,
            tags: ["arquitetura", "atual"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(ARQUITETURA_ATUAL_FILL_FLAG, "1");
    }
    // Fill "Banco de Dados" content once (safe: only if page is empty)
    if (!localStorage.getItem(BANCO_DE_DADOS_FILL_FLAG)) {
      const now = new Date().toISOString();
      let exists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Banco de Dados") {
          exists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: BANCO_DE_DADOS_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!exists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Banco de Dados",
            content: BANCO_DE_DADOS_CONTENT,
            tags: ["banco", "dados", "schema"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(BANCO_DE_DADOS_FILL_FLAG, "1");
    }
    // Fill "Integrações" content once (safe: only if page is empty)
    if (!localStorage.getItem(INTEGRACOES_FILL_FLAG)) {
      const now = new Date().toISOString();
      let exists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Integrações") {
          exists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: INTEGRACOES_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!exists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Integrações",
            content: INTEGRACOES_CONTENT,
            tags: ["integrações", "apis", "serviços"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(INTEGRACOES_FILL_FLAG, "1");
    }
    // Fill "Agentes de IA" content once (safe: only if page is empty)
    if (!localStorage.getItem(AGENTES_IA_FILL_FLAG)) {
      const now = new Date().toISOString();
      let exists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Agentes de IA") {
          exists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: AGENTES_IA_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!exists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Agentes de IA",
            content: AGENTES_IA_CONTENT,
            tags: ["ia", "agentes", "edge-functions"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(AGENTES_IA_FILL_FLAG, "1");
    }
    // Fill "Fluxos do Sistema" content once (safe: only if page is empty)
    if (!localStorage.getItem(FLUXOS_SISTEMA_FILL_FLAG)) {
      const now = new Date().toISOString();
      let exists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Fluxos do Sistema") {
          exists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: FLUXOS_SISTEMA_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!exists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Fluxos do Sistema",
            content: FLUXOS_SISTEMA_CONTENT,
            tags: ["fluxos", "processos", "operação"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(FLUXOS_SISTEMA_FILL_FLAG, "1");
    }





    // Seed Princípio Mestre once (independent flag so existing installs also receive it)
    const PRINCIPIO_FLAG = "nucleo_principio_mestre_seed_v1";
    if (!localStorage.getItem(PRINCIPIO_FLAG)) {
      const title = "Princípio Mestre do Painel Central";
      const already = pages.some(
        (p) => p.areaId === "biblioteca" && p.title === title
      );
      if (!already) {
        const seedDef = BIBLIOTECA_SEED.find((s) => s.title === title);
        if (seedDef) {
          const now = new Date().toISOString();
          pages = [
            {
              id: uid(),
              areaId: "biblioteca",
              title: seedDef.title,
              content: seedDef.content,
              tags: seedDef.tags,
              createdAt: now,
              updatedAt: now,
              versions: [],
            },
            ...pages,
          ];
        }
      }
      localStorage.setItem(PRINCIPIO_FLAG, "1");
    }
    return pages;
  } catch {
    return [];
  }
}

function savePages(pages: DocPage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ---------- Component ----------

export default function Nucleo() {
  const [pages, setPages] = useState<DocPage[]>(loadPages);
  const [activeArea, setActiveArea] = useState<AreaId>("biblioteca");
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    savePages(pages);
  }, [pages]);

  const activeAreaMeta = AREAS.find((a) => a.id === activeArea)!;

  const areaPages = useMemo(
    () =>
      pages
        .filter((p) => p.areaId === activeArea)
        .filter((p) =>
          search.trim()
            ? (p.title + " " + p.content + " " + p.tags.join(" "))
                .toLowerCase()
                .includes(search.toLowerCase())
            : true
        )
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [pages, activeArea, search]
  );

  const activePage = pages.find((p) => p.id === activePageId) || null;

  const countByArea = useMemo(() => {
    const m = new Map<AreaId, number>();
    pages.forEach((p) => m.set(p.areaId, (m.get(p.areaId) || 0) + 1));
    return m;
  }, [pages]);

  const createPage = () => {
    const now = new Date().toISOString();
    const page: DocPage = {
      id: uid(),
      areaId: activeArea,
      title: "Nova página",
      content: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
      versions: [],
    };
    setPages((prev) => [page, ...prev]);
    setActivePageId(page.id);
    toast.success("Página criada");
  };

  const updatePage = (id: string, patch: Partial<DocPage>) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
      )
    );
  };

  const deletePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    if (activePageId === id) setActivePageId(null);
    toast.success("Página excluída");
  };

  const saveVersion = (id: string, label?: string) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const version: PageVersion = {
          id: uid(),
          title: p.title,
          content: p.content,
          createdAt: new Date().toISOString(),
          label,
        };
        return { ...p, versions: [version, ...p.versions] };
      })
    );
    toast.success("Versão salva");
  };

  const restoreVersion = (id: string, versionId: string) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const v = p.versions.find((x) => x.id === versionId);
        if (!v) return p;
        // Snapshot current before restoring
        const snapshot: PageVersion = {
          id: uid(),
          title: p.title,
          content: p.content,
          createdAt: new Date().toISOString(),
          label: "auto — antes de restaurar",
        };
        return {
          ...p,
          title: v.title,
          content: v.content,
          updatedAt: new Date().toISOString(),
          versions: [snapshot, ...p.versions],
        };
      })
    );
    toast.success("Versão restaurada");
  };

  const deleteVersion = (id: string, versionId: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, versions: p.versions.filter((v) => v.id !== versionId) }
          : p
      )
    );
  };

  const selectArea = (id: AreaId) => {
    setActiveArea(id);
    setActivePageId(null);
    setSearch("");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header
        className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate">
                Núcleo do Painel Central
              </h1>
              <Badge variant="secondary" className="text-[10px]">
                Área administrativa
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Base estratégica e documental do sistema
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Areas grid */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {AREAS.map((a) => {
            const Icon = a.icon;
            const isActive = a.id === activeArea;
            const count = countByArea.get(a.id) || 0;
            return (
              <button
                key={a.id}
                onClick={() => selectArea(a.id)}
                className={cn(
                  "text-left rounded-xl border p-3 transition-all bg-card hover:border-primary/40 hover:shadow-sm",
                  isActive
                    ? "border-primary/60 shadow-sm ring-1 ring-primary/20"
                    : "border-border"
                )}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: a.color + "1F",
                      color: a.color,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold truncate">
                        {a.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                      {a.description}
                    </p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-[10px]">
                        {count} {count === 1 ? "página" : "páginas"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Workspace */}
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Pages list */}
          <Card className="p-3 flex flex-col min-h-[420px]">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: activeAreaMeta.color + "1F",
                  color: activeAreaMeta.color,
                }}
              >
                <activeAreaMeta.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold truncate">
                  {activeAreaMeta.title}
                </h2>
                <p className="text-[11px] text-muted-foreground truncate">
                  {areaPages.length} {areaPages.length === 1 ? "página" : "páginas"}
                </p>
              </div>
              <Button size="sm" onClick={createPage} className="gap-1">
                <Plus className="h-4 w-4" />
                Nova
              </Button>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 h-8 text-sm"
              />
            </div>

            <ScrollArea className="flex-1 -mx-1">
              <div className="px-1 space-y-1">
                {areaPages.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">Nenhuma página ainda</p>
                    <p className="text-[11px] opacity-70">
                      Clique em "Nova" para começar
                    </p>
                  </div>
                )}
                {areaPages.map((p) => {
                  const isActive = p.id === activePageId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActivePageId(p.id)}
                      className={cn(
                        "w-full text-left rounded-lg border px-3 py-2 transition-colors group",
                        isActive
                          ? "border-primary/50 bg-accent"
                          : "border-transparent hover:bg-accent/60"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {p.title || "Sem título"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {formatDate(p.updatedAt)}
                            {p.versions.length > 0 &&
                              ` · v${p.versions.length}`}
                            {p.tags.length > 0 &&
                              ` · ${p.tags.slice(0, 2).join(", ")}`}
                          </p>
                        </div>
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 text-muted-foreground transition-opacity",
                            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                          )}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>

          {/* Editor */}
          <Card className="p-4 min-h-[420px]">
            {!activePage ? (
              <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center">
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3"
                  style={{
                    backgroundColor: activeAreaMeta.color + "1F",
                    color: activeAreaMeta.color,
                  }}
                >
                  <activeAreaMeta.icon className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold">
                  {activeAreaMeta.title}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  {activeAreaMeta.description}
                </p>
                <Button
                  className="mt-4 gap-1.5"
                  onClick={createPage}
                >
                  <Plus className="h-4 w-4" />
                  Criar primeira página
                </Button>
              </div>
            ) : (
              <PageEditor
                key={activePage.id}
                page={activePage}
                onChange={(patch) => updatePage(activePage.id, patch)}
                onDelete={() => deletePage(activePage.id)}
                onSaveVersion={(label) => saveVersion(activePage.id, label)}
                onRestoreVersion={(vid) => restoreVersion(activePage.id, vid)}
                onDeleteVersion={(vid) => deleteVersion(activePage.id, vid)}
                areaColor={activeAreaMeta.color}
              />
            )}
          </Card>
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-1">
          Estrutura preparada para crescimento — sem integrações ativas com
          outros módulos.
        </p>
      </main>
    </div>
  );
}

// ---------- Page Editor ----------

interface PageEditorProps {
  page: DocPage;
  onChange: (patch: Partial<DocPage>) => void;
  onDelete: () => void;
  onSaveVersion: (label?: string) => void;
  onRestoreVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
  areaColor: string;
}

function PageEditor({
  page,
  onChange,
  onDelete,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
  areaColor,
}: PageEditorProps) {
  const [tagInput, setTagInput] = useState("");
  const [versionLabel, setVersionLabel] = useState("");

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (page.tags.includes(t)) {
      setTagInput("");
      return;
    }
    onChange({ tags: [...page.tags, t] });
    setTagInput("");
  };

  const removeTag = (t: string) => {
    onChange({ tags: page.tags.filter((x) => x !== t) });
  };

  const handleSaveVersion = () => {
    onSaveVersion(versionLabel.trim() || undefined);
    setVersionLabel("");
  };

  return (
    <div className="flex flex-col h-full min-h-[380px]">
      <div className="flex items-center gap-2 mb-3">
        <Input
          value={page.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Título da página"
          className="text-base font-semibold border-0 shadow-none px-0 h-auto py-1 focus-visible:ring-0"
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 shrink-0">
              <History className="h-4 w-4" />
              <span className="text-xs">
                {page.versions.length > 0
                  ? `${page.versions.length} versões`
                  : "Versões"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="end">
            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold">Salvar versão</p>
                <p className="text-[11px] text-muted-foreground">
                  Cria um snapshot do conteúdo atual.
                </p>
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  placeholder="Rótulo (opcional)"
                  className="h-8 text-xs"
                />
                <Button size="sm" onClick={handleSaveVersion} className="gap-1">
                  <Save className="h-3.5 w-3.5" />
                  Salvar
                </Button>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs font-semibold mb-1.5">Histórico</p>
                {page.versions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-3 text-center">
                    Nenhuma versão salva ainda.
                  </p>
                ) : (
                  <ScrollArea className="max-h-64 -mx-1">
                    <div className="px-1 space-y-1">
                      {page.versions.map((v, idx) => (
                        <div
                          key={v.id}
                          className="rounded border border-border p-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">
                                v{page.versions.length - idx}
                                {v.label ? ` — ${v.label}` : ""}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatDateTime(v.createdAt)}
                              </p>
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                title="Restaurar"
                                onClick={() => onRestoreVersion(v.id)}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                title="Excluir versão"
                                onClick={() => onDeleteVersion(v.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                            {v.content.slice(0, 120) || "(vazio)"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
        <span>Criada em {formatDate(page.createdAt)}</span>
        <span>·</span>
        <span>Atualizada em {formatDate(page.updatedAt)}</span>
        {page.versions.length > 0 && (
          <>
            <span>·</span>
            <span>{page.versions.length} versões</span>
          </>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {page.tags.map((t) => (
          <Badge
            key={t}
            variant="secondary"
            className="text-[10px] gap-1 cursor-pointer"
            onClick={() => removeTag(t)}
          >
            {t}
            <span className="opacity-60">×</span>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="+ tag"
            className="h-6 w-24 text-[11px] px-2"
          />
        </div>
      </div>

      <div
        className="h-0.5 w-12 rounded-full mb-3"
        style={{ backgroundColor: areaColor }}
      />

      <Textarea
        value={page.content}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder="Escreva o conteúdo desta página..."
        className="flex-1 min-h-[280px] resize-none text-sm leading-relaxed"
      />

      <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
        <span>{page.content.length} caracteres</span>
        <span className="flex items-center gap-1">
          <Save className="h-3 w-3" />
          Salvamento automático
        </span>
      </div>
    </div>
  );
}
