-- Base estruturada para a Rotina orquestrar módulos, MTs e recorrências.
ALTER TABLE public.routine_blocks
  ADD COLUMN IF NOT EXISTS mt_id uuid REFERENCES public.routine_mts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS module_key text,
  ADD COLUMN IF NOT EXISTS destination_path text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS completion_criterion text,
  ADD COLUMN IF NOT EXISTS recurrence_series_id uuid,
  ADD COLUMN IF NOT EXISTS alert_offset_minutes integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_routine_blocks_mt_date ON public.routine_blocks(mt_id, date);
CREATE INDEX IF NOT EXISTS idx_routine_blocks_module_date ON public.routine_blocks(module_key, date);
CREATE INDEX IF NOT EXISTS idx_routine_blocks_source ON public.routine_blocks(source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_routine_recurrence_occurrence
  ON public.routine_blocks(
    recurrence_series_id,
    date,
    COALESCE(planned_start, '00:00'::time),
    COALESCE(assigned_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE recurrence_series_id IS NOT NULL AND is_active = true;

-- Recupera relações antigas gravadas como "MT: nome" sempre que possível.
UPDATE public.routine_blocks rb
SET mt_id = mt.id
FROM public.routine_mts mt
WHERE rb.mt_id IS NULL
  AND rb.notes ILIKE ('%MT: ' || mt.name || '%');

COMMENT ON COLUMN public.routine_blocks.module_key IS 'Módulo executor: crm, financeiro, digital, operacoes, foco, rotina etc.';
COMMENT ON COLUMN public.routine_blocks.destination_path IS 'Rota interna aberta ao iniciar o bloco.';
COMMENT ON COLUMN public.routine_blocks.recurrence_series_id IS 'Identifica a série e impede ocorrências duplicadas.';