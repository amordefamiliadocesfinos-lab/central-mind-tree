-- Remove the old check constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add new check constraint with all four status values
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('estrutural', 'andamento', 'pendente', 'concluído'));