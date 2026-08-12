ALTER TABLE public.financial_movements
  ADD COLUMN IF NOT EXISTS import_hash text,
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS import_external_id text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_movements_import_hash
  ON public.financial_movements (account_id, import_source, import_hash)
  WHERE import_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reconcile_imported_financial_line(
  p_mode text, p_entry_id uuid, p_movement_id uuid, p_account_id uuid,
  p_type text, p_value numeric, p_movement_date date, p_import_hash text,
  p_import_source text, p_import_external_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_entry public.financial_entries%ROWTYPE;
  v_movement public.financial_movements%ROWTYPE;
  v_movement_id uuid;
  v_total_paid numeric := 0;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  IF p_mode NOT IN ('entry', 'movement') THEN RAISE EXCEPTION 'Modo de conciliação inválido.'; END IF;
  IF p_type NOT IN ('receber', 'pagar') OR p_account_id IS NULL OR p_value <= 0
     OR p_movement_date IS NULL OR coalesce(trim(p_import_hash), '') = ''
     OR coalesce(trim(p_import_source), '') = '' THEN
    RAISE EXCEPTION 'Dados de conciliação inválidos.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_movements
    WHERE account_id = p_account_id AND import_source = p_import_source AND import_hash = p_import_hash
  ) OR EXISTS (
    SELECT 1 FROM public.financial_entries
    WHERE account_id = p_account_id AND import_source = p_import_source AND import_hash = p_import_hash
  ) THEN
    RAISE EXCEPTION 'Esta linha de extrato já foi processada.';
  END IF;

  IF p_mode = 'entry' THEN
    SELECT * INTO v_entry FROM public.financial_entries WHERE id = p_entry_id FOR UPDATE;
    IF NOT FOUND OR v_entry.type <> p_type THEN RAISE EXCEPTION 'Lançamento financeiro incompatível.'; END IF;
    IF v_entry.account_id IS NOT NULL AND v_entry.account_id <> p_account_id THEN
      RAISE EXCEPTION 'A conta do lançamento não corresponde à conta do extrato.';
    END IF;
    IF p_value > (v_entry.value - coalesce(v_entry.value_paid, 0)) + 0.005 THEN
      RAISE EXCEPTION 'O valor conciliado supera o saldo restante do lançamento.';
    END IF;

    INSERT INTO public.financial_movements (
      entry_id, account_id, value, movement_date, notes,
      import_hash, import_source, import_external_id, imported_at
    ) VALUES (
      v_entry.id, p_account_id, p_value, p_movement_date,
      'Conciliado via importação de extrato', p_import_hash, p_import_source,
      nullif(p_import_external_id, ''), now()
    ) RETURNING id INTO v_movement_id;

    SELECT coalesce(sum(value), 0) INTO v_total_paid
    FROM public.financial_movements WHERE entry_id = v_entry.id;
    IF v_total_paid >= v_entry.value - 0.005 THEN
      UPDATE public.financial_entries
      SET payment_date = p_movement_date, is_conciliated = true,
          conciliated_at = now(), updated_at = now()
      WHERE id = v_entry.id;
    END IF;
    RETURN jsonb_build_object('mode', 'entry', 'entry_id', v_entry.id, 'movement_id', v_movement_id);
  END IF;

  SELECT * INTO v_movement FROM public.financial_movements WHERE id = p_movement_id FOR UPDATE;
  IF NOT FOUND OR v_movement.account_id IS NULL OR v_movement.account_id <> p_account_id
     OR abs(v_movement.value - p_value) > 0.005 OR v_movement.import_hash IS NOT NULL THEN
    RAISE EXCEPTION 'Movimentação financeira incompatível ou já conciliada.';
  END IF;
  SELECT * INTO v_entry FROM public.financial_entries WHERE id = v_movement.entry_id;
  IF NOT FOUND OR v_entry.type <> p_type THEN RAISE EXCEPTION 'Movimentação incompatível com a linha do extrato.'; END IF;

  UPDATE public.financial_movements
  SET import_hash = p_import_hash, import_source = p_import_source,
      import_external_id = nullif(p_import_external_id, ''), imported_at = now()
  WHERE id = v_movement.id;
  RETURN jsonb_build_object('mode', 'movement', 'entry_id', v_entry.id, 'movement_id', v_movement.id);
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_imported_financial_line(text, uuid, uuid, uuid, text, numeric, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_imported_financial_line(text, uuid, uuid, uuid, text, numeric, date, text, text, text) TO authenticated;
