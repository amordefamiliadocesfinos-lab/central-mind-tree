import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface Decision {
  area: "Financeiro" | "Projetos" | "Tempo" | "Recursos";
  title: string;
  why: string;
  action: {
    type: "api_call" | "task_change" | "agenda_block" | "notification";
    endpoint?: string;
    payload?: Record<string, unknown>;
  };
  impact: number;
  risk: number;
  confidence: number;
  requires_approval: boolean;
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
        supabase.from("tasks").select("*").is("deleted_at", null).limit(100),
        supabase.from("nodes").select("*").limit(100),
        supabase.from("financial_entries").select("*").order("due_date").limit(100),
        supabase.from("financial_accounts").select("*"),
        supabase.from("routine_blocks").select("*").gte("date", new Date().toISOString().split("T")[0]).limit(50),
        supabase.from("ai_policies").select("*"),
        supabase.from("orders").select("*").is("deleted_at", null).order("due_date").limit(50),
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

      // System prompt for CEO agent
      const systemPrompt = `Você é um CEO operacional de IA. Seu objetivo é maximizar a entrega de projetos e manter a saúde financeira.

ESTRUTURA DE TAREFAS (prioridade):
1. "estrutural" - Topo, guia o resto (NUNCA rebaixar)
2. "andamento" - Em execução ativa
3. "pendente" - Aguardando início
4. "concluído" - Finalizado

REGRAS:
- Priorize reduzir risco de caixa, gargalos e retrabalho
- Proponha mudanças claras e de baixo custo
- Sempre retorne decisões no formato JSON especificado
- Seja objetivo e prático

DADOS ATUAIS:
- Data de hoje: ${today}
- Total de tarefas: ${context.tasks.length}
- Tarefas em andamento: ${context.tasks.filter((t: any) => t.status === "andamento").length}
- Tarefas pendentes: ${context.tasks.filter((t: any) => t.status === "pendente").length}
- Entradas financeiras: ${context.financialEntries.length}
- Pedidos ativos: ${context.orders.length}
- Blocos de rotina hoje: ${context.routineBlocks.filter((b: any) => b.date === today).length}

HEURÍSTICAS PARA ANÁLISE:
1. FINANCEIRO:
   - Contas atrasadas com alto impacto de multa
   - Recebíveis que podem ser antecipados
   - Sugerir baixa parcial quando apropriado
   - Fluxo de caixa negativo iminente

2. PROJETOS:
   - Tarefas "andamento" estagnadas (>7 dias sem progresso)
   - Tarefas com prazo próximo e baixo progresso
   - Reorganização de prioridades baseada em dependências
   - Promoção de tarefas bloqueantes

3. TEMPO:
   - Blocos de tempo para entregas críticas
   - Consolidação de reuniões
   - Gaps improdutivos na agenda

4. RECURSOS:
   - Sobrecarga (>8h/dia planejadas)
   - Distribuição desigual de trabalho

Analise os dados e gere de 1 a 5 insights acionáveis.`;

      const userPrompt = `Analise estes dados e gere insights acionáveis:

TAREFAS (${context.tasks.length} total):
${JSON.stringify(context.tasks.slice(0, 20), null, 2)}

ENTRADAS FINANCEIRAS (${context.financialEntries.length} total):
${JSON.stringify(context.financialEntries.slice(0, 20), null, 2)}

CONTAS BANCÁRIAS:
${JSON.stringify(context.accounts, null, 2)}

PEDIDOS ATIVOS:
${JSON.stringify(context.orders.slice(0, 10), null, 2)}

BLOCOS DE ROTINA (próximos):
${JSON.stringify(context.routineBlocks.slice(0, 10), null, 2)}

Retorne um array JSON com insights no formato:
{
  "insights": [
    {
      "area": "Financeiro|Projetos|Tempo|Recursos",
      "title": "título curto",
      "why": "explicação objetiva",
      "action": { "type": "api_call|task_change|agenda_block|notification", "endpoint": "...", "payload": {...} },
      "impact": 0.0-1.0,
      "risk": 0.0-1.0,
      "confidence": 0.0-1.0,
      "requires_approval": true|false
    }
  ]
}`;

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

        // Check autopilot policy
        const policy = policiesMap.get(insight.area) as Policy | undefined;
        const canAutoExecute =
          policy?.autopilot &&
          insight.risk <= (policy?.max_risk || 0.4) &&
          !insight.requires_approval;

        if (canAutoExecute && insightRecord) {
          // Auto-execute action
          const actionResult = await executeAction(supabase, insight.action, insightRecord.id);
          executedActions.push(actionResult);

          // Update insight status
          await supabase
            .from("ai_insights")
            .update({ status: "executado" })
            .eq("id", insightRecord.id);
        }
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

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI CEO Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
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
    switch (action.type) {
      case "task_change":
        if (action.payload?.taskId && action.payload?.updates) {
          const { error } = await supabase
            .from("tasks")
            .update(action.payload.updates)
            .eq("id", action.payload.taskId);

          if (error) throw error;
          actionRecord.status = "ok";
          actionRecord.result = `Task ${action.payload.taskId} updated`;
        }
        break;

      case "agenda_block":
        if (action.payload?.title) {
          const { error } = await supabase.from("routine_blocks").insert({
            title: action.payload.title,
            date: action.payload.date || new Date().toISOString().split("T")[0],
            duration_minutes: action.payload.duration || 60,
            block_type: "focus",
            status: "pending",
          });

          if (error) throw error;
          actionRecord.status = "ok";
          actionRecord.result = `Routine block created: ${action.payload.title}`;
        }
        break;

      case "notification":
        // Just log the notification for now
        actionRecord.status = "ok";
        actionRecord.result = `Notification: ${action.payload?.title || "Alert"}`;
        break;

      case "api_call":
        // Generic API call - log for manual execution
        actionRecord.status = "ok";
        actionRecord.result = `API call logged: ${action.endpoint}`;
        break;

      default:
        actionRecord.status = "erro";
        actionRecord.result = `Unknown action type: ${action.type}`;
    }
  } catch (error) {
    actionRecord.status = "erro";
    actionRecord.result = error instanceof Error ? error.message : "Execution failed";
  }

  // Save action record
  await supabase.from("ai_actions").insert({
    ...actionRecord,
    executed_at: new Date().toISOString(),
  });

  return { status: actionRecord.status, result: actionRecord.result || "" };
}
