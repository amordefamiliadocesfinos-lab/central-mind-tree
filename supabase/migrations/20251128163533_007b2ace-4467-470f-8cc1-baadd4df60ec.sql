-- Add dependency_id column to tasks table
ALTER TABLE tasks ADD COLUMN dependency_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_tasks_dependency_id ON tasks(dependency_id);