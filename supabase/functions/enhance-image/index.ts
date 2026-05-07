import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    const prompt = "Aumente a resolução e nitidez desta foto de perfil. Mantenha EXATAMENTE o mesmo rosto, expressão, roupa, cor de pele, cabelo, fundo e enquadramento — não altere a identidade. Apenas remova ruído, suavize artefatos de compressão e recupere detalhes finos. Saída quadrada em alta resolução.";

    const callModel = async (model: string) => {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          }],
          modalities: ["image", "text"],
        }),
      });
      return r;
    };

    const extractImage = (data: any): string | null => {
      const msg = data?.choices?.[0]?.message;
      if (!msg) return null;
      const direct = msg.images?.[0]?.image_url?.url || msg.images?.[0]?.url;
      if (direct) return direct;
      // alguns formatos retornam em content array
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          const u = part?.image_url?.url || part?.url;
          if (u) return u;
        }
      }
      return null;
    };

    const models = ["google/gemini-2.5-flash-image", "google/gemini-3.1-flash-image-preview"];
    let lastErr = "";
    let lastBody: any = null;
    for (const model of models) {
      const response = await callModel(model);
      if (!response.ok) {
        const errText = await response.text();
        console.error(`[enhance-image] ${model} ${response.status}:`, errText);
        lastErr = `${response.status}: ${errText.slice(0, 200)}`;
        if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        continue;
      }
      const data = await response.json();
      lastBody = data;
      const dataUrl = extractImage(data);
      if (dataUrl) {
        return new Response(JSON.stringify({ imageDataUrl: dataUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error(`[enhance-image] ${model} sem imagem. payload:`, JSON.stringify(data).slice(0, 1000));
    }

    return new Response(JSON.stringify({ error: `IA não retornou imagem. ${lastErr}`, debug: lastBody }), {
      status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("enhance-image error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
