// Edge function: gera uma mensagem de WhatsApp personalizada e humanizada
// avaliando dados do cliente (histórico, pedidos, transições de funil, etc).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contact_id } = await req.json();
    if (!contact_id || typeof contact_id !== "string") {
      return new Response(JSON.stringify({ error: "contact_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [{ data: contact }, { data: history }, { data: orders }] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", contact_id).maybeSingle(),
      supabase
        .from("contact_history")
        .select("interaction_type,event_type,description,interaction_date,created_at")
        .eq("contact_id", contact_id)
        .order("interaction_date", { ascending: false })
        .limit(30),
      supabase
        .from("orders")
        .select("order_number,status,total_value,order_date")
        .eq("contact_id", contact_id)
        .order("order_date", { ascending: false })
        .limit(10),
    ]);

    if (!contact) {
      return new Response(JSON.stringify({ error: "Contato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detecta transição de funil olhando o histórico
    const funnelTransitions = (history ?? [])
      .filter((h) => /funil|stage|etapa|status/i.test(h.description ?? ""))
      .slice(0, 3);

    const totalOrders = orders?.length ?? 0;
    const lastOrder = orders?.[0];

    const ctxLines: string[] = [
      `Cliente: ${contact.name}${contact.fantasy_name ? ` (${contact.fantasy_name})` : ""}`,
      `Etapa atual do funil: ${contact.funnel_status ?? "—"}`,
      `Temperatura: ${contact.temperatura_lead ?? "—"}`,
      `Cidade: ${contact.city ?? "—"} | Origem: ${contact.origem_lead ?? "—"}`,
      `Último contato: ${contact.ultimo_contato ?? "—"}`,
      `Próxima ação prevista: ${contact.next_action_text ?? "—"} (${contact.next_action_date ?? "—"})`,
      `Total de pedidos já realizados: ${totalOrders}`,
      lastOrder
        ? `Último pedido: #${lastOrder.order_number} em ${lastOrder.order_date} — status ${lastOrder.status} — R$ ${lastOrder.total_value ?? 0}`
        : `Sem pedidos registrados ainda`,
      contact.notes ? `Notas internas: ${contact.notes}` : "",
      "",
      `--- Últimas interações (${(history ?? []).length}) ---`,
      ...((history ?? []).slice(0, 15).map((h) => {
        const d = h.interaction_date ?? h.created_at;
        return `[${d}] ${h.interaction_type ?? h.event_type}: ${h.description}`;
      })),
    ];

    if (funnelTransitions.length) {
      ctxLines.push("", `--- Transições de etapa detectadas ---`);
      funnelTransitions.forEach((t) => ctxLines.push(`- ${t.description}`));
    }

    const systemPrompt = `Você é um especialista em vendas por WhatsApp, com tom HUMANIZADO, próximo e brasileiro.
Sua tarefa: analisar o contexto real do cliente abaixo e escrever UMA mensagem de WhatsApp curta, personalizada e eficiente para negociação.

Regras OBRIGATÓRIAS:
- Máximo 4 linhas curtas. Direto, sem floreios.
- Use o primeiro nome do cliente (apenas o primeiro nome, sem prefixos estranhos como "YZ", "NH", códigos).
- Se ele JÁ COMPROU antes → mensagem de recompra / produção aberta / novidade.
- Se MUDOU de etapa (ex: Novo Lead → Negociação) → reconhecer o avanço e fazer próxima pergunta-chave.
- Se está PARADO sem resposta → reabordagem leve, sem cobrar.
- Se é NOVO LEAD → boas-vindas curtas + pergunta que faça avançar.
- Use no máximo 1 emoji sutil (😊 ou 🙂). Sem emojis em excesso.
- NUNCA invente produtos, valores ou prazos que não estejam no contexto.
- NÃO escreva explicações, NÃO use markdown, NÃO use aspas. Devolva APENAS o texto cru da mensagem, pronto para colar no WhatsApp.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: ctxLines.join("\n") },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    let message: string = data?.choices?.[0]?.message?.content ?? "";
    // Limpeza: remove aspas envolventes e markdown acidental
    message = message.trim().replace(/^["'`]+|["'`]+$/g, "").trim();

    // Determina o "motivo" da sugestão para mostrar no UI
    let reason = "Mensagem personalizada";
    if (totalOrders > 0) reason = "Cliente já comprou — sugestão de recompra";
    else if (funnelTransitions.length) reason = "Mudança de etapa detectada";
    else if (!contact.ultimo_contato) reason = "Primeiro contato — boas-vindas";
    else reason = "Reabordagem personalizada";

    return new Response(JSON.stringify({ message, reason }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-whatsapp-message error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
