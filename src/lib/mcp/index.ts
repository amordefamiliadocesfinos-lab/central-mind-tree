import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listContactsTool from "./tools/list-contacts";
import getContactTool from "./tools/get-contact";
import listOrdersTool from "./tools/list-orders";
import listTasksTool from "./tools/list-tasks";
import createTaskTool from "./tools/create-task";
import financialSummaryTool from "./tools/financial-summary";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "painel-central-mcp",
  title: "Painel Central – Cérebro",
  version: "0.1.0",
  instructions:
    "Ferramentas do Painel Central (CRM, pedidos, tarefas e financeiro). Use list_contacts/get_contact para consultar clientes, list_orders para pedidos, list_tasks e create_task para agenda, e financial_summary para totais a receber/pagar em um período.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listContactsTool,
    getContactTool,
    listOrdersTool,
    listTasksTool,
    createTaskTool,
    financialSummaryTool,
  ],
});
