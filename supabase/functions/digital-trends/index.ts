import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, niche, type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "trends") {
      systemPrompt = `Você é um especialista em marketing digital e análise de tendências. 
Analise tendências atuais para o nicho especificado e forneça insights acionáveis.
Responda SEMPRE em português brasileiro.
Formate a resposta como JSON com a estrutura:
{
  "trends": [
    {
      "title": "Título da tendência",
      "description": "Descrição breve",
      "platforms": ["Instagram", "TikTok"],
      "engagement_potential": "alto|médio|baixo",
      "action_suggestion": "O que fazer para aproveitar"
    }
  ],
  "competitors_insights": [
    {
      "strategy": "Estratégia observada",
      "why_works": "Por que funciona",
      "how_to_adapt": "Como adaptar para seu negócio"
    }
  ],
  "content_ideas": [
    {
      "format": "Reels|Carrossel|Stories|etc",
      "hook": "Gancho inicial sugerido",
      "topic": "Tema do conteúdo"
    }
  ],
  "summary": "Resumo executivo das tendências"
}`;

      userPrompt = `Pesquise e analise as tendências atuais de conteúdo digital para:
Nicho: ${niche || "negócios em geral"}
Foco da pesquisa: ${query}

Considere:
- O que está viralizando nas redes sociais
- Estratégias que estão funcionando para concorrentes
- Formatos de conteúdo com maior engajamento
- Hashtags e tópicos em alta
- Oportunidades de conteúdo inexploradas`;
    } else if (type === "suggest_response") {
      systemPrompt = `Você é um especialista em atendimento ao cliente e copywriting.
Crie respostas profissionais, empáticas e que incentivem o engajamento.
Responda SEMPRE em português brasileiro.
Adapte o tom conforme a plataforma e contexto.`;

      userPrompt = `Sugira uma resposta para esta interação:
Tipo: ${query.interaction_type}
Plataforma: ${query.platform}
Mensagem do cliente: "${query.content}"
Estágio no funil: ${query.funnel_stage}
${query.knowledge_base ? `Base de conhecimento disponível: ${query.knowledge_base}` : ""}

Forneça uma resposta que:
- Seja cordial e profissional
- Responda a dúvida ou comentário
- Incentive o próximo passo no funil
- Tenha no máximo 300 caracteres para DMs ou 150 para comentários`;
    } else if (type === "service_response") {
      systemPrompt = `Você é um assistente de atendimento ao cliente especializado.
Analise o histórico da conversa e sugira a melhor resposta possível.
Adapte o tom conforme a plataforma e o estágio do funil do cliente.
Identifique a intenção do cliente (compra, dúvida, reclamação, suporte, etc.).
Responda SEMPRE em português brasileiro.
Responda em formato JSON: {"response": "sua resposta", "intent": "intenção detectada"}`;

      const history = (query.conversation_history || [])
        .map((m: any) => `${m.role}: ${m.content}`)
        .join('\n');

      userPrompt = `Histórico da conversa:
${history}

Plataforma: ${query.platform}
Estágio no funil: ${query.funnel_stage}
Nome do contato: ${query.contact_name}

Sugira uma resposta profissional e empática para a última mensagem do cliente.
A resposta deve ser natural, não robótica, e adequada à plataforma.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao consultar IA");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Try to parse JSON if it's a trends response
    let result;
    if (type === "trends") {
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        result = JSON.parse(jsonStr.trim());
      } catch {
        result = { raw_response: content };
      }
    } else if (type === "service_response") {
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        result = JSON.parse(jsonStr.trim());
      } catch {
        result = { response: content, intent: null };
      }
    } else {
      result = { response: content };
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in digital-trends:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
