import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateRequest {
  title: string;
  field: 'objective' | 'target_audience' | 'key_message' | 'kpi' | 'all' | 
         'description' | 'caption' | 'cta' | 'hashtags' | 'checklist_suggestion' |
         'custom_field' | 'all_variation_fields' | 'platform_structure';
  platform?: string;
  platformType?: string; // social, ecommerce, marketplace
  existingData?: Record<string, string>;
  customFieldLabel?: string; // Label for custom field generation
  customFields?: { id: string; label: string; type: string }[]; // All custom fields for bulk generation
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

    const { title, field, platform, platformType, existingData, customFieldLabel, customFields } = await req.json() as GenerateRequest;

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
- Para e-commerce, foque em descrições de produto e benefícios

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
    } else if (field === 'checklist_suggestion') {
      const typeContext = platformType === 'marketplace' 
        ? 'marketplace de vendas (OLX, Mercado Livre, Shopee, etc.)'
        : platformType === 'ecommerce'
        ? 'loja virtual e e-commerce (Nuvemshop, etc.)'
        : 'rede social';
      
      userPrompt = `Crie um checklist de produção para a plataforma "${platform || title}" que é um ${typeContext}.

O checklist deve conter entre 4-8 itens essenciais que um criador/vendedor deve verificar antes de publicar.

Cada item deve ser uma pergunta curta ou verificação (máximo 50 caracteres).

Exemplos de bons itens:
- Fotos em alta resolução?
- Título com palavras-chave?
- Preço competitivo verificado?
- CTA incluído?

Retorne APENAS os itens, um por linha, sem numeração ou bullets.`;
    } else if (field === 'custom_field' && customFieldLabel) {
      const typeContext = platformType === 'marketplace' 
        ? 'marketplace de vendas'
        : platformType === 'ecommerce'
        ? 'loja virtual e e-commerce'
        : 'rede social';
      
      const existingContext = existingData ? Object.entries(existingData)
        .filter(([k, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n') : '';

      userPrompt = `Com base no título: "${title}" (plataforma: ${platform || 'geral'}, tipo: ${typeContext})
${existingContext ? `\nContexto existente:\n${existingContext}\n` : ''}
Gere um conteúdo profissional e persuasivo para o campo "${customFieldLabel}".

Se for um campo de título: seja conciso e chamativo (máx 80 caracteres)
Se for descrição/legenda: seja detalhado e persuasivo (2-4 frases)
Se for CTA: seja curto e impactante (máx 30 caracteres)
Se for hashtags: gere 10-15 hashtags relevantes

Retorne APENAS o texto, sem explicações ou prefixos.`;
    } else if (field === 'all_variation_fields' && customFields && customFields.length > 0) {
      const typeContext = platformType === 'marketplace' 
        ? 'marketplace de vendas'
        : platformType === 'ecommerce'
        ? 'loja virtual e e-commerce'
        : 'rede social';
      
      const fieldsList = customFields.map(f => `"${f.id}": "${f.label} - ${f.type === 'textarea' ? 'texto longo' : 'texto curto'}"`).join(',\n  ');
      
      userPrompt = `Com base no título: "${title}" (plataforma: ${platform || 'geral'}, tipo: ${typeContext})

Gere conteúdo profissional e persuasivo para TODOS os seguintes campos em formato JSON:
{
  ${fieldsList}
}

Para cada campo:
- Se for título: seja conciso e chamativo
- Se for descrição/legenda: seja detalhado e persuasivo
- Se for CTA: seja curto e impactante
- Se for hashtags: gere hashtags relevantes

Retorne APENAS o JSON válido, sem markdown ou explicações.`;
    } else if (field === 'platform_structure') {
      userPrompt = `Analise o nome da plataforma/canal: "${title}"

Com base APENAS nesse nome, determine a estrutura ideal para essa plataforma de publicação de conteúdo digital.

Retorne um JSON com a seguinte estrutura:
{
  "icon": "emoji que melhor representa essa plataforma (1 emoji apenas)",
  "group_type": "social | marketplace | ecommerce | mensageria | site | outro",
  "objective": "vender | engajar | informar | relacionar",
  "aspect_ratio": "proporção principal do conteúdo (ex: 1:1, 9:16, 16:9) ou null se não aplicável",
  "duration": "duração típica do conteúdo (ex: 15-60s, 3-10min) ou null se não aplicável",
  "custom_fields": [
    {"id": "identificador_snake_case", "label": "Nome do Campo", "type": "input ou textarea"}
  ],
  "checklist": [
    "Item de verificação antes de publicar (máx 50 caracteres cada)"
  ],
  "suggested_children": [
    {"name": "Nome do formato/variação", "icon": "emoji", "aspect_ratio": "proporção ou null"}
  ]
}

Regras importantes:
- "custom_fields" deve ter 3-6 campos relevantes para a plataforma (título do post, descrição, legenda, hashtags, preço, link, etc.)
- "checklist" deve ter 4-8 itens essenciais de verificação antes de publicar
- "suggested_children" deve ter 0-5 sub-formatos comuns dessa plataforma (ex: para Instagram → Feed, Stories, Reels)
- Se a plataforma for um marketplace (OLX, Mercado Livre, Shopee, etc.) foque em campos de venda
- Se for rede social foque em engajamento e conteúdo visual
- Se for site/blog foque em SEO e conteúdo escrito
- Para mensageria (WhatsApp, Telegram) foque em comunicação direta

Retorne APENAS o JSON válido, sem markdown ou explicações.`;
    } else {
      const fieldDescriptions: Record<string, string> = {
        objective: 'o objetivo deste conteúdo/anúncio (1-2 frases explicando o propósito)',
        target_audience: 'o público-alvo específico que vai se interessar (seja específico)',
        key_message: 'a mensagem principal persuasiva para atrair o público (2-3 frases impactantes)',
        kpi: 'uma meta mensurável e realista para este conteúdo (ex: views, cliques, vendas)',
        description: 'uma descrição atrativa e detalhada do conteúdo/produto (2-4 frases que vendam)',
        caption: 'uma legenda envolvente para o post (use emojis se for rede social, seja persuasivo)',
        cta: 'um call-to-action curto e impactante (ex: Compre agora!, Saiba mais, Link na bio)',
        hashtags: 'hashtags relevantes e populares separadas por espaço (10-15 hashtags)',
      };

      const existingContext = existingData ? Object.entries(existingData)
        .filter(([k, v]) => v && k !== field)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n') : '';

      userPrompt = `Com base no título: "${title}"${platform ? ` (plataforma: ${platform})` : ''}
${existingContext ? `\nContexto existente:\n${existingContext}\n` : ''}
Gere ${fieldDescriptions[field] || `conteúdo para o campo ${field}`}

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

    // Parse JSON if field is 'all', 'all_variation_fields', or 'platform_structure'
    let result: any;
    if (field === 'all' || field === 'all_variation_fields' || field === 'platform_structure') {
      try {
        const cleanedJson = generatedText.replace(/```json\n?|\n?```/g, '').trim();
        result = JSON.parse(cleanedJson);
      } catch {
        console.error("Failed to parse AI JSON response:", generatedText);
        result = { error: "Falha ao processar resposta da IA" };
      }
    } else if (field === 'checklist_suggestion') {
      result = { checklist: generatedText };
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
