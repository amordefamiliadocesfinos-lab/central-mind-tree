import { supabase } from "@/integrations/supabase/client";

/**
 * Projeto/Agrupamento é representado por um `node` filho de uma área.
 * O schema atual só aceita node_type: root | area | team | function,
 * então usamos "function" como tipo do nó-projeto (sem alterar schema).
 */
export const GROUP_NODE_TYPE = "function";

export interface NodeRef {
  id: string;
  title: string;
  color: string;
  parent_id?: string | null;
  node_type?: string | null;
}

export const NODE_FIELDS = "id, title, color, parent_id, node_type";

/** "Área › Projeto" — caminho curto (máx. 2 níveis) para contexto visual. */
export function buildNodePath(nodesMap: Record<string, NodeRef>, nodeId?: string | null): string {
  const node = nodeId ? nodesMap[nodeId] : undefined;
  if (!node) return "";
  const parent = node.parent_id ? nodesMap[node.parent_id] : undefined;
  return parent ? `${parent.title} › ${node.title}` : node.title;
}

/** Cria o nó que representa o Projeto/Agrupamento. Não toca em tarefas. */
export async function createGroupNode(input: { title: string; parentId: string; color?: string }) {
  const { data, error } = await supabase
    .from("nodes")
    .insert({
      title: input.title,
      parent_id: input.parentId,
      color: input.color || "verde",
      node_type: GROUP_NODE_TYPE,
    })
    .select(NODE_FIELDS)
    .single();
  if (error) throw error;
  return data as NodeRef;
}

/** Associa tarefas existentes ao agrupamento alterando somente tasks.node_id. */
export async function assignTasksToGroup(taskIds: string[], nodeId: string) {
  if (taskIds.length === 0) return;
  const { error } = await supabase.from("tasks").update({ node_id: nodeId }).in("id", taskIds);
  if (error) throw error;
}
