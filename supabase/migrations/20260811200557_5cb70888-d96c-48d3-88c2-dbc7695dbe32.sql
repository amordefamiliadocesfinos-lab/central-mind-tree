ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS recurrence_series_id uuid,
  ADD COLUMN IF NOT EXISTS recurrence_sequence integer,
  ADD COLUMN IF NOT EXISTS import_external_id text;

CREATE INDEX IF NOT EXISTS idx_financial_entries_recurrence_series
  ON public.financial_entries (recurrence_series_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_entries_recurrence_seq
  ON public.financial_entries (recurrence_series_id, recurrence_sequence)
  WHERE recurrence_series_id IS NOT NULL AND recurrence_sequence IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_entries_import_external_id
  ON public.financial_entries (import_external_id)
  WHERE import_external_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financial_movements_value_positive'
      AND conrelid = 'public.financial_movements'::regclass
  ) THEN
    ALTER TABLE public.financial_movements
      ADD CONSTRAINT financial_movements_value_positive CHECK (value > 0) NOT VALID;
  END IF;
END $$;