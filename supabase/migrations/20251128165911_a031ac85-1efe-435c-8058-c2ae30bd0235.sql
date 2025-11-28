-- Add order_index field to tasks table
ALTER TABLE public.tasks ADD COLUMN order_index integer NOT NULL DEFAULT 0;

-- Create index for better query performance
CREATE INDEX idx_tasks_order ON public.tasks(node_id, order_index);