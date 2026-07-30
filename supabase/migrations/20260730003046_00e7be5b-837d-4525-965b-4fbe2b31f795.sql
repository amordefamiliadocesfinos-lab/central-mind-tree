-- ============================================================
-- Identidade operacional derivada exclusivamente de auth.uid()
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id
    FROM public.app_users au
   WHERE au.auth_user_id = auth.uid()
     AND au.is_active = true
   LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.current_app_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, service_role;

-- ============================================================
-- Tabela raiz: Aplicação de Campanha
-- ============================================================
CREATE TABLE public.campaign_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.digital_ideas(id) ON DELETE RESTRICT,
  title text NOT NULL,
  objective text NOT NULL,
  success_definition text NOT NULL,
  metric_name text NOT NULL,
  metric_unit text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','aprovada','em_execucao','concluida','cancelada')),
  owner_user_id uuid NOT NULL REFERENCES public.app_users(id),
  authenticated_identity_id uuid NOT NULL DEFAULT auth.uid(),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.app_users(id),
  completed_at timestamptz,
  completed_by uuid REFERENCES public.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_applications_idea ON public.campaign_applications(idea_id);
CREATE INDEX idx_campaign_applications_owner ON public.campaign_applications(owner_user_id);
CREATE INDEX idx_campaign_applications_identity ON public.campaign_applications(authenticated_identity_id);

REVOKE ALL ON public.campaign_applications FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.campaign_applications TO authenticated;
GRANT ALL ON public.campaign_applications TO service_role;
ALTER TABLE public.campaign_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_applications_select_own" ON public.campaign_applications
  FOR SELECT TO authenticated
  USING (authenticated_identity_id = auth.uid() AND owner_user_id = public.current_app_user_id());

CREATE POLICY "campaign_applications_insert_own" ON public.campaign_applications
  FOR INSERT TO authenticated
  WITH CHECK (authenticated_identity_id = auth.uid() AND owner_user_id = public.current_app_user_id());

CREATE POLICY "campaign_applications_update_own" ON public.campaign_applications
  FOR UPDATE TO authenticated
  USING (authenticated_identity_id = auth.uid() AND owner_user_id = public.current_app_user_id())
  WITH CHECK (authenticated_identity_id = auth.uid() AND owner_user_id = public.current_app_user_id());

CREATE TRIGGER trg_campaign_applications_updated_at
  BEFORE UPDATE ON public.campaign_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Helper de posse (evita recursão nas policies filhas)
-- ============================================================
CREATE OR REPLACE FUNCTION public.owns_campaign(_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_applications ca
     WHERE ca.id = _campaign_id
       AND ca.authenticated_identity_id = auth.uid()
       AND ca.owner_user_id = public.current_app_user_id()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.owns_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_campaign(uuid) TO authenticated, service_role;

-- ============================================================
-- Execuções
-- ============================================================
CREATE TABLE public.campaign_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaign_applications(id) ON DELETE RESTRICT,
  title text NOT NULL,
  planned_at date,
  status text NOT NULL DEFAULT 'planejada'
    CHECK (status IN ('planejada','confirmada','cancelada')),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES public.app_users(id),
  created_by uuid NOT NULL REFERENCES public.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_executions_campaign ON public.campaign_executions(campaign_id);

REVOKE ALL ON public.campaign_executions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.campaign_executions TO authenticated;
GRANT ALL ON public.campaign_executions TO service_role;
ALTER TABLE public.campaign_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_executions_select_own" ON public.campaign_executions
  FOR SELECT TO authenticated USING (public.owns_campaign(campaign_id));
CREATE POLICY "campaign_executions_insert_own" ON public.campaign_executions
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_campaign(campaign_id) AND created_by = public.current_app_user_id());
CREATE POLICY "campaign_executions_update_own" ON public.campaign_executions
  FOR UPDATE TO authenticated
  USING (public.owns_campaign(campaign_id))
  WITH CHECK (public.owns_campaign(campaign_id));

CREATE TRIGGER trg_campaign_executions_updated_at
  BEFORE UPDATE ON public.campaign_executions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Evidências (append-only)
-- ============================================================
CREATE TABLE public.campaign_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaign_applications(id) ON DELETE RESTRICT,
  execution_id uuid NOT NULL REFERENCES public.campaign_executions(id) ON DELETE RESTRICT,
  kind text NOT NULL DEFAULT 'link' CHECK (kind IN ('link','arquivo','print','observacao')),
  description text,
  url text,
  created_by uuid NOT NULL REFERENCES public.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_evidence_execution ON public.campaign_evidence(execution_id);

REVOKE ALL ON public.campaign_evidence FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.campaign_evidence TO authenticated;
GRANT ALL ON public.campaign_evidence TO service_role;
ALTER TABLE public.campaign_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_evidence_select_own" ON public.campaign_evidence
  FOR SELECT TO authenticated USING (public.owns_campaign(campaign_id));
CREATE POLICY "campaign_evidence_insert_own" ON public.campaign_evidence
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_campaign(campaign_id) AND created_by = public.current_app_user_id());

-- ============================================================
-- Métricas
-- ============================================================
CREATE TABLE public.campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaign_applications(id) ON DELETE RESTRICT,
  execution_id uuid REFERENCES public.campaign_executions(id) ON DELETE RESTRICT,
  metric_name text NOT NULL,
  metric_unit text NOT NULL,
  metric_value numeric(20,10) NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_by uuid NOT NULL REFERENCES public.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_metrics_campaign ON public.campaign_metrics(campaign_id);

REVOKE ALL ON public.campaign_metrics FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.campaign_metrics TO authenticated;
GRANT ALL ON public.campaign_metrics TO service_role;
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_metrics_select_own" ON public.campaign_metrics
  FOR SELECT TO authenticated USING (public.owns_campaign(campaign_id));
CREATE POLICY "campaign_metrics_insert_own" ON public.campaign_metrics
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_campaign(campaign_id) AND created_by = public.current_app_user_id());

-- ============================================================
-- Aprendizados (append-only)
-- ============================================================
CREATE TABLE public.campaign_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaign_applications(id) ON DELETE RESTRICT,
  content text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_learnings_campaign ON public.campaign_learnings(campaign_id);

REVOKE ALL ON public.campaign_learnings FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.campaign_learnings TO authenticated;
GRANT ALL ON public.campaign_learnings TO service_role;
ALTER TABLE public.campaign_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_learnings_select_own" ON public.campaign_learnings
  FOR SELECT TO authenticated USING (public.owns_campaign(campaign_id));
CREATE POLICY "campaign_learnings_insert_own" ON public.campaign_learnings
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_campaign(campaign_id) AND created_by = public.current_app_user_id());

-- ============================================================
-- Operações críticas: transacionais, idempotentes, ator derivado
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_campaign(_campaign_id uuid)
RETURNS public.campaign_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := public.current_app_user_id();
  v_row public.campaign_applications;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sem vínculo operacional ativo para a conta autenticada.';
  END IF;

  SELECT * INTO v_row FROM public.campaign_applications
   WHERE id = _campaign_id
     AND authenticated_identity_id = auth.uid()
     AND owner_user_id = v_actor
   FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Campanha não encontrada ou sem permissão.';
  END IF;

  IF v_row.status <> 'rascunho' THEN
    RETURN v_row; -- idempotente
  END IF;

  UPDATE public.campaign_applications
     SET status = 'aprovada', approved_at = now(), approved_by = v_actor, updated_at = now()
   WHERE id = _campaign_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_campaign_execution(_execution_id uuid)
RETURNS public.campaign_executions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := public.current_app_user_id();
  v_exec public.campaign_executions;
  v_camp public.campaign_applications;
  v_evidence int;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sem vínculo operacional ativo para a conta autenticada.';
  END IF;

  SELECT * INTO v_exec FROM public.campaign_executions WHERE id = _execution_id FOR UPDATE;
  IF v_exec.id IS NULL THEN
    RAISE EXCEPTION 'Execução não encontrada.';
  END IF;

  SELECT * INTO v_camp FROM public.campaign_applications
   WHERE id = v_exec.campaign_id
     AND authenticated_identity_id = auth.uid()
     AND owner_user_id = v_actor
   FOR UPDATE;
  IF v_camp.id IS NULL THEN
    RAISE EXCEPTION 'Campanha não encontrada ou sem permissão.';
  END IF;

  IF v_exec.status = 'confirmada' THEN
    RETURN v_exec; -- idempotente
  END IF;

  IF v_camp.status NOT IN ('aprovada','em_execucao') THEN
    RAISE EXCEPTION 'A campanha precisa estar aprovada para confirmar execução.';
  END IF;

  SELECT count(*) INTO v_evidence FROM public.campaign_evidence WHERE execution_id = _execution_id;
  IF v_evidence = 0 THEN
    RAISE EXCEPTION 'É necessário registrar ao menos uma evidência antes de confirmar a execução.';
  END IF;

  UPDATE public.campaign_executions
     SET status = 'confirmada', confirmed_at = now(), confirmed_by = v_actor, updated_at = now()
   WHERE id = _execution_id
   RETURNING * INTO v_exec;

  UPDATE public.campaign_applications
     SET status = 'em_execucao', updated_at = now()
   WHERE id = v_camp.id AND status = 'aprovada';

  RETURN v_exec;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_campaign(_campaign_id uuid)
RETURNS public.campaign_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := public.current_app_user_id();
  v_row public.campaign_applications;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sem vínculo operacional ativo para a conta autenticada.';
  END IF;

  SELECT * INTO v_row FROM public.campaign_applications
   WHERE id = _campaign_id
     AND authenticated_identity_id = auth.uid()
     AND owner_user_id = v_actor
   FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Campanha não encontrada ou sem permissão.';
  END IF;

  IF v_row.status = 'concluida' THEN
    RETURN v_row; -- idempotente
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.campaign_executions
                  WHERE campaign_id = _campaign_id AND status = 'confirmada') THEN
    RAISE EXCEPTION 'Conclua somente após confirmar ao menos uma execução.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.campaign_metrics WHERE campaign_id = _campaign_id) THEN
    RAISE EXCEPTION 'Registre a métrica principal antes de concluir.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.campaign_learnings WHERE campaign_id = _campaign_id) THEN
    RAISE EXCEPTION 'Registre ao menos um aprendizado antes de concluir.';
  END IF;

  UPDATE public.campaign_applications
     SET status = 'concluida', completed_at = now(), completed_by = v_actor, updated_at = now()
   WHERE id = _campaign_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_campaign(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_campaign_execution(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_campaign(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_campaign_execution(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_campaign(uuid) TO authenticated, service_role;