-- Fase 2.6: persistência atômica e conservadora do catálogo Mestre + Variações.
-- Não cria movimentos, pedidos, contatos ou lançamentos financeiros.
CREATE OR REPLACE FUNCTION public.apply_product_catalog_import(
  p_products jsonb DEFAULT '[]'::jsonb,
  p_variants jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  item jsonb;
  target_id uuid;
  master_id uuid;
  products_created integer := 0;
  products_updated integer := 0;
  variants_created integer := 0;
  variants_updated integer := 0;
BEGIN
  IF jsonb_typeof(p_products) <> 'array' OR jsonb_typeof(p_variants) <> 'array' THEN
    RAISE EXCEPTION 'Os lotes de produtos e variações devem ser listas.';
  END IF;

  -- Produtos primeiro: assim variações novas podem apontar ao SKU do mestre criado no mesmo lote.
  FOR item IN SELECT value FROM jsonb_array_elements(p_products)
  LOOP
    target_id := NULLIF(item ->> 'id', '')::uuid;
    IF COALESCE(btrim(item ->> 'sku'), '') = '' OR COALESCE(btrim(item ->> 'name'), '') = '' THEN
      RAISE EXCEPTION 'Produto exige SKU e nome.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.product_variants v WHERE v.sku = btrim(item ->> 'sku')) THEN
      RAISE EXCEPTION 'SKU % já pertence a uma variação.', item ->> 'sku';
    END IF;
    IF target_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = target_id) THEN RAISE EXCEPTION 'Produto % não encontrado.', target_id; END IF;
      IF EXISTS (SELECT 1 FROM public.products p WHERE p.sku = btrim(item ->> 'sku') AND p.id <> target_id) THEN RAISE EXCEPTION 'SKU % já pertence a outro produto.', item ->> 'sku'; END IF;
      UPDATE public.products SET sku = btrim(item ->> 'sku'), name = btrim(item ->> 'name'), category = NULLIF(item ->> 'category', ''), unit = NULLIF(item ->> 'unit', ''), cost = NULLIF(item ->> 'cost', '')::numeric, price = NULLIF(item ->> 'price', '')::numeric, min_stock = COALESCE(NULLIF(item ->> 'min_stock', '')::numeric, 0), description = NULLIF(item ->> 'description', ''), attributes = COALESCE(item -> 'attributes', '{}'::jsonb), expiry_days = NULLIF(item ->> 'expiry_days', '')::integer, is_active = COALESCE(NULLIF(item ->> 'is_active', '')::boolean, true), height_cm = NULLIF(item ->> 'height_cm', '')::numeric, width_cm = NULLIF(item ->> 'width_cm', '')::numeric, length_cm = NULLIF(item ->> 'length_cm', '')::numeric, weight_g = NULLIF(item ->> 'weight_g', '')::numeric, updated_at = now() WHERE id = target_id;
      products_updated := products_updated + 1;
    ELSE
      IF EXISTS (SELECT 1 FROM public.products p WHERE p.sku = btrim(item ->> 'sku')) THEN RAISE EXCEPTION 'SKU % já pertence a um produto.', item ->> 'sku'; END IF;
      INSERT INTO public.products (sku, name, category, unit, cost, price, min_stock, description, attributes, expiry_days, is_active, height_cm, width_cm, length_cm, weight_g) VALUES (btrim(item ->> 'sku'), btrim(item ->> 'name'), NULLIF(item ->> 'category', ''), NULLIF(item ->> 'unit', ''), NULLIF(item ->> 'cost', '')::numeric, NULLIF(item ->> 'price', '')::numeric, COALESCE(NULLIF(item ->> 'min_stock', '')::numeric, 0), NULLIF(item ->> 'description', ''), COALESCE(item -> 'attributes', '{}'::jsonb), NULLIF(item ->> 'expiry_days', '')::integer, COALESCE(NULLIF(item ->> 'is_active', '')::boolean, true), NULLIF(item ->> 'height_cm', '')::numeric, NULLIF(item ->> 'width_cm', '')::numeric, NULLIF(item ->> 'length_cm', '')::numeric, NULLIF(item ->> 'weight_g', '')::numeric);
      products_created := products_created + 1;
    END IF;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(p_variants)
  LOOP
    target_id := NULLIF(item ->> 'id', '')::uuid;
    IF COALESCE(btrim(item ->> 'sku'), '') = '' OR COALESCE(btrim(item ->> 'variant_name'), '') = '' THEN RAISE EXCEPTION 'Variação exige SKU e nome.'; END IF;
    master_id := NULLIF(item ->> 'product_id', '')::uuid;
    IF master_id IS NULL THEN SELECT id INTO master_id FROM public.products WHERE sku = btrim(item ->> 'product_sku'); END IF;
    IF master_id IS NULL THEN RAISE EXCEPTION 'Produto mestre % não encontrado.', item ->> 'product_sku'; END IF;
    IF EXISTS (SELECT 1 FROM public.products p WHERE p.sku = btrim(item ->> 'sku')) THEN RAISE EXCEPTION 'SKU % já pertence a um produto mestre.', item ->> 'sku'; END IF;
    IF target_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.product_variants v WHERE v.id = target_id) THEN RAISE EXCEPTION 'Variação % não encontrada.', target_id; END IF;
      IF EXISTS (SELECT 1 FROM public.product_variants v WHERE v.sku = btrim(item ->> 'sku') AND v.id <> target_id) THEN RAISE EXCEPTION 'SKU % já pertence a outra variação.', item ->> 'sku'; END IF;
      UPDATE public.product_variants SET product_id = master_id, sku = btrim(item ->> 'sku'), variant_name = btrim(item ->> 'variant_name'), attributes = COALESCE(item -> 'attributes', '{}'::jsonb), unit = NULLIF(item ->> 'unit', ''), cost_override = NULLIF(item ->> 'cost_override', '')::numeric, price_override = NULLIF(item ->> 'price_override', '')::numeric, is_active = COALESCE(NULLIF(item ->> 'is_active', '')::boolean, true), height_cm = NULLIF(item ->> 'height_cm', '')::numeric, width_cm = NULLIF(item ->> 'width_cm', '')::numeric, length_cm = NULLIF(item ->> 'length_cm', '')::numeric, weight_g = NULLIF(item ->> 'weight_g', '')::numeric, updated_at = now() WHERE id = target_id;
      variants_updated := variants_updated + 1;
    ELSE
      IF EXISTS (SELECT 1 FROM public.product_variants v WHERE v.sku = btrim(item ->> 'sku')) THEN RAISE EXCEPTION 'SKU % já pertence a uma variação.', item ->> 'sku'; END IF;
      INSERT INTO public.product_variants (product_id, sku, variant_name, attributes, unit, cost_override, price_override, is_active, height_cm, width_cm, length_cm, weight_g) VALUES (master_id, btrim(item ->> 'sku'), btrim(item ->> 'variant_name'), COALESCE(item -> 'attributes', '{}'::jsonb), NULLIF(item ->> 'unit', ''), NULLIF(item ->> 'cost_override', '')::numeric, NULLIF(item ->> 'price_override', '')::numeric, COALESCE(NULLIF(item ->> 'is_active', '')::boolean, true), NULLIF(item ->> 'height_cm', '')::numeric, NULLIF(item ->> 'width_cm', '')::numeric, NULLIF(item ->> 'length_cm', '')::numeric, NULLIF(item ->> 'weight_g', '')::numeric);
      variants_created := variants_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('products_created', products_created, 'products_updated', products_updated, 'variants_created', variants_created, 'variants_updated', variants_updated);
END;
$$;
