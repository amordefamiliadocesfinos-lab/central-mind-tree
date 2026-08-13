import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

/** A única persistência compartilhada entre a página de edição e o painel do FOCO. */
export async function saveTask(taskId: string, update: TaskUpdate) {
  return supabase.from("tasks").update(update).eq("id", taskId);
}
