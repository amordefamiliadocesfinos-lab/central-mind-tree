-- Add recurrence fields to financial_entries table
ALTER TABLE public.financial_entries 
ADD COLUMN IF NOT EXISTS recurrence_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurrence_day integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurrence_end_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurrence_use_business_days boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_entry_id uuid REFERENCES public.financial_entries(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS original_due_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS issue_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS competence_date date DEFAULT NULL;

-- Add comment for recurrence types
COMMENT ON COLUMN public.financial_entries.recurrence_type IS 'Types: mensal, semanal, quinzenal, trimestral, semestral, anual';