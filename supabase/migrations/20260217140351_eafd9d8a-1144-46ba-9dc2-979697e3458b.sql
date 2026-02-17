
-- Create table for custom idea types
CREATE TABLE public.digital_idea_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  icon text NOT NULL DEFAULT '📄',
  color text NOT NULL DEFAULT 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  is_default boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digital_idea_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on digital_idea_types" ON public.digital_idea_types FOR ALL USING (true) WITH CHECK (true);

-- Seed default types
INSERT INTO public.digital_idea_types (key, label, icon, color, is_default, order_index) VALUES
  ('conteudo', 'Conteúdo', '📄', 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30', true, 0),
  ('anuncio', 'Anúncio', '📢', 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30', true, 1),
  ('cadastro', 'Cadastro', '📦', 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', true, 2),
  ('campanha', 'Campanha', '🚀', 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30', true, 3);
