-- Create sheets table
CREATE TABLE public.sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Nova Planilha',
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  frozen_rows INTEGER NOT NULL DEFAULT 0,
  frozen_cols INTEGER NOT NULL DEFAULT 0,
  col_widths JSONB DEFAULT '{}'::jsonb,
  row_heights JSONB DEFAULT '{}'::jsonb
);

-- Create sheet_cells table for storing cell data
CREATE TABLE public.sheet_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES public.sheets(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  col_index INTEGER NOT NULL,
  value TEXT DEFAULT NULL,
  formula TEXT DEFAULT NULL,
  cell_type TEXT NOT NULL DEFAULT 'text',
  format JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sheet_id, row_index, col_index)
);

-- Create indexes for performance
CREATE INDEX idx_sheets_task_id ON public.sheets(task_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sheets_node_id ON public.sheets(node_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sheet_cells_sheet_id ON public.sheet_cells(sheet_id);
CREATE INDEX idx_sheet_cells_position ON public.sheet_cells(sheet_id, row_index, col_index);

-- Enable RLS
ALTER TABLE public.sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheet_cells ENABLE ROW LEVEL SECURITY;

-- Simplified RLS: all authenticated users can access
CREATE POLICY "Allow all on sheets" ON public.sheets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sheet_cells" ON public.sheet_cells FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_sheets_updated_at
  BEFORE UPDATE ON public.sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_updated_at();

CREATE TRIGGER update_sheet_cells_updated_at
  BEFORE UPDATE ON public.sheet_cells
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_updated_at();