
-- 1) Create sheet_tabs table
CREATE TABLE public.sheet_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.sheets(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Planilha1',
  order_index integer NOT NULL DEFAULT 0,
  frozen_rows integer NOT NULL DEFAULT 0,
  frozen_cols integer NOT NULL DEFAULT 0,
  col_widths jsonb DEFAULT '{}'::jsonb,
  row_heights jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sheet_tabs_sheet_id ON public.sheet_tabs(sheet_id, order_index);

ALTER TABLE public.sheet_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on sheet_tabs" ON public.sheet_tabs
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_sheet_tabs_updated_at
  BEFORE UPDATE ON public.sheet_tabs
  FOR EACH ROW EXECUTE FUNCTION public.update_tasks_updated_at();

-- 2) Create default tab for every existing sheet, copying its layout settings
INSERT INTO public.sheet_tabs (sheet_id, title, order_index, frozen_rows, frozen_cols, col_widths, row_heights)
SELECT id, 'Planilha1', 0, frozen_rows, frozen_cols, COALESCE(col_widths, '{}'::jsonb), COALESCE(row_heights, '{}'::jsonb)
FROM public.sheets
WHERE deleted_at IS NULL;

-- 3) Add tab_id column to sheet_cells
ALTER TABLE public.sheet_cells ADD COLUMN tab_id uuid REFERENCES public.sheet_tabs(id) ON DELETE CASCADE;

-- 4) Migrate existing cells -> default tab per sheet
UPDATE public.sheet_cells sc
SET tab_id = st.id
FROM public.sheet_tabs st
WHERE st.sheet_id = sc.sheet_id
  AND st.order_index = 0
  AND sc.tab_id IS NULL;

-- 5) Drop old unique constraint on (sheet_id,row,col); re-create per (tab_id,row,col)
ALTER TABLE public.sheet_cells DROP CONSTRAINT IF EXISTS sheet_cells_sheet_id_row_index_col_index_key;
DROP INDEX IF EXISTS idx_sheet_cells_position;

CREATE UNIQUE INDEX sheet_cells_tab_position_key
  ON public.sheet_cells(tab_id, row_index, col_index);

CREATE INDEX idx_sheet_cells_tab_id ON public.sheet_cells(tab_id);

-- 6) Auto-create default tab for new sheets
CREATE OR REPLACE FUNCTION public.create_default_sheet_tab()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sheet_tabs (sheet_id, title, order_index)
  VALUES (NEW.id, 'Planilha1', 0);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_sheet_tab
  AFTER INSERT ON public.sheets
  FOR EACH ROW EXECUTE FUNCTION public.create_default_sheet_tab();
