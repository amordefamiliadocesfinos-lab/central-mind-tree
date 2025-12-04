-- Add checklist and use_checklist_progress columns to tasks table
ALTER TABLE public.tasks 
ADD COLUMN checklist JSONB DEFAULT '[]'::jsonb,
ADD COLUMN use_checklist_progress BOOLEAN DEFAULT false;