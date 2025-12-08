-- Add scheduled_date column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN scheduled_date date NULL;

-- Add index for efficient queries on scheduled_date
CREATE INDEX idx_tasks_scheduled_date ON public.tasks(scheduled_date);