
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS temperatura_lead text DEFAULT 'morno',
  ADD COLUMN IF NOT EXISTS valor_estimado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_contato date,
  ADD COLUMN IF NOT EXISTS origem_lead text;
