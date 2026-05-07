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
Inclua um resumo em 'notes' descrevendo o contexto da mídia (ex: "Extraído de cartão de visita", "Print do WhatsApp em DD/MM").

REGRA CRÍTICA - NOME:
- O 'name' DEVE ser EXATAMENTE o nome/título exibido no cabeçalho do print (ex: topo da conversa do WhatsApp, nome do contato salvo, @username do Instagram).
- Preserve maiúsculas, números, emojis e formatação. Ex: se o print mostra "Y2 Z GTI ISABELA", o name deve ser "Y2 Z GTI ISABELA" — NÃO normalize, NÃO traduza, NÃO invente.
- NÃO use o número de telefone como nome quando há um nome textual visível no topo.

REGRA CRÍTICA - FOTO DE PERFIL (BOUNDING BOX):
- Se a mídia contém um avatar/foto de perfil claro da pessoa (ex: avatar circular do WhatsApp no topo, foto de perfil do Instagram), defina has_profile_photo = true.
- Forneça em 'profile_photo_bbox' as coordenadas NORMALIZADAS (0.0 a 1.0) APENAS da área visível da foto do perfil — NÃO inclua o nome, texto, ícones, status, bordas do app, barras, fundo do cabeçalho ou qualquer área ao redor.
- Formato: { x, y, width, height } onde x,y é o canto superior-esquerdo do avatar e width/height são as dimensões — todos relativos ao tamanho da imagem completa.
- Se o avatar for circular, o bbox deve encostar na borda externa do círculo da foto, como um quadrado tangente ao círculo, sem folga.
- Se o avatar for quadrado/retangular, o bbox deve encostar exatamente nas bordas da foto visível.
- Se houver fundo branco/cinza ao redor do avatar dentro do print, EXCLUA esse fundo do bbox ao máximo possível; o bbox deve ficar o mais justo possível na foto.
- NÃO centralize pela área do cabeçalho; centralize apenas pela foto real visível.
- Se existir dúvida entre um bbox mais aberto e um bbox mais fechado, escolha o mais FECHADO desde que não corte a foto.
- Seja extremamente preciso: o recorte deve conter SOMENTE a imagem da foto do perfil, descartando todo o resto do print.
- Se for cartão de visita SEM foto da pessoa, ou apenas texto/documento, has_profile_photo = false e NÃO retorne bbox.`;

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
                has_profile_photo: { type: "boolean", description: "True se a mídia contém um avatar/foto de perfil clara da pessoa" },
                profile_photo_bbox: {
                  type: "object",
                  description: "Coordenadas normalizadas (0-1) APENAS da foto visível do perfil, sem texto, moldura do app ou área extra ao redor",
                  properties: {
                    x: { type: "number", description: "Canto superior-esquerdo X (0-1)" },
                    y: { type: "number", description: "Canto superior-esquerdo Y (0-1)" },
                    width: { type: "number", description: "Largura (0-1)" },
                    height: { type: "number", description: "Altura (0-1)" },
                  },
                  required: ["x", "y", "width", "height"],
                  additionalProperties: false,
                },
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

    // IMPORTANTE: NÃO usamos modelo generativo de imagem para "extrair" o avatar,
    // pois ele recria/alucina um rosto diferente. O recorte é feito no cliente,
    // pixel-a-pixel, a partir do bbox retornado pela IA — preservando exatamente
    // a foto de perfil original da mídia.
    return new Response(JSON.stringify({ contact: extracted, profilePhotoDataUrl: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("contact-from-media error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
