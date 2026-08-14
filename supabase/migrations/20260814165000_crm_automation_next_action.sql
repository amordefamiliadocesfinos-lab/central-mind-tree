CREATE OR REPLACE FUNCTION public.apply_funnel_automations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_target_stage text;
  v_title text;
  v_days int;
  v_time text;
  v_assigned uuid;
  v_due date;
  v_due_at timestamptz;
  v_msg text;
  v_official_task_id uuid;
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
        v_due_at   := ((v_due::text || ' ' || COALESCE(v_time, '09:00'))::timestamp AT TIME ZONE 'America/Sao_Paulo');

        -- Próxima Ação oficial: mantém o mesmo contrato utilizado pela aplicação.
        UPDATE public.contacts
           SET next_action_text = v_title,
               next_action_date = v_due_at,
               next_contact_date = v_due_at,
               updated_at = now()
         WHERE id = NEW.id;

        -- Mantém no máximo uma tarefa oficial pendente por contato. Tarefas
        -- manuais não possuem esta source e nunca são selecionadas aqui.
        SELECT id
          INTO v_official_task_id
          FROM public.tasks
         WHERE contact_id = NEW.id
           AND source = 'crm_next_action'
           AND deleted_at IS NULL
           AND status <> 'concluído'
         ORDER BY created_at DESC
         LIMIT 1;

        IF v_official_task_id IS NOT NULL THEN
          UPDATE public.tasks
             SET title = v_title,
                 status = 'pendente',
                 node_id = 'd7c76db8-b7e0-4ce1-87ca-21275c346326'::uuid,
                 scheduled_date = v_due,
                 due_date = v_due,
                 scheduled_time = v_time::time,
                 assigned_to = v_assigned,
                 updated_at = now()
           WHERE id = v_official_task_id;

          UPDATE public.tasks
             SET status = 'concluído',
                 updated_at = now()
           WHERE contact_id = NEW.id
             AND source = 'crm_next_action'
             AND deleted_at IS NULL
             AND status <> 'concluído'
             AND id <> v_official_task_id;
        ELSE
          INSERT INTO public.tasks (
            title, status, node_id, contact_id, scheduled_date, due_date,
            scheduled_time, assigned_to, source
          )
          VALUES (
            v_title, 'pendente',
            'd7c76db8-b7e0-4ce1-87ca-21275c346326'::uuid,
            NEW.id, v_due, v_due, v_time::time, v_assigned, 'crm_next_action'
          );
        END IF;

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

      INSERT INTO public.automation_logs (rule_id, triggered_at, status, trigger_data, action_result)
      VALUES (
        r.id, now(), 'success',
        jsonb_build_object('contact_id', NEW.id, 'old_stage', OLD.funnel_status, 'new_stage', NEW.funnel_status),
        jsonb_build_object('action_type', r.action_type, 'target_type', 'contact', 'target_id', NEW.id)
      );

      UPDATE public.automation_rules SET last_triggered_at = now() WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.automation_logs (rule_id, triggered_at, status, trigger_data, action_result)
      VALUES (
        r.id, now(), 'error',
        jsonb_build_object('contact_id', NEW.id, 'old_stage', OLD.funnel_status, 'new_stage', NEW.funnel_status),
        jsonb_build_object('action_type', r.action_type, 'error', SQLERRM)
      );
    END;
  END LOOP;

  RETURN NEW;
END;
$function$;
