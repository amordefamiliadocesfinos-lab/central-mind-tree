import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_contacts",
  title: "Listar contatos",
  description: "Lista contatos do CRM. Suporta busca por nome/email/telefone e filtro por estágio do funil.",
  inputSchema: {
    search: z.string().optional().describe("Texto para buscar em nome, email, telefone ou WhatsApp."),
    funnel_status: z.string().optional().describe("Filtra por estágio do funil (ex.: novo_lead, qualificado, cliente_ativo, vip)."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de resultados (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, funnel_status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = sb(ctx).from("contacts").select("id,name,email,phone,whatsapp,funnel_status,client_classification,lifetime_value,city,state,ultimo_contato")
      .eq("is_active", true).order("updated_at", { ascending: false }).limit(limit ?? 25);
    if (funnel_status) q = q.eq("funnel_status", funnel_status);
    if (search) {
      const s = `%${search}%`;
      q = q.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s},whatsapp.ilike.${s}`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { items: data ?? [] } };
  },
});
