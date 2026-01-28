import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateRequest {
  title: string;
  field: 'objective' | 'target_audience' | 'key_message' | 'kpi' | 'all';
  platform?: string; // Optional platform context (e.g., "OLX", "Instagram")
  existingData?: {
    objective?: string;
    target_audience?: string;
    key_message?: string;
    kpi?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { title, field, platform, existingData } = await req.json() as GenerateRequest;

    if (!title) {
      return new Response(
        JSON.stringify({ error: "Title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um especialista em marketing digital, analista de anúncios, editor de posts e criador de conteúdo para redes sociais e marketplaces.

Sua função é ajudar a criar conteúdo persuasivo e profissional baseado no título fornecido pelo usuário.

Regras:
- Seja direto e objetivo
- Use linguagem apropriada para a plataforma (se especificada)
- Foque em conversão e engajamento
- Mantenha respostas curtas mas impactantes
- Use emojis quando apropriado para plataformas sociais
- Para marketplaces, foque em vendas e confiança

Formato de resposta: Retorne APENAS o texto solicitado, sem explicações ou prefixos.`;

    let userPrompt = '';
    
    if (field === 'all') {
      userPrompt = `Com base no título: "${title}"${platform ? ` (plataforma: ${platform})` : ''}

Gere todos os campos em formato JSON:
{
  "objective": "objetivo do conteúdo (1-2 frases)",
  "target_audience": "público-alvo específico",
  "key_message": "mensagem principal persuasiva (2-3 frases)",
  "kpi": "meta mensurável realista"
}

Retorne APENAS o JSON válido, sem markdown ou explicações.`;
    } else {
      const fieldDescriptions: Record<string, string> = {
        objective: 'o objetivo deste conteúdo/anúncio (1-2 frases explicando o propósito)',
        target_audience: 'o público-alvo específico que vai se interessar (seja específico)',
        key_message: 'a mensagem principal persuasiva para atrair o público (2-3 frases impactantes)',
        kpi: 'uma meta mensurável e realista para este conteúdo (ex: views, cliques, vendas)',
      };

      const existingContext = existingData ? Object.entries(existingData)
        .filter(([k, v]) => v && k !== field)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n') : '';

      userPrompt = `Com base no título: "${title}"${platform ? ` (plataforma: ${platform})` : ''}
${existingContext ? `\nContexto existente:\n${existingContext}\n` : ''}
Gere ${fieldDescriptions[field]}

Retorne APENAS o texto, sem explicações ou prefixos.`;
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
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos para continuar." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar conteúdo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content?.trim() || '';

    // Parse JSON if field is 'all'
    let result: any;
    if (field === 'all') {
      try {
        // Clean up potential markdown code blocks
        const cleanedJson = generatedText.replace(/```json\n?|\n?```/g, '').trim();
        result = JSON.parse(cleanedJson);
      } catch {
        console.error("Failed to parse AI JSON response:", generatedText);
        result = { error: "Falha ao processar resposta da IA" };
      }
    } else {
      result = { [field]: generatedText };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in digital-content-ai:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
