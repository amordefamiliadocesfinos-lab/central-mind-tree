ALTER TABLE public.inbox_entries
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_node_id uuid REFERENCES public.nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planned_bucket text,
  ADD COLUMN IF NOT EXISTS estimated_minutes integer;

CREATE INDEX IF NOT EXISTS idx_inbox_entries_decision_status
  ON public.inbox_entries (status, decision, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_entries_linked_task
  ON public.inbox_entries (linked_task_id) WHERE linked_task_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.workflow_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  selected_task_ids uuid[] NOT NULL DEFAULT '{}',
  priority_task_ids uuid[] NOT NULL DEFAULT '{}',
  focus_queue_ids uuid[] NOT NULL DEFAULT '{}',
  current_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_plans TO authenticated;
GRANT ALL ON public.workflow_plans TO service_role;

ALTER TABLE public.workflow_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users manage workflow plans" ON public.workflow_plans;
CREATE POLICY "Authenticated users manage workflow plans"
  ON public.workflow_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_workflow_plans_updated_at ON public.workflow_plans;
CREATE TRIGGER update_workflow_plans_updated_at
  BEFORE UPDATE ON public.workflow_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();