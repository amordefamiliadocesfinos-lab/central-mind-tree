import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mediaUrl, mimeType } = await req.json();
    if (!mediaUrl) {
      return new Response(JSON.stringify({ error: "mediaUrl é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    const isVideo = (mimeType || "").startsWith("video/");

    const systemPrompt = `Você é um assistente especialista em extrair dados de contato (CRM) a partir de imagens ou vídeos. 
Analise a mídia fornecida (cartão de visita, foto de tela do WhatsApp, perfil de rede social, print de conversa, identidade, etc.) 
e extraia todas as informações de contato visíveis. Retorne APENAS os campos que conseguir identificar com confiança. 
Para telefones brasileiros, normalize para apenas dígitos (com DDD). Para WhatsApp, inclua o código do país 55 quando aplicável.
Se identificar uma empresa (CNPJ, Razão Social), defina person_type = 'juridica'. Caso contrário 'fisica'.
Inclua um resumo em 'notes' descrevendo o contexto da mídia (ex: "Extraído de cartão de visita", "Print do WhatsApp em DD/MM").`;

    const userContent: any[] = [
      { type: "text", text: "Extraia os dados de contato desta mídia." },
    ];

    if (isVideo) {
      userContent.push({ type: "text", text: `(Mídia é um vídeo - URL: ${mediaUrl}. Analise o(s) frame(s) descrito(s) ou tente acessar.)` });
      // Vídeo: enviar como image_url pode não funcionar; tentamos como link de imagem mesmo
      userContent.push({ type: "image_url", image_url: { url: mediaUrl } });
    } else {
      userContent.push({ type: "image_url", image_url: { url: mediaUrl } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "register_contact",
            description: "Cadastra os dados do contato extraídos da mídia",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "Nome completo ou razão social" },
                fantasy_name: { type: "string", description: "Nome fantasia da empresa" },
                person_type: { type: "string", enum: ["fisica", "juridica"] },
                document: { type: "string", description: "CPF ou CNPJ (apenas dígitos)" },
                email: { type: "string" },
                phone: { type: "string", description: "Telefone (apenas dígitos)" },
                mobile: { type: "string", description: "Celular (apenas dígitos)" },
                whatsapp: { type: "string", description: "WhatsApp com DDI (apenas dígitos)" },
                website: { type: "string" },
                profession: { type: "string" },
                company_name: { type: "string" },
                address: { type: "string" },
                address_number: { type: "string" },
                neighborhood: { type: "string" },
                city: { type: "string" },
                state: { type: "string", description: "UF" },
                zip_code: { type: "string", description: "CEP (apenas dígitos)" },
                birth_date: { type: "string", description: "YYYY-MM-DD" },
                gender: { type: "string", enum: ["masculino", "feminino", "outro"] },
                notes: { type: "string", description: "Observações e contexto da mídia" },
                confidence: { type: "number", description: "Confiança 0-1 nos dados extraídos" },
              },
              required: ["name"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "register_contact" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Não foi possível extrair dados da mídia." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ contact: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("contact-from-media error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
