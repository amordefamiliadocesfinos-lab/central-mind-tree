-- Add progress field to tasks table
ALTER TABLE public.tasks ADD COLUMN progress integer NOT NULL DEFAULT 0;

-- Add check constraint to ensure progress is between 0 and 100
ALTER TABLE public.tasks ADD CONSTRAINT tasks_progress_check CHECK (progress >= 0 AND progress <= 100);