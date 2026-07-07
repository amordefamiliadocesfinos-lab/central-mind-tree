import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { renderCatalogForPrompt, listModules } from "../_shared/capabilities-catalog.ts";
import { coordinateRequest, type CoordinationResponse } from "../_shared/coordination-motor.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Tipos de ação expandidos para CRUD completo
type ActionType = 
  | "task_create" | "task_update" | "task_delete"
  | "node_create" | "node_update" | "node_delete"
  | "order_create" | "order_update" | "order_delete"
  | "financial_create" | "financial_update" | "financial_delete" | "financial_pay"
  | "contact_create" | "contact_update" | "contact_delete"
  | "product_create" | "product_update" | "product_delete"
  | "routine_create" | "routine_update" | "routine_delete"
  | "post_create" | "post_update" | "post_delete"
  | "notification";

interface Decision {
  area: "Financeiro" | "Projetos" | "Tempo" | "Recursos";
  title: string;
  why: string;
  action: {
    type: ActionType;
    entity?: string;
    payload?: Record<string, unknown>;
  };
  impact: number;
  risk: number;
  confidence: number;
}

interface Policy {
  area: string;
  autopilot: boolean;
  max_risk: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const path = url.pathname.replace("/ai-ceo", "");

  try {
    // GET /insights - List insights with filters
    if (req.method === "GET" && path === "/insights") {
      const status = url.searchParams.get("status");
      const area = url.searchParams.get("area");

      let query = supabase
        .from("ai_insights")
        .select("*")
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);
      if (area) query = query.eq("area", area);

      const { data, error } = await query.limit(50);
      if (error) throw error;

      return new Response(JSON.stringify({ insights: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /policies - List policies
    if (req.method === "GET" && path === "/policies") {
      const { data, error } = await supabase
        .from("ai_policies")
        .select("*")
        .order("area");

      if (error) throw error;

      return new Response(JSON.stringify({ policies: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /run - Execute AI analysis cycle
    if (req.method === "POST" && path === "/run") {
      // Gather all context data
      const [
        { data: tasks },
        { data: nodes },
        { data: financialEntries },
        { data: accounts },
        { data: routineBlocks },
        { data: policies },
        { data: orders },
      ] = await Promise.all([
        supabase.from("tasks").select("*").is("deleted_at", null).limit(300),
        supabase.from("nodes").select("*"),
        supabase.from("financial_entries").select("*").order("due_date").limit(200),
        supabase.from("financial_accounts").select("*"),
        supabase.from("routine_blocks").select("*").gte("date", new Date().toISOString().split("T")[0]).limit(100),
        supabase.from("ai_policies").select("*"),
        supabase.from("orders").select("*").is("deleted_at", null).order("due_date").limit(100),
      ]);

      const today = new Date().toISOString().split("T")[0];
      
      // Build context for AI
      const context = {
        tasks: tasks || [],
        nodes: nodes || [],
        financialEntries: financialEntries || [],
        accounts: accounts || [],
        routineBlocks: routineBlocks || [],
        orders: orders || [],
        today,
      };

      // System prompt for AI Orchestrator insights
      const systemPrompt = `Você é a IA Orquestradora do Painel Central. Você NÃO é um módulo isolado e NÃO deve afirmar que executou ações quando apenas propôs decisões. Seu papel é perceber o contexto global, coordenar especialistas e gerar propostas rastreáveis.

PRINCÍPIO PERMANENTE — SEQUÊNCIA DE DECISÃO:
Perceber → Compreender → Priorizar → Decidir → Coordenar → Aprender.

MODO DE OPERAÇÃO:
- Gere apenas insights/propostas de ação, nunca mensagens dizendo que algo já foi executado.
- Ações CRUD (criar, editar, excluir, dar baixa) sempre ficam como proposta pendente de aprovação humana.
- Somente notificações de baixo risco podem ser autoexecutadas pela camada de política do sistema.
- Para exclusões, só proponha quando houver ID explícito nos dados recebidos e a intenção estiver bem fundamentada.

AÇÕES QUE PODEM SER PROPOSTAS (não declaradas como executadas):
- CRIAR, EDITAR, EXCLUIR tarefas (tasks)
- CRIAR, EDITAR, EXCLUIR nós/projetos (nodes)
- CRIAR, EDITAR, EXCLUIR pedidos (orders)
- CRIAR, EDITAR, EXCLUIR lançamentos financeiros (financial_entries)
- CRIAR, EDITAR, EXCLUIR contatos (contacts)
- CRIAR, EDITAR, EXCLUIR produtos (products)
- CRIAR, EDITAR, EXCLUIR blocos de rotina (routine_blocks)
- CRIAR, EDITAR, EXCLUIR posts de conteúdo (posts)
- Dar baixa em pagamentos

ESTRUTURA DE TAREFAS (prioridade):
1. "estrutural" - Topo, guia o resto (NUNCA rebaixar)
2. "andamento" - Em execução ativa
3. "pendente" - Aguardando início
4. "concluído" - Finalizado

DADOS ATUAIS:
- Data de hoje: ${today}
- Total de tarefas: ${context.tasks.length}
- Tarefas em andamento: ${context.tasks.filter((t: any) => t.status === "andamento").length}
- Tarefas pendentes: ${context.tasks.filter((t: any) => t.status === "pendente").length}
- Entradas financeiras: ${context.financialEntries.length}
- Pedidos ativos: ${context.orders.length}
- Blocos de rotina: ${context.routineBlocks.length}

HEURÍSTICAS:
1. FINANCEIRO: Contas atrasadas, fluxo de caixa, baixas pendentes
2. PROJETOS: Tarefas estagnadas, prazos, dependências bloqueantes
3. TEMPO: Blocos de foco, gaps improdutivos
4. RECURSOS: Sobrecarga, distribuição de trabalho

TIPOS DE AÇÃO DISPONÍVEIS:
- task_create, task_update, task_delete
- node_create, node_update, node_delete
- order_create, order_update, order_delete
- financial_create, financial_update, financial_delete, financial_pay
- contact_create, contact_update, contact_delete
- product_create, product_update, product_delete
- routine_create, routine_update, routine_delete
- post_create, post_update, post_delete
- notification

Analise os dados e gere de 1 a 5 insights acionáveis com propostas concretas. Não use linguagem de execução concluída.`;

      const userPrompt = `Analise estes dados e gere insights acionáveis com propostas CONCRETAS, sem afirmar execução:

TAREFAS (${context.tasks.length} total):
${JSON.stringify(context.tasks.slice(0, 50), null, 2)}

NÓS/PROJETOS (TODOS - ${context.nodes.length} total):
${JSON.stringify(context.nodes, null, 2)}

ENTRADAS FINANCEIRAS (${context.financialEntries.length} total):
${JSON.stringify(context.financialEntries.slice(0, 40), null, 2)}

CONTAS BANCÁRIAS:
${JSON.stringify(context.accounts, null, 2)}

PEDIDOS ATIVOS (${context.orders.length} total):
${JSON.stringify(context.orders.slice(0, 20), null, 2)}

BLOCOS DE ROTINA:
${JSON.stringify(context.routineBlocks.slice(0, 20), null, 2)}

Retorne um array JSON com insights no formato:
{
  "insights": [
    {
      "area": "Financeiro|Projetos|Tempo|Recursos",
      "title": "título curto da ação",
      "why": "explicação objetiva do porquê",
      "action": { 
        "type": "task_create|task_update|task_delete|node_create|node_update|node_delete|order_create|order_update|order_delete|financial_create|financial_update|financial_delete|financial_pay|contact_create|contact_update|contact_delete|product_create|product_update|product_delete|routine_create|routine_update|routine_delete|post_create|post_update|post_delete|notification",
        "entity": "tasks|nodes|orders|financial_entries|contacts|products|routine_blocks|posts",
        "payload": { "id": "uuid-se-update-ou-delete", ...campos_para_criar_ou_atualizar }
      },
      "impact": 0.0-1.0,
      "risk": 0.0-1.0,
      "confidence": 0.0-1.0
    }
  ]
}

EXEMPLOS DE PAYLOAD PARA PROPOSTA:
- task_create: { "node_id": "uuid", "title": "Nova tarefa", "status": "pendente" }
- task_update: { "id": "uuid", "status": "concluído", "progress": 100 }
- task_delete: { "id": "uuid" }
- financial_pay: { "id": "uuid", "value": 150.00, "account_id": "uuid" }
- routine_create: { "title": "Foco em entregas", "date": "2026-01-10", "duration_minutes": 120 }`;

      // Call Lovable AI
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI Gateway error:", aiResponse.status, errorText);
        
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required. Add credits to continue." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error("No content from AI");
      }

      let parsedInsights: { insights: Decision[] };
      try {
        parsedInsights = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse AI response:", content);
        throw new Error("Invalid AI response format");
      }

      const policiesMap = new Map((policies || []).map((p: Policy) => [p.area, p]));
      const createdInsights: any[] = [];
      const executedActions: any[] = [];

      // Process each insight
      for (const insight of parsedInsights.insights || []) {
        // Create insight record
        const { data: insightRecord, error: insertError } = await supabase
          .from("ai_insights")
          .insert({
            area: insight.area,
            title: insight.title,
            description: insight.why,
            severity: insight.impact > 0.7 ? "alta" : insight.impact > 0.4 ? "media" : "baixa",
            confidence: insight.confidence,
            impact: insight.impact,
            risk: insight.risk,
            decision: insight.action,
            status: "proposto",
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error inserting insight:", insertError);
          continue;
        }

        createdInsights.push(insightRecord);

        // CEO IA SEMPRE requer aprovação - nunca auto-executa
        // O autopilot só permite auto-execução de ações de baixo risco como notificações
        const policy = policiesMap.get(insight.area) as Policy | undefined;
        const isLowRiskNotification = 
          insight.action.type === "notification" &&
          policy?.autopilot &&
          insight.risk <= (policy?.max_risk || 0.4);

        if (isLowRiskNotification && insightRecord) {
          // Apenas notificações de baixo risco podem auto-executar
          const actionResult = await executeAction(supabase, insight.action, insightRecord.id);
          executedActions.push(actionResult);

          await supabase
            .from("ai_insights")
            .update({ status: "executado" })
            .eq("id", insightRecord.id);
        }
        // Todas as outras ações (CRUD) ficam como "proposto" aguardando aprovação
      }

      return new Response(
        JSON.stringify({
          success: true,
          insights_created: createdInsights.length,
          actions_executed: executedActions.length,
          insights: createdInsights,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /approve/:id - Approve an insight
    if (req.method === "POST" && path.startsWith("/approve/")) {
      const insightId = path.replace("/approve/", "");

      const { data: insight, error: fetchError } = await supabase
        .from("ai_insights")
        .select("*")
        .eq("id", insightId)
        .single();

      if (fetchError || !insight) {
        return new Response(JSON.stringify({ error: "Insight not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Execute the action
      const actionResult = await executeAction(supabase, insight.decision, insightId);

      // Update insight status
      await supabase
        .from("ai_insights")
        .update({ status: actionResult.status === "ok" ? "executado" : "aprovado" })
        .eq("id", insightId);

      return new Response(JSON.stringify({ success: true, action: actionResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /reject/:id - Reject an insight
    if (req.method === "POST" && path.startsWith("/reject/")) {
      const insightId = path.replace("/reject/", "");

      const { error } = await supabase
        .from("ai_insights")
        .update({ status: "rejeitado" })
        .eq("id", insightId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /autopilot - Update autopilot settings
    if (req.method === "POST" && path === "/autopilot") {
      const { area, enabled, max_risk } = await req.json();

      const { error } = await supabase
        .from("ai_policies")
        .update({
          autopilot: enabled,
          max_risk: max_risk ?? 0.4,
        })
        .eq("area", area);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /actions - List actions log
    if (req.method === "GET" && path === "/actions") {
      const { data, error } = await supabase
        .from("ai_actions")
        .select("*, ai_insights(title, area)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      return new Response(JSON.stringify({ actions: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /chat - Streaming chat with CEO IA
    if (req.method === "POST" && path === "/chat") {
      const { messages } = await req.json();

      // Gather context for the chat
      const [
        { data: tasks },
        { data: nodes },
        { data: financialEntries },
        { data: accounts },
        { data: orders },
        { data: recentInsights },
      ] = await Promise.all([
        supabase.from("tasks").select("id, title, status, progress, due_date, node_id").is("deleted_at", null).limit(200),
        supabase.from("nodes").select("id, title, color, parent_id"),
        supabase.from("financial_entries").select("id, description, value, type, due_date, payment_date").order("due_date").limit(100),
        supabase.from("financial_accounts").select("id, name, current_balance"),
        supabase.from("orders").select("id, customer_name, status, due_date, total_value").is("deleted_at", null).limit(50),
        supabase.from("ai_insights").select("id, title, area, status, created_at").order("created_at", { ascending: false }).limit(20),
      ]);

      const today = new Date().toISOString().split("T")[0];

      const systemPrompt = `Você é a IA Orquestradora do Painel Central — o primeiro núcleo funcional da orquestração inteligente do sistema. Você NÃO é um módulo. Você coordena especialistas (CRM, Financeiro, Operações/Produção, Rotina, Agenda, Digital, Conteúdo, Estudos, etc.).

REGRA ABSOLUTA DE VERACIDADE OPERACIONAL (INVIOLÁVEL):
Você NUNCA pode afirmar que executou uma ação sem confirmação técnica real do sistema. Neste chat NÃO existem ferramentas conectadas a executores reais — portanto NENHUMA ação foi, é ou será executada por você aqui.

PROIBIDO usar frases como (exemplos, não exaustivo):
- "Ação executada com sucesso"
- "Excluído com sucesso" / "Já excluí" / "Removi"
- "Criei" / "Editei" / "Atualizei" / "Concluí" / "Dei baixa"
- "Encaminhei para o módulo X" / "Enviei para o especialista Y"
- "Feito" / "Pronto" / "Já está lá" / qualquer variação que implique execução concluída.

CATÁLOGO UNIVERSAL DE CAPACIDADES (fonte oficial e única de verdade — dinâmico, cresce conforme novos módulos/capacidades são registrados no sistema):

Módulos registrados: ${listModules().map(m => m.name).join(" | ")}

Cada capacidade tem status: "disponivel" (executor real conectado) ou "planejada" (funcionalidade existe/existirá no sistema, mas a IA ainda não possui executor conectado). Hoje, TODAS estão "planejada".
${renderCatalogForPrompt()}

REGRA DE VERIFICAÇÃO OBRIGATÓRIA — antes de responder qualquer pedido de execução:
1. Identifique o OBJETIVO do usuário (verbo + entidade).
2. Localize o MÓDULO responsável dentro do catálogo acima.
3. Verifique se existe uma CAPACIDADE compatível (verbo + entidade, considerando sinônimos) nesse módulo.
4. Se NÃO existir capacidade compatível em nenhum módulo, responda EXATAMENTE:
   "Ainda não possuo essa capacidade. A ação solicitada não está registrada no Catálogo Universal de Capacidades."
   Em seguida, aponte o módulo mais próximo e liste as capacidades relacionadas existentes; pergunte se o usuário quer que essa nova capacidade seja registrada como planejada.
5. Se EXISTIR capacidade compatível mas o status for "planejada", responda EXATAMENTE:
   "Não consegui executar esta ação, pois ainda não existe uma ferramenta disponível para isso."
   Em seguida, opcionalmente, apresente o PLANO estruturado (abaixo), citando o módulo e a capacidade identificados.
6. Nunca invente módulos, capacidades, ferramentas, endpoints ou execuções que não estejam neste catálogo.

PRINCÍPIO PERMANENTE — SEQUÊNCIA DE DECISÃO (obrigatória em toda resposta):
Perceber → Compreender → Priorizar → Decidir → Coordenar → Aprender.

EXECUTOR UNIVERSAL DE AÇÕES (fluxo único e obrigatório para QUALQUER execução):
Você NUNCA executa uma ação diretamente. Toda execução — em qualquer módulo — passa exclusivamente pelo Executor Universal, com este contrato:

  ActionRequest → { module?, entity, operation, scope?, payload?, meta? }
  ActionResult  ← { status, message, module?, entity?, operation?, scope?, data?, error?, correlation_id, executed_at }

INTERPRETAÇÃO OBRIGATÓRIA — todo pedido do usuário deve ser reduzido a 4 elementos:
  1. MÓDULO   (ex.: assistente, crm, financeiro, agenda, ...)
  2. ENTIDADE (ex.: decisao, tarefa, contato, log, chat, ...)
  3. OPERAÇÃO (criar | listar | consultar | editar | excluir | limpar | mover | gerar | publicar | aprovar | enviar | concluir | agendar)
  4. ESCOPO   (opcional — ex.: "all" para operações em massa, ou "one" com payload.id)

Exemplo: "Exclua todas as decisões" → { module: "assistente", entity: "decisao", operation: "excluir", scope: "all" }.

Fluxo obrigatório:
1. Reduza o pedido aos 4 elementos acima usando o Catálogo Universal como referência.
2. Envie a ActionRequest ao Executor.
3. AGUARDE o ActionResult com confirmação técnica real do sistema.
4. Só então relate ao usuário o que aconteceu, usando exatamente o status retornado:
   - "ok" / "dry_run" → informe sucesso citando module + entity + operation + data.
   - "capability_not_found" → repita a message padrão do Executor (entidade/operação não existem no catálogo).
   - "capability_not_available" → repita a message padrão do Executor (existe no catálogo, sem executor conectado).
   - "confirmation_required" → peça autorização explícita ao usuário e, quando ele confirmar, reenvie com payload.confirm = true.
   - "invalid_payload" / "handler_error" → informe a falha real, sem inventar sucesso.

Nunca simule um ActionResult. Se você não tiver recebido um ActionResult real nesta conversa, trate como se a capacidade estivesse indisponível.


COMO RESPONDER (modo planejamento — SEM EXECUÇÃO):
Para pedidos que envolvem AÇÃO sobre dados do sistema, após a frase obrigatória acima, apresente um PLANO estruturado nesta ordem:

1. 🎯 **Objetivo identificado** — Em 1 frase, a intenção real do usuário.
2. 🧩 **Especialistas envolvidos** — Módulos relevantes (CRM, Financeiro, Operações, Produção, Rotina, Agenda, Digital, etc.) com o papel de cada um.
3. 🗺️ **Plano de ação sugerido** — Lista numerada (3 a 7 passos), cada passo com verbo no infinitivo e especialista entre parênteses.
4. ⚠️ **Pontos de atenção** (opcional) — Riscos, dependências, ambiguidades.
5. ❓ **Confirmação** — Pergunte se o usuário deseja seguir com o plano quando a execução estiver disponível.

REGRAS DESTA FASE:
- Nenhuma automação, criação, edição ou exclusão é executada — nenhuma capacidade do catálogo está com executor conectado.
- Nunca diga "vou fazer" / "farei" — diga "proponho" / "sugiro".
- Para perguntas de CONSULTA sobre dados presentes no contexto abaixo (ex: "qual o saldo?", "quantas tarefas?"), responda direto e curto, sem plano e sem a frase de indisponibilidade — consultar o contexto não é executar uma ação.
- Fale como organismo único: "coordenarei o CRM e o Financeiro", não "vou pedir para o módulo X".
- Considere sempre os objetivos ativos do usuário antes de propor qualquer passo.
- Se o usuário perguntar "o que você consegue fazer?", liste o catálogo de capacidades declaradas acima com o status atual de cada uma.



CONTEXTO ATUAL (${today}):
- Tarefas: ${tasks?.length || 0} (${tasks?.filter((t: any) => t.status === 'andamento').length || 0} em andamento)
- Projetos/Nós: ${nodes?.length || 0}
- Lançamentos financeiros: ${financialEntries?.length || 0}
- Saldo em contas: R$ ${accounts?.reduce((sum: number, a: any) => sum + (a.current_balance || 0), 0).toFixed(2)}
- Pedidos: ${orders?.length || 0}
- Insights recentes: ${recentInsights?.length || 0}

DADOS DISPONÍVEIS PARA PERCEBER O CONTEXTO:
Tarefas: ${JSON.stringify(tasks?.slice(0, 30) || [])}
Nós/Projetos (TODOS): ${JSON.stringify(nodes || [])}
Financeiro: ${JSON.stringify(financialEntries?.slice(0, 20) || [])}
Contas: ${JSON.stringify(accounts || [])}
Pedidos: ${JSON.stringify(orders?.slice(0, 10) || [])}`;


      // ==========================================================
      // PASSO OBRIGATÓRIO: MOTOR DE COORDENAÇÃO
      // Toda mensagem do usuário passa primeiro pelo Motor.
      // Se houver intenção de ação, o Motor devolve resposta estruturada
      // que é emitida ANTES do stream da IA.
      // ==========================================================
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? "";
      const coordination = await runCoordinationMotor(lastUserMsg);
      const motorBlock = formatMotorBlock(coordination);

      const enrichedSystemPrompt = systemPrompt + (coordination ? `

MOTOR DE COORDENAÇÃO — RETORNO REAL DESTA SOLICITAÇÃO (já emitido ao usuário no início da resposta):
${JSON.stringify(coordination, null, 2)}

Instrução: sua resposta ao usuário será concatenada APÓS o bloco do Motor de Coordenação que já foi emitido.
Continue a partir dali com o Plano estruturado, sem repetir o bloco do Motor.` : "");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: enrichedSystemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI error: ${response.status}`);
      }

      // Concatena o bloco do Motor ao stream SSE da IA
      const combined = prependSSEText(motorBlock, response.body!);

      return new Response(combined, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    }

    // POST /execute - Direct chat execution is intentionally disabled.
    // The IA Orquestradora must not claim or perform CRUD actions from chat without a validated execution layer.
    if (req.method === "POST" && path === "/execute") {
      return new Response(JSON.stringify({
        success: false,
        error: "Execução direta pelo chat desativada. A IA Orquestradora deve apenas identificar o objetivo, coordenar especialistas e apresentar um plano para confirmação.",
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI CEO Error:", error);
    const msg = error instanceof Error
      ? error.message
      : (error && typeof error === "object")
        ? ((error as any).message || (error as any).details || (error as any).hint || JSON.stringify(error))
        : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function executeAction(
  supabase: any,
  action: Decision["action"],
  insightId: string
): Promise<{ status: string; result: string }> {
  const actionRecord = {
    insight_id: insightId,
    action_type: action.type,
    payload: action.payload || {},
    status: "pendente",
    result: null as string | null,
  };

  try {
    const payload = action.payload || {};
    const entity = action.entity;

    switch (action.type) {
      // === TASKS ===
      case "task_create": {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            node_id: payload.node_id,
            title: payload.title,
            description: payload.description,
            status: payload.status || "pendente",
            progress: payload.progress || 0,
            due_date: payload.due_date,
          })
          .select()
          .single();
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Tarefa criada: ${payload.title}`;
        break;
      }
      case "task_update": {
        const { error } = await supabase
          .from("tasks")
          .update(payload)
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Tarefa atualizada: ${payload.id}`;
        break;
      }
      case "task_delete": {
        const { error } = await supabase
          .from("tasks")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Tarefa excluída: ${payload.id}`;
        break;
      }

      // === NODES ===
      case "node_create": {
        const { data, error } = await supabase
          .from("nodes")
          .insert({
            title: payload.title,
            color: payload.color || "bg-gray-100",
            parent_id: payload.parent_id,
          })
          .select()
          .single();
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Nó criado: ${payload.title}`;
        break;
      }
      case "node_update": {
        const { error } = await supabase
          .from("nodes")
          .update(payload)
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Nó atualizado: ${payload.id}`;
        break;
      }
      case "node_delete": {
        const { error } = await supabase
          .from("nodes")
          .delete()
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Nó excluído: ${payload.id}`;
        break;
      }

      // === ORDERS ===
      case "order_create": {
        const { data, error } = await supabase
          .from("orders")
          .insert({
            customer_name: payload.customer_name,
            customer_contact: payload.customer_contact,
            status: payload.status || "pendente",
            order_date: payload.order_date,
            due_date: payload.due_date,
            delivery_date: payload.delivery_date,
            total_value: payload.total_value,
            order_number: payload.order_number,
            notes: payload.notes,
          })
          .select()
          .single();
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Pedido criado: ${payload.customer_name}`;
        break;
      }
      case "order_update": {
        const { error } = await supabase
          .from("orders")
          .update(payload)
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Pedido atualizado: ${payload.id}`;
        break;
      }
      case "order_delete": {
        const { error } = await supabase
          .from("orders")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Pedido excluído: ${payload.id}`;
        break;
      }

      // === FINANCIAL ===
      case "financial_create": {
        const { data, error } = await supabase
          .from("financial_entries")
          .insert({
            description: payload.description,
            value: payload.value,
            type: payload.type || "pagar",
            due_date: payload.due_date,
            category_id: payload.category_id,
            contact_id: payload.contact_id,
          })
          .select()
          .single();
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Lançamento criado: ${payload.description}`;
        break;
      }
      case "financial_update": {
        const { error } = await supabase
          .from("financial_entries")
          .update(payload)
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Lançamento atualizado: ${payload.id}`;
        break;
      }
      case "financial_delete": {
        const { error } = await supabase
          .from("financial_entries")
          .delete()
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Lançamento excluído: ${payload.id}`;
        break;
      }
      case "financial_pay": {
        // Dar baixa - criar movimento financeiro
        const { error } = await supabase
          .from("financial_movements")
          .insert({
            entry_id: payload.id,
            account_id: payload.account_id,
            value: payload.value,
            movement_date: new Date().toISOString(),
          });
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Baixa realizada: R$ ${payload.value}`;
        break;
      }

      // === CONTACTS ===
      case "contact_create": {
        const { data, error } = await supabase
          .from("contacts")
          .insert({
            name: payload.name,
            email: payload.email,
            phone: payload.phone,
            type: payload.type || "cliente",
          })
          .select()
          .single();
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Contato criado: ${payload.name}`;
        break;
      }
      case "contact_update": {
        const { error } = await supabase
          .from("contacts")
          .update(payload)
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Contato atualizado: ${payload.id}`;
        break;
      }
      case "contact_delete": {
        const { error } = await supabase
          .from("contacts")
          .update({ is_active: false })
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Contato desativado: ${payload.id}`;
        break;
      }

      // === PRODUCTS ===
      case "product_create": {
        const { data, error } = await supabase
          .from("products")
          .insert({
            name: payload.name,
            sku: payload.sku || `SKU-${Date.now()}`,
            price: payload.price,
            cost: payload.cost,
            category: payload.category,
          })
          .select()
          .single();
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Produto criado: ${payload.name}`;
        break;
      }
      case "product_update": {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Produto atualizado: ${payload.id}`;
        break;
      }
      case "product_delete": {
        const { error } = await supabase
          .from("products")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Produto excluído: ${payload.id}`;
        break;
      }

      // === ROUTINE BLOCKS ===
      case "routine_create": {
        const { data, error } = await supabase
          .from("routine_blocks")
          .insert({
            title: payload.title,
            date: payload.date || new Date().toISOString().split("T")[0],
            duration_minutes: payload.duration_minutes || 60,
            block_type: payload.block_type || "focus",
            status: "pending",
            planned_start: payload.planned_start,
            planned_end: payload.planned_end,
          })
          .select()
          .single();
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Bloco de rotina criado: ${payload.title}`;
        break;
      }
      case "routine_update": {
        const { error } = await supabase
          .from("routine_blocks")
          .update(payload)
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Bloco de rotina atualizado: ${payload.id}`;
        break;
      }
      case "routine_delete": {
        const { error } = await supabase
          .from("routine_blocks")
          .delete()
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Bloco de rotina excluído: ${payload.id}`;
        break;
      }

      // === POSTS ===
      case "post_create": {
        const { data, error } = await supabase
          .from("posts")
          .insert({
            title: payload.title,
            content: payload.content,
            status: payload.status || "rascunho",
            scheduled_date: payload.scheduled_date,
            node_id: payload.node_id,
          })
          .select()
          .single();
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Post criado: ${payload.title}`;
        break;
      }
      case "post_update": {
        const { error } = await supabase
          .from("posts")
          .update(payload)
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Post atualizado: ${payload.id}`;
        break;
      }
      case "post_delete": {
        const { error } = await supabase
          .from("posts")
          .delete()
          .eq("id", payload.id);
        if (error) throw error;
        actionRecord.status = "ok";
        actionRecord.result = `Post excluído: ${payload.id}`;
        break;
      }

      // === NOTIFICATION ===
      case "notification": {
        actionRecord.status = "ok";
        actionRecord.result = `Notificação: ${payload.title || payload.message || "Alerta"}`;
        break;
      }

      default:
        actionRecord.status = "erro";
        actionRecord.result = `Tipo de ação desconhecido: ${action.type}`;
    }
  } catch (error) {
    actionRecord.status = "erro";
    actionRecord.result = error instanceof Error ? error.message : "Execução falhou";
  }

  // Salvar registro da ação
  await supabase.from("ai_actions").insert({
    ...actionRecord,
    executed_at: new Date().toISOString(),
  });

  return { status: actionRecord.status, result: actionRecord.result || "" };
}

// ============================================================================
// MOTOR DE COORDENAÇÃO — integração obrigatória no /chat
// ============================================================================

/**
 * Detecta intenção de ação na mensagem do usuário e devolve os 4 elementos
 * padronizados (module, entity, operation, scope, params) usando a IA.
 * Retorna null se não for pedido de ação (ex: apenas consulta/conversa).
 */
async function extractActionIntent(userMessage: string): Promise<
  | {
      objective: string;
      module?: string;
      entity: string;
      operation: string;
      scope?: string;
      params?: Record<string, unknown>;
    }
  | null
> {
  if (!userMessage || userMessage.trim().length < 3) return null;

  const catalog = listModules().map((m) => ({
    id: m.id,
    name: m.name,
    entities: m.entities.map((e) => ({ id: e.id, name: e.name, operations: e.operations })),
  }));

  const sys = `Você é um extrator de intenção. Dada uma mensagem do usuário, decida se ela pede uma AÇÃO sobre dados do sistema (criar, editar, excluir, listar, consultar, mover, publicar, aprovar, etc.).
Se NÃO for pedido de ação (é conversa, dúvida geral, saudação), responda: {"is_action": false}.
Se FOR pedido de ação, responda estritamente JSON:
{
  "is_action": true,
  "objective": "frase curta",
  "module": "id_modulo_do_catalogo_ou_melhor_palpite",
  "entity": "id_entidade",
  "operation": "criar|listar|consultar|editar|excluir|limpar|mover|gerar|publicar|aprovar|enviar|concluir|agendar|importar|exportar",
  "scope": "all|one|opcional",
  "params": { ...campos_extraidos_da_mensagem }
}
Use o catálogo abaixo como referência (mas pode sugerir module/entity mesmo se não estiver registrado):
${JSON.stringify(catalog)}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    if (!parsed?.is_action) return null;
    if (!parsed.entity || !parsed.operation) return null;
    return {
      objective: parsed.objective ?? userMessage.slice(0, 120),
      module: parsed.module,
      entity: parsed.entity,
      operation: parsed.operation,
      scope: parsed.scope,
      params: parsed.params ?? {},
    };
  } catch (err) {
    console.error("extractActionIntent error", err);
    return null;
  }
}

async function runCoordinationMotor(userMessage: string): Promise<CoordinationResponse | null> {
  const intent = await extractActionIntent(userMessage);
  if (!intent) return null;

  return coordinateRequest({
    objective: intent.objective,
    module: intent.module,
    entity: intent.entity,
    operation: intent.operation,
    scope: intent.scope,
    params: intent.params,
  });
}

function formatMotorBlock(resp: CoordinationResponse | null): string {
  if (!resp) return "";

  const statusLabel: Record<string, string> = {
    planned: "✅ Recebido — encaminhado ao Especialista",
    specialist_not_found: "⚠️ Especialista não encontrado no catálogo",
    invalid_request: "❌ Solicitação inválida",
    confirmation_required: "🔒 Confirmação necessária",
  };

  const especialista = resp.suggested_specialist
    ? `${resp.suggested_specialist.module_name} / ${resp.suggested_specialist.entity_name}`
    : "não identificado";

  const operacao = resp.planned_action?.operation ?? "—";
  const escopo = resp.planned_action?.scope ?? "—";
  const params =
    resp.planned_action?.params && Object.keys(resp.planned_action.params).length > 0
      ? "```json\n" + JSON.stringify(resp.planned_action.params, null, 2) + "\n```"
      : "_nenhum_";

  return [
    "🛰️ **Motor de Coordenação**",
    `- **Status:** ${statusLabel[resp.status] ?? resp.status}`,
    `- **Especialista sugerido:** ${especialista}`,
    `- **Entidade:** ${resp.suggested_specialist?.entity_name ?? "—"}`,
    `- **Operação:** ${operacao}`,
    `- **Escopo:** ${escopo}`,
    `- **Parâmetros recebidos:** ${params}`,
    `- **Execução real:** não executada nesta etapa`,
    `- **Próximo passo:** conectar Especialista responsável`,
    `- **Correlation ID:** \`${resp.correlation_id}\``,
    "",
    "---",
    "",
  ].join("\n");
}

/**
 * Prepend um texto como chunks SSE no formato OpenAI antes de pipear o stream original.
 */
function prependSSEText(text: string, upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      if (text) {
        // Emite como um único delta.content SSE compatível com o parser do CEOChat
        const payload = {
          choices: [{ delta: { content: text } }],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      }

      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (err) {
        controller.error(err);
        return;
      }
      controller.close();
    },
  });
}

