import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

const ROOT_NODE = "d7c76db8-b7e0-4ce1-87ca-21275c346326";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_task",
  title: "Criar tarefa",
  description: "Cria uma nova tarefa no Painel Central. Sempre vinculada ao nó raiz por padrão.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Título da tarefa."),
    scheduled_date: z.string().optional().describe("Data agendada YYYY-MM-DD."),
    scheduled_time: z.string().optional().describe("Hora HH:MM."),
    due_date: z.string().optional().describe("Prazo YYYY-MM-DD."),
    contact_id: z.string().uuid().optional().describe("Contato relacionado (opcional)."),
    node_id: z.string().uuid().optional().describe("Nó do organograma (padrão: raiz Deividi)."),
    assigned_to: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const row = {
      title: input.title,
      status: "pendente",
      node_id: input.node_id ?? ROOT_NODE,
      contact_id: input.contact_id ?? null,
      scheduled_date: input.scheduled_date ?? null,
      scheduled_time: input.scheduled_time ?? null,
      due_date: input.due_date ?? null,
      assigned_to: input.assigned_to ?? null,
    };
    const { data, error } = await sb(ctx).from("tasks").insert(row).select().maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Tarefa criada: ${data?.id}` }], structuredContent: { task: data } };
  },
});
