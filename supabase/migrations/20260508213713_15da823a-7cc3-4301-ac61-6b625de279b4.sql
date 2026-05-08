-- 1. Add product linkage to digital_media
ALTER TABLE public.digital_media
  ADD COLUMN IF NOT EXISTS product_id uuid NULL,
  ADD COLUMN IF NOT EXISTS is_product_cover boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_digital_media_product_id
  ON public.digital_media(product_id);

-- 2. Backfill: insert one row per product cover image (if not already present for this product+url)
INSERT INTO public.digital_media (url, filename, file_type, product_id, is_product_cover, created_at)
SELECT
  p.cover_image_url,
  p.name,
  CASE WHEN p.cover_image_url ILIKE '%.mp4' OR p.cover_image_url ILIKE '%.mov' OR p.cover_image_url ILIKE '%.webm'
       THEN 'video' ELSE 'image' END,
  p.id,
  true,
  now()
FROM public.products p
WHERE p.cover_image_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.digital_media dm
    WHERE dm.product_id = p.id AND dm.url = p.cover_image_url
  );

-- 3. Backfill extra media_urls (skip duplicates of cover or already-imported)
INSERT INTO public.digital_media (url, filename, file_type, product_id, is_product_cover, created_at)
SELECT
  url_value,
  p.name,
  CASE WHEN url_value ILIKE '%.mp4' OR url_value ILIKE '%.mov' OR url_value ILIKE '%.webm'
       THEN 'video' ELSE 'image' END,
  p.id,
  false,
  now()
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.media_urls, '[]'::jsonb)) AS url_value
WHERE url_value IS NOT NULL AND url_value <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.digital_media dm
    WHERE dm.product_id = p.id AND dm.url = url_value
  );