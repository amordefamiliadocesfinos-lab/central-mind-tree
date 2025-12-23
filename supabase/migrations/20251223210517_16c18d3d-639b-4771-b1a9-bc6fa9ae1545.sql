-- Add assigned_to column to tasks table referencing app_users
ALTER TABLE public.tasks 
ADD COLUMN assigned_to uuid REFERENCES public.app_users(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);