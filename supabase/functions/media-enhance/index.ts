import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, enhancementType, brightness, contrast } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Image URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build prompt based on enhancement type
    let prompt = "";
    switch (enhancementType) {
      case "upscale":
        prompt = "Enhance this image by increasing its resolution and clarity while maintaining natural details. Make it sharper and higher quality.";
        break;
      case "remove_bg":
        prompt = "Remove the background from this image, keeping only the main subject with a transparent or white background.";
        break;
      case "auto_adjust":
        prompt = "Automatically improve this image by enhancing colors, adjusting brightness and contrast, and making it look more professional and vibrant.";
        break;
      case "sharpen":
        prompt = "Sharpen this image to make details clearer and more defined. Increase edge definition while avoiding artifacts.";
        break;
      default:
        prompt = "Enhance this image to improve its overall quality.";
    }

    // Add brightness/contrast adjustments if specified
    if (brightness !== 100) {
      prompt += ` Adjust brightness to ${brightness}%.`;
    }
    if (contrast !== 100) {
      prompt += ` Adjust contrast to ${contrast}%.`;
    }

    console.log(`Processing image enhancement: ${enhancementType}`);
    console.log(`Prompt: ${prompt}`);

    // Use Lovable AI with image editing capability
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the generated/edited image
    const enhancedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!enhancedImageUrl) {
      console.error("No image in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Não foi possível processar a imagem. Tente outro tipo de melhoria." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Enhancement successful");

    return new Response(
      JSON.stringify({ 
        enhancedUrl: enhancedImageUrl,
        enhancementType,
        message: "Imagem processada com sucesso"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Media enhance error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao processar imagem" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
