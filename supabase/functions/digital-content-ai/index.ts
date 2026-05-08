import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CustomField {
  id: string;
  label: string;
  type: string;
}

interface PlatformVariation {
  variationId: string;
  platformName: string;
  platformType: string; // social, ecommerce, marketplace, mensageria, site, outro
  platformObjective?: string;
  aspectRatio?: string;
  duration?: string;
  customFields: CustomField[];
}

interface GenerateRequest {
  title: string;
  field: 'objective' | 'target_audience' | 'key_message' | 'kpi' | 'all' | 
         'description' | 'caption' | 'cta' | 'hashtags' | 'checklist_suggestion' |
         'custom_field' | 'all_variation_fields' | 'platform_structure' | 'generate_all_variations' |
         'platform_structure_from_media';
  platform?: string;
  platformType?: string;
  existingData?: Record<string, string>;
  customFieldLabel?: string;
  customFields?: CustomField[];
  mediaUrls?: string[]; // For platform_structure_from_media (image URLs)
  // For generate_all_variations
  ideaContext?: {
    title: string;
    ideaType: string;
    objective?: string;
    targetAudience?: string;
    keyMessage?: string;
    kpi?: string;
    productName?: string;
    productDescription?: string;
  };
  variations?: PlatformVariation[];
}

// Build the persona prompt based on platform type
function getPersonaForPlatformType(platformType: string): string {
  switch (platformType) {
    case 'social':
      return 'Social Media Manager especialista em engajamento, tendências e linguagem nativa de redes sociais.';
    case 'marketplace':
      return 'Profissional de Anúncios e Vendas Online especialista em copywriting de alta conversão para marketplaces (OLX, Mercado Livre, Shopee).';
    case 'ecommerce':
      return 'Especialista em E-commerce com foco em descrições de produto otimizadas para SEO e conversão em lojas virtuais.';
    case 'mensageria':
      return 'Especialista em Comunicação Direta via mensageria (WhatsApp, Telegram), com linguagem pessoal, objetiva e focada em relacionamento.';
    case 'site':
      return 'Especialista em Conteúdo Web e SEO, com foco em textos otimizados para blogs, landing pages e sites institucionais.';
    default:
      return 'Especialista em Marketing Digital com conhecimento amplo em diversas plataformas e formatos de conteúdo.';
  }
}

function getIdeaTypeLabel(ideaType: string): string {
  switch (ideaType) {
    case 'conteudo': return 'Conteúdo';
    case 'anuncio': return 'Anúncio de Produto';
    case 'cadastro': return 'Cadastro de Produto';
    case 'campanha': return 'Campanha';
    default: return 'Conteúdo';
  }
}

function buildVariationsPrompt(ideaContext: GenerateRequest['ideaContext'], variations: PlatformVariation[]): { system: string; user: string } {
  if (!ideaContext) throw new Error('ideaContext is required');

  const ideaTypeLabel = getIdeaTypeLabel(ideaContext.ideaType);

  // Group variations by platform type for persona context
  const platformTypes = [...new Set(variations.map(v => v.platformType))];
  const personaDescriptions = platformTypes.map(t => `- ${getPersonaForPlatformType(t)}`).join('\n');

  const systemPrompt = `Você é uma equipe de especialistas em marketing digital que assume diferentes papéis dependendo da plataforma:

${personaDescriptions}

Sua missão é gerar variações de conteúdo específicas para cada plataforma, todas baseadas na mesma IDEIA central.

REGRAS CRÍTICAS:
1. NUNCA invente informações sobre o produto ou ideia - use APENAS o que foi fornecido
2. Cada variação DEVE ser genuinamente diferente das outras - adapte tom, formato e abordagem para cada plataforma
3. Respeite o tipo de conteúdo da plataforma (vídeo curto, post longo, anúncio, mensagem direta, etc.)
4. Use a linguagem nativa de cada plataforma (hashtags para Instagram, bullet points para marketplaces, etc.)
5. Mantenha a mensagem central coerente entre todas as variações
6. Para campos de texto curto (input), seja conciso (máx 80 caracteres)
7. Para campos de texto longo (textarea), seja detalhado e persuasivo (2-5 frases)
8. Para hashtags, gere 10-15 hashtags relevantes separadas por espaço
9. Para CTA, seja curto e impactante (máx 30 caracteres)

Formato de resposta: APENAS JSON válido, sem markdown ou explicações.`;

  const productContext = ideaContext.productName 
    ? `\n\n🏷️ PRODUTO VINCULADO:
- Nome: ${ideaContext.productName}
${ideaContext.productDescription ? `- Descrição: ${ideaContext.productDescription}` : ''}`
    : '';

  const variationsSpec = variations.map((v, i) => {
    const fieldsSpec = v.customFields.map(f => 
      `    "${f.id}": "${f.label} (${f.type === 'textarea' ? 'texto longo, 2-5 frases' : 'texto curto, máx 80 chars'})"`
    ).join(',\n');
    
    return `  "${v.variationId}": {
    // Plataforma: ${v.platformName} (${v.platformType})
    // Objetivo: ${v.platformObjective || 'engajar'}
    // Formato: ${v.aspectRatio || 'livre'}${v.duration ? ` | Duração: ${v.duration}` : ''}
${fieldsSpec}
  }`;
  }).join(',\n');

  const userPrompt = `📋 IDEIA CENTRAL:
- Tipo: ${ideaTypeLabel}
- Título: "${ideaContext.title}"
${ideaContext.objective ? `- Objetivo: ${ideaContext.objective}` : ''}
${ideaContext.targetAudience ? `- Público-alvo: ${ideaContext.targetAudience}` : ''}
${ideaContext.keyMessage ? `- Mensagem central: ${ideaContext.keyMessage}` : ''}
${ideaContext.kpi ? `- Resultado esperado: ${ideaContext.kpi}` : ''}${productContext}

🎯 GERE CONTEÚDO PARA CADA VARIAÇÃO:

{
${variationsSpec}
}

IMPORTANTE: Preencha TODOS os campos de TODAS as variações. Cada plataforma deve ter conteúdo genuinamente adaptado ao seu formato e público. Retorne APENAS o JSON.`;

  return { system: systemPrompt, user: userPrompt };
}

// Build prompts for single-field and other existing modes
function buildSingleFieldPrompt(req: GenerateRequest): { system: string; user: string } {
  const { title, field, platform, platformType, existingData, customFieldLabel, customFields } = req;

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

Retorne APENAS os itens, um por linha, sem numeração ou bullets.`;
  } else if (field === 'custom_field' && customFieldLabel) {
    const typeContext = platformType === 'marketplace' 
      ? 'marketplace de vendas'
      : platformType === 'ecommerce'
      ? 'loja virtual e e-commerce'
      : 'rede social';
    
    const existingContext = existingData ? Object.entries(existingData)
      .filter(([, v]) => v)
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
- "custom_fields" deve ter 3-6 campos relevantes para a plataforma
- "checklist" deve ter 4-8 itens essenciais de verificação antes de publicar
- "suggested_children" deve ter 0-5 sub-formatos comuns dessa plataforma
- Se a plataforma for um marketplace foque em campos de venda
- Se for rede social foque em engajamento e conteúdo visual
- Se for site/blog foque em SEO e conteúdo escrito
- Para mensageria foque em comunicação direta

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

  return { system: systemPrompt, user: userPrompt };
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

    const requestData = await req.json() as GenerateRequest;
    const { title, field, ideaContext, variations } = requestData;

    if (!title && !ideaContext?.title) {
      return new Response(
        JSON.stringify({ error: "Title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompts based on field type
    let systemPrompt: string;
    let userPrompt: string;
    let messages: any[] = [];

    if (field === 'generate_all_variations') {
      if (!ideaContext || !variations || variations.length === 0) {
        return new Response(
          JSON.stringify({ error: "ideaContext and variations are required for generate_all_variations" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const prompts = buildVariationsPrompt(ideaContext, variations);
      systemPrompt = prompts.system;
      userPrompt = prompts.user;
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];
    } else if (field === 'platform_structure_from_media') {
      const { mediaUrls } = requestData;
      if (!mediaUrls || mediaUrls.length === 0) {
        return new Response(
          JSON.stringify({ error: "mediaUrls is required for platform_structure_from_media" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      systemPrompt = `Você é um engenheiro reverso de UIs de apps e marketplaces. Sua missão é analisar screenshots reais e reconstruir FIELMENTE a tela de cadastro/edição como JSON, capturando TODA seção, subseção, campo, ícone, ordem, agrupamento, prefixo, sufixo, placeholder, dica, asterisco de obrigatório, contador de caracteres e cores. Não invente campos: extraia apenas o que aparece nos prints. Se houver mais de um print, una as seções em ordem visual contínua, sem duplicar.`;
      userPrompt = `Analise TODOS os prints anexados da plataforma "${title}" e retorne APENAS JSON válido (sem markdown, sem comentários) que permita reconstruir a tela de cadastro/edição com fidelidade máxima.

Estrutura esperada:
{
  "brand_color": "#HEX exato da cor primária da marca",
  "brand_secondary_color": "#HEX cor secundária/acento se houver",
  "brand_name": "Nome exato da plataforma no header",
  "header_title": "Título exato da tela (ex: 'Adicionar produto', 'Criar anúncio')",
  "sections": [
    {
      "id": "snake_case",
      "title": "Título EXATO da seção como aparece",
      "icon": "emoji representativo",
      "description": "Subtítulo/descrição da seção se houver",
      "fields": [
        {
          "id": "snake_case_unico",
          "label": "Label EXATO",
          "type": "input | textarea | number | select | media | switch | price | tags | date | radio | checkbox | dimensions",
          "placeholder": "texto cinza dentro do campo",
          "hint": "texto auxiliar abaixo (cinza)",
          "required": true/false,
          "options": ["..."],
          "prefix": "R$ | + | @",
          "suffix": "g | cm | un | %",
          "max_length": 100,
          "multiple": true/false (para media/tags),
          "media_kind": "image | video | both",
          "default": "valor padrão visível",
          "group": "nome do agrupamento se vários campos estiverem em uma linha (ex: 'dimensões')"
        }
      ]
    }
  ],
  "custom_fields": [ {"id":"...","label":"...","type":"..."} ],
  "checklist": ["..."],
  "aspect_ratio": "1:1 | 4:5 | 9:16 | null",
  "notes": "1-2 frases sobre o layout"
}

REGRAS DE FIDELIDADE (CRÍTICAS):
1. ORDEM: reproduza as seções e campos EXATAMENTE na mesma ordem visual dos prints (de cima para baixo, esquerda para direita).
2. TÍTULOS EXATOS: copie os textos das seções e labels letra por letra (incluindo acentos, parênteses e maiúsculas).
3. NÃO INVENTE campos. Não adicione campos genéricos que não aparecem nos prints.
4. NÃO DUPLIQUE seções repetidas em prints diferentes — una-as.
5. COR DA MARCA: identifique a cor primária real observando botões/header (Shopee #EE4D2D, Mercado Livre #FFE600, Pinterest #E60023, Facebook #1877F2, Instagram gradiente #E4405F, TikTok #000000, etc).
6. ASTERISCO VERMELHO ⇒ required=true.
7. Campos lado a lado (ex: peso/largura/altura/comprimento) devem ter o mesmo "group".
8. Cada upload de foto/vídeo é "media" com multiple=true quando há vários slots.
9. Preços com R$ ⇒ type "price" + prefix "R$".
10. Toggles ⇒ "switch". Listas com seta ⇒ "select" (preencha "options" se visíveis).
11. custom_fields deve conter TODOS os fields de todas as sections (espelho plano).
12. Se um campo tiver contador visível (ex: "0/120"), preencha max_length.
13. Use ícones (emoji) consistentes: 📷 mídia, 📝 informações, 🏷️ categoria, 📦 frete/estoque, 💰 vendas, ⚙️ outros, 📐 dimensões.

Retorne APENAS o JSON.`;

      const userContent: any[] = [{ type: "text", text: userPrompt }];
      for (const url of mediaUrls.slice(0, 8)) {
        userContent.push({ type: "image_url", image_url: { url } });
      }
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ];
    } else {
      const prompts = buildSingleFieldPrompt(requestData);
      systemPrompt = prompts.system;
      userPrompt = prompts.user;
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];
    }

    const useVisionModel = field === 'platform_structure_from_media';

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: useVisionModel ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview",
        messages,
        ...(useVisionModel ? { max_tokens: 8192 } : {}),
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

    // Parse response based on field type
    let result: unknown;
    if (field === 'generate_all_variations' || field === 'all' || field === 'all_variation_fields' || field === 'platform_structure' || field === 'platform_structure_from_media') {
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
