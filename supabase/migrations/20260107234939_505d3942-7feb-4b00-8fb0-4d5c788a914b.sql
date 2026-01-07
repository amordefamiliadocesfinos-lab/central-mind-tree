-- Tabela de canais de venda (Shopee, Mercado Livre, etc.)
CREATE TABLE public.price_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de parâmetros de precificação por canal
CREATE TABLE public.price_params (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.price_channels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform_fee_pct NUMERIC(10,6) NOT NULL DEFAULT 0,
  payment_fee_pct NUMERIC(10,6) NOT NULL DEFAULT 0,
  extra_fee_pct NUMERIC(10,6) NOT NULL DEFAULT 0,
  packaging_cost NUMERIC(20,10) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(20,10) NOT NULL DEFAULT 0,
  target_margin_pct NUMERIC(10,6) NOT NULL DEFAULT 0.20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_price_params_updated_at
BEFORE UPDATE ON public.price_params
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir alguns canais padrão
INSERT INTO public.price_channels (name) VALUES 
  ('Shopee'),
  ('Mercado Livre'),
  ('Loja Própria'),
  ('Amazon'),
  ('Magalu');