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
  name: "get_contact",
  title: "Detalhes do contato",
  description: "Retorna dados completos de um contato, seus pedidos recentes e histórico recente.",
  inputSchema: { contact_id: z.string().uuid().describe("ID do contato.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ contact_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const c = sb(ctx);
    const [{ data: contact, error: e1 }, { data: orders }, { data: history }] = await Promise.all([
      c.from("contacts").select("*").eq("id", contact_id).maybeSingle(),
      c.from("orders").select("id,order_number,status,total_value,order_date,due_date").eq("contact_id", contact_id).order("order_date", { ascending: false }).limit(10),
      c.from("contact_history").select("event_type,interaction_type,description,interaction_date").eq("contact_id", contact_id).order("interaction_date", { ascending: false }).limit(20),
    ]);
    if (e1) return { content: [{ type: "text", text: e1.message }], isError: true };
    if (!contact) return { content: [{ type: "text", text: "Contato não encontrado" }], isError: true };
    const payload = { contact, orders: orders ?? [], history: history ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
