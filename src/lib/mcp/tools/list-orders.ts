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
  name: "list_orders",
  title: "Listar pedidos",
  description: "Lista pedidos com filtros opcionais por status, contato e intervalo de datas.",
  inputSchema: {
    status: z.string().optional().describe("Ex.: pendente, em_producao, entregue, cancelado."),
    contact_id: z.string().uuid().optional(),
    from_date: z.string().optional().describe("Data mínima YYYY-MM-DD (order_date)."),
    to_date: z.string().optional().describe("Data máxima YYYY-MM-DD (order_date)."),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, contact_id, from_date, to_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = sb(ctx).from("orders")
      .select("id,order_number,status,total_value,order_date,due_date,contact_id")
      .order("order_date", { ascending: false }).limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    if (contact_id) q = q.eq("contact_id", contact_id);
    if (from_date) q = q.gte("order_date", from_date);
    if (to_date) q = q.lte("order_date", to_date);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { items: data ?? [] } };
  },
});
