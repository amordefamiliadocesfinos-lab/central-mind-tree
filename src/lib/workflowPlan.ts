import { supabase } from "@/integrations/supabase/client";

export interface WorkflowPlanRecord {
  selected_task_ids: string[];
  priority_task_ids: string[];
  focus_queue_ids: string[];
  current_task_id: string | null;
  completed_at?: string | null;
}

export async function loadWorkflowPlan(userId: string, weekStart: string) {
  const { data, error } = await (supabase as any)
    .from("workflow_plans")
    .select("selected_task_ids, priority_task_ids, focus_queue_ids, current_task_id, completed_at")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw error;
  return data as WorkflowPlanRecord | null;
}

export async function saveWorkflowPlan(
  userId: string,
  weekStart: string,
  values: Partial<WorkflowPlanRecord>,
) {
  const { error } = await (supabase as any).from("workflow_plans").upsert(
    { user_id: userId, week_start: weekStart, ...values },
    { onConflict: "user_id,week_start" },
  );
  if (error) throw error;
}
