
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS import_file_name text,
  ADD COLUMN IF NOT EXISTS import_file_type text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS imported_by text,
  ADD COLUMN IF NOT EXISTS import_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_financial_entries_import_hash
  ON public.financial_entries(import_hash)
  WHERE import_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_entries_account_due
  ON public.financial_entries(account_id, due_date);
