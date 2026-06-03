
-- Trigger function: apply funnel-stage automations
CREATE OR REPLACE FUNCTION public.apply_funnel_automations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_target_stage text;
  v_title text;
  v_days int;
  v_time text;
  v_assigned uuid;
  v_due date;
  v_msg text;
BEGIN
  IF NEW.funnel_status IS NULL OR NEW.funnel_status IS NOT DISTINCT FROM OLD.funnel_status THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT * FROM public.automation_rules
    WHERE is_active = true
      AND trigger_type = 'funnel_stage_changed'
      AND trigger_config->>'stage' = NEW.funnel_status
  LOOP
    BEGIN
      IF r.action_type = 'create_task' THEN
        v_title    := COALESCE(r.action_config->>'title', 'Ação automática');
        v_days     := COALESCE((r.action_config->>'days_offset')::int, 0);
        v_time     := NULLIF(r.action_config->>'time', '');
        v_assigned := NULLIF(r.action_config->>'assigned_to','')::uuid;
        v_due      := CURRENT_DATE + v_days;

        INSERT INTO public.tasks (title, status, node_id, contact_id, scheduled_date, due_date, scheduled_time, assigned_to)
        VALUES (
          v_title, 'todo',
          'd7c76db8-b7e0-4ce1-87ca-21275c346326'::uuid,
          NEW.id, v_due, v_due, v_time::time, v_assigned
        );

        INSERT INTO public.contact_history (contact_id, event_type, interaction_type, description, interaction_date)
        VALUES (NEW.id, 'automation', 'observacao',
                '⚙️ Automação: tarefa criada — ' || v_title || ' (vence ' || to_char(v_due,'DD/MM/YYYY') || ')', now());

      ELSIF r.action_type = 'change_funnel_stage' THEN
        v_target_stage := r.action_config->>'target_stage';
        IF v_target_stage IS NOT NULL AND v_target_stage <> NEW.funnel_status THEN
          UPDATE public.contacts SET funnel_status = v_target_stage, updated_at = now()
           WHERE id = NEW.id;
          INSERT INTO public.contact_history (contact_id, event_type, interaction_type, description, interaction_date, old_value, new_value)
          VALUES (NEW.id, 'automation', 'observacao',
                  '⚙️ Automação: movido para "' || v_target_stage || '"', now(), NEW.funnel_status, v_target_stage);
        END IF;

      ELSIF r.action_type IN ('alert','notify') THEN
        v_msg := COALESCE(r.action_config->>'message', r.name);
        INSERT INTO public.contact_history (contact_id, event_type, interaction_type, description, interaction_date)
        VALUES (NEW.id, 'automation', 'observacao', '⚙️ ' || v_msg, now());
      END IF;

      INSERT INTO public.automation_logs (rule_id, triggered_at, action_taken, target_type, target_id, status)
      VALUES (r.id, now(), r.action_type, 'contact', NEW.id, 'success');

      UPDATE public.automation_rules SET last_triggered_at = now() WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.automation_logs (rule_id, triggered_at, action_taken, target_type, target_id, status, error_message)
      VALUES (r.id, now(), r.action_type, 'contact', NEW.id, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_funnel_automations ON public.contacts;
CREATE TRIGGER trg_apply_funnel_automations
AFTER UPDATE OF funnel_status ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.apply_funnel_automations();
