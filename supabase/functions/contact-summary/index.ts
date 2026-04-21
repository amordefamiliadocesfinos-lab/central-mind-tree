// Edge function: gera resumo/briefing de um contato com base no histórico.
// Não requer JWT (config.toml: verify_jwt = false padrão Lovable).
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
        .limit(50),
      supabase
        .from("orders")
        .select("order_number,status,total_value,order_date,due_date")
        .eq("contact_id", contact_id)
        .order("order_date", { ascending: false })
        .limit(20),
    ]);

    if (!contact) {
      return new Response(JSON.stringify({ error: "Contato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctxLines: string[] = [
      `Contato: ${contact.name}${contact.fantasy_name ? ` (${contact.fantasy_name})` : ""}`,
      `Tipo: ${contact.type} | Funil: ${contact.funnel_status} | Temperatura: ${contact.temperatura_lead ?? "—"}`,
      `WhatsApp: ${contact.whatsapp ?? contact.phone ?? "—"} | Email: ${contact.email ?? "—"}`,
      `Cidade: ${contact.city ?? "—"} | Origem: ${contact.origem_lead ?? "—"}`,
      `Último contato: ${contact.ultimo_contato ?? "—"} | Próximo contato: ${contact.next_contact_date ?? "—"}`,
      `Próxima ação: ${contact.next_action_text ?? "—"} (${contact.next_action_date ?? "—"})`,
      `Notas internas: ${contact.notes ?? "—"}`,
      "",
      `--- Histórico de interações (mais recente primeiro, ${history?.length ?? 0} eventos) ---`,
      ...((history ?? []).map((h) => {
        const d = h.interaction_date ?? h.created_at;
        return `[${d}] ${h.interaction_type ?? h.event_type}: ${h.description}`;
      })),
    ];

    if (orders && Array.isArray(orders) && orders.length) {
      ctxLines.push("", `--- Pedidos (${orders.length}) ---`);
      for (const o of orders) {
        ctxLines.push(`#${o.order_number} | ${o.order_date} | ${o.status} | R$ ${o.total_value ?? 0}`);
      }
    }

    const systemPrompt =
      "Você é um assistente comercial sênior. Recebe o histórico completo de um contato no CRM e gera um briefing curto e acionável em português, em markdown, com seções: \n" +
      "**🎯 Resumo (1 frase)**, **🌡️ Estágio & Temperatura**, **💡 Pontos-chave do histórico** (3-5 bullets), **⚠️ Objeções/Riscos** (se houver), **✅ Próxima ação recomendada** (1-2 frases objetivas, com sugestão de mensagem). " +
      "Seja direto, sem floreios. Se faltar info, diga.";

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
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos em Configurações > Workspace > Uso." }), {
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
    const summary = data?.choices?.[0]?.message?.content ?? "Sem resumo gerado.";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("contact-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
