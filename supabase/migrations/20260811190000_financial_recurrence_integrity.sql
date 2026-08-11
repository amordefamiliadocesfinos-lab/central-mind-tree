ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS recurrence_series_id uuid,
  ADD COLUMN IF NOT EXISTS recurrence_sequence integer,
  ADD COLUMN IF NOT EXISTS import_external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_financial_import_external_id
  ON public.financial_entries (account_id, import_source, import_external_id)
  WHERE import_external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_financial_recurrence_occurrence
  ON public.financial_entries (recurrence_series_id, recurrence_sequence)
  WHERE recurrence_series_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_recurrence_series
  ON public.financial_entries (recurrence_series_id, due_date);

ALTER TABLE public.financial_movements
  ADD CONSTRAINT financial_movements_positive_value CHECK (value > 0) NOT VALID;
