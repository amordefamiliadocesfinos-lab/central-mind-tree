-- Create table for platform groups (dynamic instead of hardcoded)
CREATE TABLE public.digital_platform_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📦',
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digital_platform_groups ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Allow all on digital_platform_groups" ON public.digital_platform_groups
  FOR ALL USING (true) WITH CHECK (true);

-- Insert default groups from current hardcoded values
INSERT INTO public.digital_platform_groups (name, icon, order_index) VALUES
  ('Redes Sociais', '📱', 0),
  ('E-commerce', '🛒', 1),
  ('Marketplaces', '🏪', 2),
  ('Outros', '📦', 3);

-- Add parent_id column to digital_platforms for hierarchy
ALTER TABLE public.digital_platforms 
  ADD COLUMN parent_id uuid REFERENCES public.digital_platforms(id) ON DELETE SET NULL,
  ADD COLUMN group_id uuid REFERENCES public.digital_platform_groups(id) ON DELETE SET NULL;

-- Migrate existing group_type to group_id
UPDATE public.digital_platforms dp
SET group_id = (
  SELECT dpg.id FROM public.digital_platform_groups dpg 
  WHERE dpg.name = CASE 
    WHEN dp.group_type = 'social' THEN 'Redes Sociais'
    WHEN dp.group_type = 'ecommerce' THEN 'E-commerce'
    WHEN dp.group_type = 'marketplace' THEN 'Marketplaces'
    ELSE 'Outros'
  END
);

-- Enable realtime for groups
ALTER PUBLICATION supabase_realtime ADD TABLE public.digital_platform_groups;