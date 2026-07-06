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
  name: "financial_summary",
  title: "Resumo financeiro",
  description: "Retorna totais a receber e a pagar (abertos e pagos) em um intervalo de datas de vencimento.",
  inputSchema: {
    from_date: z.string().describe("Data inicial YYYY-MM-DD (due_date)."),
    to_date: z.string().describe("Data final YYYY-MM-DD (due_date)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from_date, to_date }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const { data, error } = await sb(ctx).from("financial_entries")
      .select("type,status,value,value_paid,due_date")
      .gte("due_date", from_date).lte("due_date", to_date);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const totals = { receber_total: 0, receber_pago: 0, pagar_total: 0, pagar_pago: 0, count: data?.length ?? 0 };
    for (const r of data ?? []) {
      const v = Number(r.value ?? 0), vp = Number(r.value_paid ?? 0);
      if (r.type === "receber") { totals.receber_total += v; totals.receber_pago += vp; }
      else if (r.type === "pagar") { totals.pagar_total += v; totals.pagar_pago += vp; }
    }
    return { content: [{ type: "text", text: JSON.stringify(totals) }], structuredContent: totals };
  },
});
