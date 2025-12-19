-- Create production_logs table for daily production entries
CREATE TABLE public.production_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  period TEXT NOT NULL DEFAULT 'manha', -- manha, tarde, noite
  employee_name TEXT NOT NULL,
  process TEXT NOT NULL, -- e.g. 'producao', 'embalagem', 'preparo'
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  warnings TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth)
CREATE POLICY "Allow all on production_logs" ON public.production_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for common queries
CREATE INDEX idx_production_logs_date ON public.production_logs(date);
CREATE INDEX idx_production_logs_employee ON public.production_logs(employee_name);
CREATE INDEX idx_production_logs_process ON public.production_logs(process);

-- Add additional order fields for better editing
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS production_notes TEXT;