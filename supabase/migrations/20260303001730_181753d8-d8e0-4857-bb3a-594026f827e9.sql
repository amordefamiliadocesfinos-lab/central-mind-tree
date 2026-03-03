
-- Add next action fields to contacts
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS next_action_text text,
ADD COLUMN IF NOT EXISTS next_action_date timestamp with time zone;
