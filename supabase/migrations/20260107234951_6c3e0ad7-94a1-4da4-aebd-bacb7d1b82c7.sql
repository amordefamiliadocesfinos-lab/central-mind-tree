-- Habilitar RLS nas novas tabelas
ALTER TABLE public.price_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_params ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para price_channels (dados públicos da empresa)
CREATE POLICY "Allow all operations on price_channels" 
ON public.price_channels FOR ALL USING (true) WITH CHECK (true);

-- Políticas permissivas para price_params
CREATE POLICY "Allow all operations on price_params" 
ON public.price_params FOR ALL USING (true) WITH CHECK (true);