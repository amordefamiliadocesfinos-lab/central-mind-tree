-- =============================================
-- PHASE 1: Processes and Production Orders
-- =============================================

-- Table for production processes (CRUD)
CREATE TABLE public.processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  value_per_unit NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on processes" ON public.processes FOR ALL USING (true) WITH CHECK (true);

-- Production Orders (OP)
CREATE TABLE public.production_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT,
  product_id UUID REFERENCES public.products(id),
  batch_code TEXT,
  target_quantity INTEGER NOT NULL DEFAULT 0,
  consolidated_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on production_orders" ON public.production_orders FOR ALL USING (true) WITH CHECK (true);

-- Link between OP and Processes (required/optional)
CREATE TABLE public.production_order_processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES public.processes(id),
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(production_order_id, process_id)
);

ALTER TABLE public.production_order_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on production_order_processes" ON public.production_order_processes FOR ALL USING (true) WITH CHECK (true);

-- Production Entries (lançamentos)
CREATE TABLE public.production_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES public.processes(id),
  employee_name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  period TEXT NOT NULL DEFAULT 'manha',
  quantity INTEGER NOT NULL DEFAULT 0,
  value_per_unit NUMERIC NOT NULL DEFAULT 0,
  total_value NUMERIC GENERATED ALWAYS AS (quantity * value_per_unit) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on production_entries" ON public.production_entries FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- PHASE 2: Product Processes and Optional Costs
-- =============================================

-- Link products to processes (for cost calculation)
CREATE TABLE public.product_processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES public.processes(id),
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, process_id)
);

ALTER TABLE public.product_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on product_processes" ON public.product_processes FOR ALL USING (true) WITH CHECK (true);

-- Optional costs for products
CREATE TABLE public.product_optional_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_optional_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on product_optional_costs" ON public.product_optional_costs FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- PHASE 3: Production Closing
-- =============================================

CREATE TABLE public.production_closings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',
  total_value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.production_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on production_closings" ON public.production_closings FOR ALL USING (true) WITH CHECK (true);

-- Closing details per employee/process
CREATE TABLE public.production_closing_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closing_id UUID NOT NULL REFERENCES public.production_closings(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  process_id UUID REFERENCES public.processes(id),
  total_quantity INTEGER NOT NULL DEFAULT 0,
  total_value NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE public.production_closing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on production_closing_items" ON public.production_closing_items FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at on processes
CREATE TRIGGER update_processes_updated_at
BEFORE UPDATE ON public.processes
FOR EACH ROW
EXECUTE FUNCTION public.update_tasks_updated_at();

-- Trigger for updated_at on production_orders
CREATE TRIGGER update_production_orders_updated_at
BEFORE UPDATE ON public.production_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_tasks_updated_at();

-- Trigger for updated_at on production_entries
CREATE TRIGGER update_production_entries_updated_at
BEFORE UPDATE ON public.production_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_tasks_updated_at();