
-- =============================================
-- PHASE 1: ROUTINE BLOCKS (Método de Trabalho)
-- =============================================

-- Templates de rotina (blocos recorrentes)
CREATE TABLE public.routine_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'foco', -- foco, criativo, pausa, reuniao, admin
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
  start_time TIME, -- horário preferido de início
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blocos executados por dia
CREATE TABLE public.routine_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.routine_templates(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  planned_start TIME,
  planned_end TIME,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, andamento, concluido, pulado, pausado
  block_type TEXT NOT NULL DEFAULT 'foco',
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- PHASE 2: OPERATIONS (Pedidos, Produção, Estoque)
-- =============================================

-- Produtos/SKUs
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT DEFAULT 'un',
  min_stock INTEGER DEFAULT 0,
  cost DECIMAL(10,2),
  price DECIMAL(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estoque
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, location)
);

-- Pedidos
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT,
  customer_name TEXT,
  customer_contact TEXT,
  channel TEXT DEFAULT 'direto', -- marketplace, ecommerce, social, direto
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, producao, pronto, enviado, concluido, cancelado
  total_value DECIMAL(10,2),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens do pedido
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2),
  notes TEXT
);

-- =============================================
-- PHASE 3: OMNICHANNEL POSTS
-- =============================================

-- Posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho, agendado, publicado
  node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
  channels JSONB DEFAULT '[]'::jsonb, -- array de canais habilitados
  channel_data JSONB DEFAULT '{}'::jsonb, -- dados específicos por canal
  checklist JSONB DEFAULT '[]'::jsonb, -- checklist geral
  media_urls JSONB DEFAULT '[]'::jsonb, -- URLs de mídia anexada
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- RLS POLICIES (permissive for now, single-user app)
-- =============================================

ALTER TABLE public.routine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on routine_templates" ON public.routine_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on routine_blocks" ON public.routine_blocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on inventory" ON public.inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on posts" ON public.posts FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_routine_blocks_date ON public.routine_blocks(date);
CREATE INDEX idx_routine_blocks_status ON public.routine_blocks(status);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_date ON public.orders(order_date);
CREATE INDEX idx_posts_scheduled ON public.posts(scheduled_date);
CREATE INDEX idx_posts_status ON public.posts(status);

-- =============================================
-- TRIGGERS for updated_at
-- =============================================

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_updated_at();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_updated_at();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_updated_at();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.routine_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
