-- Tabela para lojas dentro de um canal
CREATE TABLE public.price_stores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.price_channels(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilita RLS
ALTER TABLE public.price_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on price_stores" ON public.price_stores FOR ALL USING (true) WITH CHECK (true);

-- Campos de taxa personalizáveis (metadata)
CREATE TABLE public.price_fee_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  field_type text NOT NULL DEFAULT 'percentage', -- 'percentage' ou 'fixed'
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.price_fee_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on price_fee_fields" ON public.price_fee_fields FOR ALL USING (true) WITH CHECK (true);

-- Valores dos campos personalizáveis por parâmetro
CREATE TABLE public.price_param_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  param_id uuid NOT NULL REFERENCES public.price_params(id) ON DELETE CASCADE,
  fee_field_id uuid NOT NULL REFERENCES public.price_fee_fields(id) ON DELETE CASCADE,
  value numeric(20,10) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(param_id, fee_field_id)
);

ALTER TABLE public.price_param_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on price_param_fees" ON public.price_param_fees FOR ALL USING (true) WITH CHECK (true);

-- Histórico de alterações de parâmetros
CREATE TABLE public.price_param_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  param_id uuid NOT NULL REFERENCES public.price_params(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.price_param_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on price_param_history" ON public.price_param_history FOR ALL USING (true) WITH CHECK (true);

-- Simulações persistentes
CREATE TABLE public.price_simulations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  param_id uuid NOT NULL REFERENCES public.price_params(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Simulação',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.price_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on price_simulations" ON public.price_simulations FOR ALL USING (true) WITH CHECK (true);

-- Itens de simulação
CREATE TABLE public.price_simulation_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id uuid NOT NULL REFERENCES public.price_simulations(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  pack_qty numeric(20,10) NOT NULL DEFAULT 1,
  pack_cost numeric(20,10) NOT NULL DEFAULT 0,
  unit_price numeric(20,10) NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.price_simulation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on price_simulation_items" ON public.price_simulation_items FOR ALL USING (true) WITH CHECK (true);

-- Adicionar store_id à price_params (opcional, para vincular a uma loja específica)
ALTER TABLE public.price_params ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.price_stores(id) ON DELETE SET NULL;

-- Inserir campos de taxa padrão
INSERT INTO public.price_fee_fields (name, field_type, order_index) VALUES
  ('Taxa Plataforma (%)', 'percentage', 1),
  ('Taxa Pagamento (%)', 'percentage', 2),
  ('Taxa Extra (%)', 'percentage', 3),
  ('Custo Embalagem (R$)', 'fixed', 4),
  ('Custo Frete (R$)', 'fixed', 5);