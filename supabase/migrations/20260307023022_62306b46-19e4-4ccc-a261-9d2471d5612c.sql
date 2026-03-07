ALTER TABLE public.contact_history ADD COLUMN IF NOT EXISTS interaction_date timestamp with time zone DEFAULT now();
ALTER TABLE public.contact_history ADD COLUMN IF NOT EXISTS interaction_type text NOT NULL DEFAULT 'observacao';

UPDATE public.contact_history SET interaction_date = created_at WHERE interaction_date IS NULL;