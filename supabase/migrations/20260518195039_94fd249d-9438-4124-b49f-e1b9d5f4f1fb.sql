ALTER TABLE public.digital_ideas ADD COLUMN serial_number text;
CREATE INDEX IF NOT EXISTS idx_digital_ideas_serial_number ON public.digital_ideas(serial_number);