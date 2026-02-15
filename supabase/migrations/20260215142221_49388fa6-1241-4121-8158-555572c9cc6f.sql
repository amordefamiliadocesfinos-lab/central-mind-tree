
-- Add funnel_status column to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS funnel_status text NOT NULL DEFAULT 'novo_lead';

-- Add index for filtering by funnel_status
CREATE INDEX IF NOT EXISTS idx_contacts_funnel_status ON public.contacts(funnel_status);
