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
  name: "list_tasks",
  title: "Listar tarefas",
  description: "Lista tarefas com filtros por status, contato e datas (scheduled_date).",
  inputSchema: {
    status: z.string().optional().describe("Ex.: pendente, em_andamento, concluida, on_hold."),
    contact_id: z.string().uuid().optional(),
    from_date: z.string().optional().describe("Data mínima YYYY-MM-DD."),
    to_date: z.string().optional().describe("Data máxima YYYY-MM-DD."),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, contact_id, from_date, to_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = sb(ctx).from("tasks")
      .select("id,title,status,scheduled_date,scheduled_time,due_date,contact_id,assigned_to,node_id")
      .order("scheduled_date", { ascending: true }).limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    if (contact_id) q = q.eq("contact_id", contact_id);
    if (from_date) q = q.gte("scheduled_date", from_date);
    if (to_date) q = q.lte("scheduled_date", to_date);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { items: data ?? [] } };
  },
});
