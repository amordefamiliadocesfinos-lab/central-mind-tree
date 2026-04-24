-- Tabela de rotas de entrega
CREATE TABLE public.delivery_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  route_type TEXT NOT NULL DEFAULT 'avulsa', -- 'fixa' (recorrente) ou 'avulsa' (do dia)
  status TEXT NOT NULL DEFAULT 'planejada', -- planejada, em_andamento, concluida, cancelada
  scheduled_date DATE,
  driver_name TEXT,
  vehicle TEXT,
  origin_address TEXT,
  notes TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on delivery_routes"
ON public.delivery_routes FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_delivery_routes_updated_at
BEFORE UPDATE ON public.delivery_routes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de paradas (stops) de cada rota
CREATE TABLE public.delivery_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.delivery_routes(id) ON DELETE CASCADE,
  contact_id UUID, -- vínculo opcional com contacts
  order_id UUID,   -- vínculo opcional com orders
  customer_name TEXT, -- usado quando endereço é avulso
  phone TEXT,
  address TEXT NOT NULL,
  address_number TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  complement TEXT,
  reference_point TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, entregue, falhou
  notes TEXT,
  delivery_notes TEXT, -- notas registradas na entrega
  failure_reason TEXT,
  photo_url TEXT,
  signature_url TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on delivery_stops"
ON public.delivery_stops FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_delivery_stops_updated_at
BEFORE UPDATE ON public.delivery_stops
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_delivery_stops_route_id ON public.delivery_stops(route_id);
CREATE INDEX idx_delivery_stops_contact_id ON public.delivery_stops(contact_id);
CREATE INDEX idx_delivery_stops_order_id ON public.delivery_stops(order_id);
CREATE INDEX idx_delivery_routes_scheduled_date ON public.delivery_routes(scheduled_date);

-- Bucket para fotos e assinaturas de entrega
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proof', 'delivery-proof', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read delivery-proof"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-proof');

CREATE POLICY "Public insert delivery-proof"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'delivery-proof');

CREATE POLICY "Public update delivery-proof"
ON storage.objects FOR UPDATE
USING (bucket_id = 'delivery-proof');

CREATE POLICY "Public delete delivery-proof"
ON storage.objects FOR DELETE
USING (bucket_id = 'delivery-proof');